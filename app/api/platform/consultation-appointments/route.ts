import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { sendConsultationNotice } from "@/lib/consultation-notifications";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager", "consultant"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بإدارة هذا الموعد." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الإجراء غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الموعد مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const requestId = typeof data.requestId === "string" ? data.requestId.trim().slice(0, 60) : "";
  const action = typeof data.action === "string" ? data.action : "";
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["cancel", "complete"].includes(action)) {
    return NextResponse.json({ error: "رقم الموعد أو الإجراء غير صالح." }, { status: 400 });
  }
  try {
    const db = await getClinicalDatabase();
    const filter: Record<string, unknown> = { requestId, kind: "consultation", status: "approved", paymentStatus: "paid" };
    if (actor.role === "consultant") filter.providerUserId = actor.userId;
    const appointment = await db.collection("platform_requests").findOne(filter);
    if (!appointment) return NextResponse.json({ error: "الموعد غير موجود أو لا تملك صلاحية إدارته." }, { status: 404 });
    const now = new Date();
    if (action === "cancel") {
      const result = await db.collection("platform_requests").updateOne(
        { _id: appointment._id, status: "approved", paymentStatus: "paid" },
        { $set: { status: "cancellation_requested", cancellationRequestedAt: now, cancellationRefundStatus: "pending_review", cancellationRequestedBy: actor.userId, cancellationRequestedByRole: actor.role } },
      );
      if (!result.modifiedCount) return NextResponse.json({ error: "تغيرت حالة الموعد. حدّث الصفحة." }, { status: 409 });
      await sendConsultationNotice(db, {
        requestId, email: String(appointment.email), recipientName: String(appointment.name || "عميل اتزان"),
        subject: "تحديث على موعد الاستشارة - اتزان",
        message: "طلب مقدم الخدمة إلغاء موعدك. سيُراجع فريق المنصة الاسترداد المالي، وسيصلك إشعار عند اكتمال المعالجة. رقم الطلب: " + requestId,
      });
    } else {
      const startsAt = appointment.preferredAt instanceof Date ? appointment.preferredAt : new Date(String(appointment.preferredAt || ""));
      const durationMinutes = Number(appointment.durationMinutes) || 50;
      if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() + durationMinutes * 60000 > now.getTime()) {
        return NextResponse.json({ error: "لا يمكن تسجيل اكتمال الجلسة قبل انتهاء موعدها." }, { status: 409 });
      }
      const result = await db.collection("platform_requests").updateOne(
        { _id: appointment._id, status: "approved", paymentStatus: "paid" },
        { $set: { status: "completed", completedAt: now, completedBy: actor.userId } },
      );
      if (!result.modifiedCount) return NextResponse.json({ error: "تغيرت حالة الموعد. حدّث الصفحة." }, { status: 409 });
      await sendConsultationNotice(db, {
        requestId, email: String(appointment.email), recipientName: String(appointment.name || "عميل اتزان"),
        subject: "اكتملت الاستشارة - اتزان",
        message: "تم تسجيل اكتمال جلسة الاستشارة. نشكرك على استخدام منصة اتزان.",
      });
    }
    await db.collection("platform_audit_logs").insertOne({
      action: action === "cancel" ? "consultation_provider_cancellation_requested" : "consultation_completed",
      actorUserId: actor.userId, requestId, createdAt: now,
    });
    return NextResponse.json({ success: true, status: action === "cancel" ? "cancellation_requested" : "completed" });
  } catch (error) {
    console.error("Consultant appointment action failed", error);
    return NextResponse.json({ error: "تعذر تحديث الموعد." }, { status: 503 });
  }
}
