import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { approvedCourseEnrollmentFilter } from "@/lib/platform-course-access";

export const runtime = "nodejs";

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
class CouponRedemptionError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const learner = await requirePlatformRole(request, ["trainee"]);
  if (!learner) return NextResponse.json({ error: "سجّل الدخول بحساب المتدرب لتفعيل كود الخصم." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات كود الخصم غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "أدخل كود الخصم والكورس المطلوب." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const requestId = cleanText(data.requestId, 60);
  const courseId = cleanText(data.courseId, 80);
  const code = cleanText(data.couponCode, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !courseId || code.length < 3) {
    return NextResponse.json({ error: "رقم الطلب أو كود الخصم غير صالح." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const email = learner.email.toLowerCase();
    const enrolled = await db.collection("platform_requests").findOne(
      approvedCourseEnrollmentFilter(courseId, email), { projection: { _id: 1 } },
    );
    if (enrolled) return NextResponse.json({ success: true, alreadyEnrolled: true, courseId });

    const session = db.client.startSession();
    let activated = false;
    try {
      await session.withTransaction(async () => {
        const orders = db.collection("platform_requests");
        const order = await orders.findOne(
          { requestId, email, courseId, kind: "course_enrollment", source: "course-detail-page" },
          { session },
        );
        if (!order) throw new CouponRedemptionError("لم يتم العثور على طلب الكورس الخاص بحسابك.", 404);
        if (order.status === "approved" && order.paymentStatus === "coupon_redeemed") { activated = true; return; }
        if (order.paymentStatus === "payment_initiated") {
          throw new CouponRedemptionError("توجد عملية دفع بدأت بالفعل لهذا الطلب. لا يمكن تغيير طريقة إتمامه الآن.");
        }
        if (order.couponConsumedAt || ["paid", "coupon_redeemed"].includes(String(order.paymentStatus || ""))) {
          throw new CouponRedemptionError("تم استخدام كود لهذا الطلب أو تم إتمامه بالفعل.");
        }

        const now = new Date();
        const couponFilter = {
          code, active: true, appliesTo: { $in: ["all", "course"] },
          $and: [
            { $or: [{ startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
            { $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
            { $or: [
              { maxUses: { $exists: false } }, { maxUses: null },
              { $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, "$maxUses"] } },
            ] },
          ],
        };
        const coupon = await db.collection("etzan_coupons").findOne(couponFilter, { session });
        if (!coupon) throw new CouponRedemptionError("كود الخصم غير صالح أو منتهي أو سبق استخدامه.");

        const configuredPrice = await db.collection("etzan_course_prices").findOne(
          { courseId, active: true }, { projection: { _id: 0, price: 1 }, session },
        );
        const amount = Math.max(0, Number(order.subtotalAmount ?? order.quotedAmount ?? configuredPrice?.price ?? 0));
        if (!Number.isFinite(amount)) throw new CouponRedemptionError("قيمة الكورس غير صالحة.");
        if (amount < (Number(coupon.minimumAmount) || 0)) {
          throw new CouponRedemptionError("قيمة الكورس أقل من الحد الأدنى لاستخدام كود الخصم.");
        }
        const value = Number(coupon.value);
        const coversFullCourse = coupon.type === "percent"
          ? Number.isFinite(value) && value === 100
          : Number.isFinite(value) && value > 0 && amount > 0 && value >= amount;
        if (!coversFullCourse) {
          throw new CouponRedemptionError("هذا الكود لا يغطي كامل قيمة الكورس. يلزم كود تفعيل بخصم 100% أو بقيمة تغطي سعر الكورس بالكامل.");
        }

        const claimed = await db.collection("etzan_coupons").updateOne(
          couponFilter, { $inc: { usedCount: 1 }, $set: { updatedAt: now } }, { session },
        );
        if (claimed.modifiedCount !== 1) throw new CouponRedemptionError("سبق استخدام كود الخصم أو انتهى عدد مرات استخدامه.");

        const updated = await orders.updateOne(
          {
            _id: order._id,
            status: { $in: ["pending_review", "awaiting_payment"] },
            paymentStatus: { $nin: ["paid", "coupon_redeemed", "payment_initiated"] },
            couponConsumedAt: { $exists: false },
          },
          { $set: {
            status: "approved", paymentStatus: "coupon_redeemed", paymentProvider: "coupon",
            couponCode: code, couponConsumedAt: now, couponRedeemedAt: now, approvedAt: now,
            subtotalAmount: amount, discountAmount: amount, taxAmount: 0, quotedAmount: 0, currency: "SAR",
          } },
          { session },
        );
        if (updated.modifiedCount !== 1) throw new CouponRedemptionError("تغيرت حالة الطلب أثناء تفعيل الكود. حدّث الصفحة وحاول مجددًا.");
        activated = true;
      });
    } finally {
      await session.endSession();
    }

    if (!activated) throw new CouponRedemptionError("تعذر تفعيل الكود.");
    await db.collection("platform_audit_logs").insertOne({
      action: "course_enrollment_coupon_redeemed", actorUserId: learner.userId,
      requestId, courseId, couponCode: code, createdAt: new Date(),
    });
    return NextResponse.json({ success: true, courseId, alreadyEnrolled: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CouponRedemptionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Course coupon redemption failed", error);
    return NextResponse.json({ error: "تعذر تفعيل كود الخصم حاليًا. حاول مرة أخرى." }, { status: 503 });
  }
}
