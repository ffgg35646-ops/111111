import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { approvedCourseEnrollmentFilter } from "@/lib/platform-course-access";
import { calculateCommercePrice } from "@/lib/platform-commerce";

export const runtime = "nodejs";

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  }
  const learner = await requirePlatformRole(request, ["trainee"]);
  if (!learner) return NextResponse.json({ error: "سجّل الدخول بحساب المتدرب لحفظ طلب الكورس." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات الكورس غير صالحة." }, { status: 400 }); }
  const courseId = body && typeof body === "object" && !Array.isArray(body)
    ? cleanText((body as Record<string, unknown>).courseId, 80) : "";
  if (!courseId) return NextResponse.json({ error: "اختر كورسًا صالحًا." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const email = learner.email.toLowerCase();
    const orders = db.collection("platform_requests");
    const enrollment = await orders.findOne(approvedCourseEnrollmentFilter(courseId, email), { projection: { _id: 1 } });
    if (enrollment) return NextResponse.json({ success: true, alreadyEnrolled: true });

    const staticCourse = courses.find((item) => item.id === courseId);
    const storedCourse = staticCourse ? null : await db.collection("platform_course_content").findOne(
      { courseId, status: "published" },
      { projection: { _id: 0, courseId: 1, title: 1, mode: 1 } },
    );
    const course = staticCourse || (storedCourse ? {
      id: String(storedCourse.courseId),
      title: String(storedCourse.title || "دورة تدريبية"),
      mode: storedCourse.mode === "live" || storedCourse.mode === "hybrid" ? storedCourse.mode : "recorded" as const,
    } : null);
    if (!course) return NextResponse.json({ error: "الكورس غير موجود أو غير منشور." }, { status: 404 });

    const existing = await orders.findOne(
      { email, courseId, kind: "course_enrollment", source: "course-detail-page", status: { $in: ["pending_review", "awaiting_payment"] } },
      { sort: { createdAt: -1 } },
    );
    if (existing) {
      return NextResponse.json({
        success: true, requestId: String(existing.requestId), status: String(existing.status),
        paymentStatus: String(existing.paymentStatus || "unpaid"),
        quotedAmount: typeof existing.quotedAmount === "number" ? existing.quotedAmount : null,
        reused: true,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const coursePrice = await db.collection("etzan_course_prices").findOne(
      { courseId, active: true }, { projection: { _id: 0, price: 1, currency: 1 } },
    );
    const record: Record<string, unknown> = {
      requestId: randomUUID(), courseOrderKey: email + ":" + courseId,
      kind: "course_enrollment", name: cleanText(learner.name, 100) || email.split("@")[0],
      email, phone: "", courseId, courseTitle: course.title, deliveryMode: course.mode,
      status: "pending_review", paymentStatus: "unpaid", source: "course-detail-page",
      schemaVersion: 1, couponCode: "", createdAt: new Date(),
    };
    if (coursePrice && typeof coursePrice.price === "number" && Number.isFinite(coursePrice.price) && coursePrice.price > 0) {
      const breakdown = await calculateCommercePrice(db, coursePrice.price, "course");
      Object.assign(record, {
        status: "awaiting_payment", paymentStatus: "payment_due",
        quotedAmount: breakdown.totalAmount, subtotalAmount: breakdown.subtotalAmount,
        discountAmount: 0, taxAmount: breakdown.taxAmount, vatRateBps: breakdown.vatRateBps,
        pricesIncludeVat: breakdown.pricesIncludeVat, currency: "SAR",
      });
    }
    await orders.insertOne(record);
    return NextResponse.json({
      success: true, requestId: String(record.requestId), status: String(record.status),
      paymentStatus: String(record.paymentStatus),
      quotedAmount: typeof record.quotedAmount === "number" ? record.quotedAmount : null,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Automatic course order creation failed", error);
    return NextResponse.json({ error: "تعذر حفظ طلب الكورس. حاول تحديث الصفحة." }, { status: 503 });
  }
}
