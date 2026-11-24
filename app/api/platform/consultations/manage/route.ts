import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { rescheduleZoomMeeting } from "@/lib/zoom";
import { sendConsultationNotice } from "@/lib/consultation-notifications";

export const runtime = "nodejs";
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validId = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const sameOrigin = (request: NextRequest) => !request.headers.get("origin") || request.headers.get("origin") === request.nextUrl.origin;

export async function GET(request: NextRequest) {
  const requestId = clean(request.nextUrl.searchParams.get("requestId"), 60);
  const email = clean(request.nextUrl.searchParams.get("email"), 180).toLowerCase();
  if (!validId(requestId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "أدخل رقم الطلب والبريد الإلكتروني المسجلين." }, { status: 400 });
  }
  try {
    const db = await getClinicalDatabase();
    const record = await db.collection("platform_requests").findOne(
      { requestId, email, kind: "consultation" },
      { projection: { _id: 0, requestId: 1, name: 1, email: 1, status: 1, serviceId: 1, preferredAt: 1, durationMinutes: 1, providerName: 1, providerUserId: 1, slotId: 1, deliveryMode: 1, videoPlatform: 1, zoomMeeting: 1, quotedAmount: 1, currency: 1, paymentStatus: 1, paymentId: 1, adminNote: 1, cancellationRequestedAt: 1, cancellationRefundStatus: 1, cancelledAt: 1, rescheduledAt: 1, createdAt: 1 } },
    );
    if (!record) return NextResponse.json({ error: "لم يتم العثور على موعد مطابق." }, { status: 404 });
    const paid = record.paymentStatus === "paid";
    return NextResponse.json({
      ...record,
      zoomMeeting: paid && record.status === "approved" ? record.zoomMeeting : undefined,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Consultation lookup failed", error);
    return NextResponse.json({ error: "تعذر تحميل بيانات الموعد." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات إدارة الموعد غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات إدارة الموعد مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const requestId = clean(data.requestId, 60);
  const email = clean(data.email, 180).toLowerCase();
  const action = clean(data.action, 20);
  const newSlotId = clean(data.newSlotId, 80);
  if (!validId(requestId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["cancel", "reschedule"].includes(action)) {
    return NextResponse.json({ error: "تحقق من رقم الطلب والبريد والإجراء المطلوب." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const requests = db.collection("platform_requests");
    const record = await requests.findOne({ requestId, email, kind: "consultation" });
    if (!record) return NextResponse.json({ error: "الموعد غير موجود." }, { status: 404 });
    if (record.status === "cancelled" || record.status === "refunded" || record.status === "rejected") {
      return NextResponse.json({ error: "هذا الموعد غير نشط ولا يمكن تعديله." }, { status: 409 });
    }

    if (action === "cancel") {
      if (record.status === "cancellation_requested") return NextResponse.json({ error: "تم إرسال طلب الإلغاء مسبقاً." }, { status: 409 });
      const now = new Date();
      if (record.paymentStatus === "payment_initiated") {
        return NextResponse.json({ error: "توجد عملية دفع قيد التحقق. انتظر تحديث حالتها قبل طلب الإلغاء." }, { status: 409 });
      }
      if (record.paymentStatus === "paid") {
        const updated = await requests.updateOne(
          { _id: record._id, status: "approved", paymentStatus: "paid" },
          { $set: { status: "cancellation_requested", cancellationRequestedAt: now, cancellationRefundStatus: "pending_review" } },
        );
        if (!updated.modifiedCount) return NextResponse.json({ error: "تعذر تثبيت طلب الإلغاء؛ حدّث الصفحة." }, { status: 409 });
        await db.collection("platform_audit_logs").insertOne({ action: "consultation_cancellation_requested", requestId, email, createdAt: now });
        await sendConsultationNotice(db, {
          requestId, email, recipientName: String(record.name || "عميل اتزان"),
          subject: "تم استلام طلب إلغاء الاستشارة - اتزان",
          message: "استلمنا طلب إلغاء موعدك المدفوع. سيُراجع فريق المنصة الاسترداد المالي، وسيصلك إشعار عند اكتمال المعالجة. رقم الطلب: " + requestId,
          actionUrl: new URL("/my-consultations?requestId=" + encodeURIComponent(requestId) + "&email=" + encodeURIComponent(email), request.nextUrl.origin).toString(),
        });
        return NextResponse.json({ success: true, status: "cancellation_requested", message: "تم إرسال طلب الإلغاء للمراجعة المالية. سيبقى الموعد محجوزاً حتى معالجة الاسترداد." });
      }

      const updated = await requests.updateOne(
        { _id: record._id, status: { $in: ["pending_review", "awaiting_payment"] }, paymentStatus: { $ne: "paid" } },
        { $set: { status: "cancelled", cancelledAt: now, cancellationReason: "customer_request" } },
      );
      if (!updated.modifiedCount) return NextResponse.json({ error: "لا يمكن إلغاء الموعد في حالته الحالية." }, { status: 409 });
      if (typeof record.slotId === "string") {
        await db.collection("platform_consultant_slots").updateOne(
          { slotId: record.slotId, reservationId: requestId, status: "reserved" },
          { $set: { status: "open" }, $unset: { reservationId: "", reservedUntil: "" } },
        );
      }
      await sendConsultationNotice(db, {
        requestId, email, recipientName: String(record.name || "عميل اتزان"),
        subject: "تم إلغاء طلب الاستشارة - اتزان",
        message: "تم إلغاء طلب الاستشارة وإتاحة الموعد مرة أخرى. رقم الطلب: " + requestId,
      });
      return NextResponse.json({ success: true, status: "cancelled" });
    }

    if (record.status !== "approved" || record.paymentStatus !== "paid") {
      return NextResponse.json({ error: "إعادة الجدولة متاحة بعد اعتماد الموعد وإتمام الدفع." }, { status: 409 });
    }
    if (!validId(newSlotId) || newSlotId === record.slotId) return NextResponse.json({ error: "اختر موعداً جديداً مختلفاً." }, { status: 400 });
    const oldStart = record.preferredAt instanceof Date ? record.preferredAt : new Date(String(record.preferredAt || ""));
    const oldDuration = Number(record.durationMinutes) || 50;
    const newSlot = await db.collection("platform_consultant_slots").findOne({
      slotId: newSlotId,
      serviceIds: String(record.serviceId),
      startsAt: { $gt: new Date(Date.now() + 30 * 60 * 1000) },
      $or: [{ status: "open" }, { status: "reserved", reservedUntil: { $lt: new Date() } }],
    });
    if (!newSlot || !(newSlot.startsAt instanceof Date)) return NextResponse.json({ error: "الموعد الجديد لم يعد متاحاً. حدّث التقويم واختر وقتاً آخر." }, { status: 409 });
    const reserved = await db.collection("platform_consultant_slots").updateOne(
      { _id: newSlot._id, serviceIds: String(record.serviceId), startsAt: newSlot.startsAt, $or: [{ status: "open" }, { status: "reserved", reservedUntil: { $lt: new Date() } }] },
      { $set: { status: "reserved", reservationId: requestId, reservedUntil: new Date(Date.now() + 10 * 60 * 1000), rescheduleHold: true } },
    );
    if (!reserved.modifiedCount) return NextResponse.json({ error: "سبق حجز هذا الوقت. اختر موعداً آخر." }, { status: 409 });

    const meetingId = clean(record.zoomMeeting?.meetingId, 80);
    if (!meetingId) {
      await db.collection("platform_consultant_slots").updateOne({ slotId: newSlotId, reservationId: requestId, status: "reserved" }, { $set: { status: "open" }, $unset: { reservationId: "", reservedUntil: "", rescheduleHold: "" } });
      return NextResponse.json({ error: "رابط الاجتماع المرئي غير مرتبط بهذا الموعد. تواصل مع الدعم لإعادة الجدولة." }, { status: 409 });
    }

    try {
      await rescheduleZoomMeeting({ meetingId, startTime: newSlot.startsAt, durationMinutes: Number(newSlot.durationMinutes) || oldDuration });
    } catch (error) {
      await db.collection("platform_consultant_slots").updateOne({ slotId: newSlotId, reservationId: requestId, status: "reserved" }, { $set: { status: "open" }, $unset: { reservationId: "", reservedUntil: "", rescheduleHold: "" } });
      console.error("Zoom consultation reschedule failed", error);
      return NextResponse.json({ error: "تعذر تحديث رابط Zoom. لم يتم تغيير الموعد القديم." }, { status: 502 });
    }

    const updated = await requests.updateOne(
      { _id: record._id, status: "approved", paymentStatus: "paid", slotId: record.slotId },
      { $set: {
        slotId: newSlotId,
        providerUserId: newSlot.providerUserId,
        providerName: newSlot.providerName,
        preferredAt: newSlot.startsAt,
        durationMinutes: Number(newSlot.durationMinutes) || oldDuration,
        rescheduledAt: new Date(),
        "zoomMeeting.startTime": newSlot.startsAt,
      } },
    );
    if (!updated.modifiedCount) {
      try { if (oldStart instanceof Date && Number.isFinite(oldStart.getTime())) await rescheduleZoomMeeting({ meetingId, startTime: oldStart, durationMinutes: oldDuration }); } catch (rollbackError) { console.error("Zoom rollback after consultation reschedule conflict failed", rollbackError); }
      await db.collection("platform_consultant_slots").updateOne({ slotId: newSlotId, reservationId: requestId, status: "reserved" }, { $set: { status: "open" }, $unset: { reservationId: "", reservedUntil: "", rescheduleHold: "" } });
      return NextResponse.json({ error: "تغيرت حالة الموعد أثناء إعادة الجدولة. حدّث الصفحة." }, { status: 409 });
    }

    await db.collection("platform_consultant_slots").updateOne(
      { slotId: newSlotId, reservationId: requestId, status: "reserved" },
      { $set: { status: "booked", bookedAt: new Date(), paymentId: record.paymentId }, $unset: { reservedUntil: "", rescheduleHold: "" } },
    );
    if (typeof record.slotId === "string") {
      await db.collection("platform_consultant_slots").updateOne(
        { slotId: record.slotId, reservationId: requestId, status: "booked" },
        { $set: { status: "open", releasedAt: new Date() }, $unset: { reservationId: "", bookedAt: "", paymentId: "" } },
      );
    }
    await db.collection("platform_audit_logs").insertOne({ action: "consultation_rescheduled", requestId, oldSlotId: record.slotId, newSlotId, createdAt: new Date() });
    await sendConsultationNotice(db, {
      requestId, email, recipientName: String(record.name || "عميل اتزان"),
      subject: "تم تعديل موعد الاستشارة - اتزان",
      message: "تم تحديث موعدك بنجاح إلى " + newSlot.startsAt.toLocaleString("ar-SA") + " مع " + String(newSlot.providerName || "مقدم الخدمة") + ". رابط Zoom نفسه تم تحديثه للوقت الجديد.",
      actionUrl: new URL("/my-consultations?requestId=" + encodeURIComponent(requestId) + "&email=" + encodeURIComponent(email), request.nextUrl.origin).toString(),
    });
    return NextResponse.json({ success: true, status: "approved", preferredAt: newSlot.startsAt, providerName: newSlot.providerName });
  } catch (error) {
    console.error("Consultation management action failed", error);
    return NextResponse.json({ error: "تعذر تنفيذ العملية حالياً." }, { status: 503 });
  }
}
