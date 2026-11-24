import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { createZoomMeeting } from "@/lib/zoom";
import { requirePlatformRole } from "@/lib/platform-auth";
import { releasePendingBookInventory } from "@/lib/book-orders";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: NextRequest) {
  if (!(await requirePlatformRole(request, ["admin", "platform_manager", "accountant", "support"]))) return NextResponse.json({ error: "تسجيل الدخول بصلاحية مدير المنصة مطلوب." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const records = await db.collection("platform_requests")
      .find({}, { projection: { _id: 0, requestId: 1, kind: 1, name: 1, email: 1, phone: 1, status: 1, courseId: 1, courseTitle: 1, serviceId: 1, preferredAt: 1, requestNote: 1, consent: 1, durationMinutes: 1, attendees: 1, roomPurpose: 1, items: 1, deliveryRegion: 1, orderNote: 1, expectedAmount: 1, adminNote: 1, zoomMeeting: 1, quotedAmount: 1, currency: 1, paymentStatus: 1, createdAt: 1, reviewedAt: 1 } })
      .sort({ createdAt: -1 }).limit(250).toArray();
    return NextResponse.json({ requests: records }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to list platform requests", error);
    return NextResponse.json({ error: "تعذر تحميل الطلبات. تحقق من اتصال قاعدة البيانات." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requirePlatformRole(request, ["admin", "platform_manager"]))) return NextResponse.json({ error: "تسجيل الدخول بصلاحية مدير المنصة مطلوب." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات التحديث غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات التحديث غير مكتملة." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const requestId = clean(data.requestId, 60);
  const action = clean(data.action, 30);
  const adminNote = clean(data.adminNote, 1000);
  const quotedAmount = Number(data.quotedAmount);
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "رقم الطلب أو الإجراء غير صالح." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const collection = db.collection("platform_requests");
    const record = await collection.findOne({ requestId });
    if (!record) return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
    if (record.status !== "pending_review") return NextResponse.json({ error: "تمت مراجعة هذا الطلب مسبقاً." }, { status: 409 });

    if (action === "reject") {
      await collection.updateOne({ requestId, status: "pending_review" }, { $set: { status: "rejected", adminNote, reviewedAt: new Date(), reviewedBy: "platform-admin" } });
      if (record.kind === "book_order") await releasePendingBookInventory(db,requestId);
      if (record.kind === "consultation" && typeof record.slotId === "string") await db.collection("platform_consultant_slots").updateOne({ slotId: record.slotId, reservationId: requestId, status: "reserved" }, { $set: { status: "open" }, $unset: { reservationId: "", reservedUntil: "" } });
      return NextResponse.json({ success: true, status: "rejected" });
    }

    if (!Number.isFinite(quotedAmount) || quotedAmount <= 0 || quotedAmount > 10000000) {
      return NextResponse.json({ error: "أدخل إجمالي السعر بالريال السعودي قبل اعتماد الطلب." }, { status: 400 });
    }

    let zoomMeeting: Awaited<ReturnType<typeof createZoomMeeting>> | undefined;
    if (["classroom_registration", "consultation", "room_rental"].includes(String(record.kind))) {
      if (!(record.preferredAt instanceof Date) || record.preferredAt.getTime() < Date.now() + 5 * 60 * 1000) {
        return NextResponse.json({ error: "الموعد المقترح لم يعد صالحاً. اطلب من صاحب الطلب تحديد موعد جديد." }, { status: 409 });
      }
      const durationMinutes = record.kind === "room_rental"
        ? Number(record.durationMinutes)
        : record.kind === "consultation" ? 50 : 90;
      const topic = record.kind === "consultation"
        ? "استشارة مهنية / علاجية - " + String(record.serviceId || "موعد استشارة")
        : record.kind === "room_rental"
          ? "قاعة افتراضية - " + String(record.roomPurpose || "اجتماع تدريبي")
          : "فصل تدريبي - " + String(record.courseTitle || "برنامج تدريبي");
      try {
        zoomMeeting = await createZoomMeeting({ topic, startTime: record.preferredAt, durationMinutes });
      } catch (error) {
        console.error("Zoom meeting provisioning failed", error);
        return NextResponse.json({ error: "تعذر إنشاء اجتماع Zoom. راجع إعدادات ZOOM_ACCOUNT_ID وZOOM_CLIENT_ID وZOOM_CLIENT_SECRET وZOOM_HOST_USER_ID، ولم تتم الموافقة على الطلب." }, { status: 502 });
      }
    }

    await collection.updateOne({ requestId, status: "pending_review" }, { $set: {
      status: "awaiting_payment", paymentStatus: "payment_due", quotedAmount: Math.round(quotedAmount * 100) / 100, currency: "SAR", adminNote, reviewedAt: new Date(), reviewedBy: "platform-admin",
      ...(zoomMeeting ? { zoomMeeting, meetingProvisionedAt: new Date() } : {}),
    } });
    return NextResponse.json({ success: true, status: "awaiting_payment", paymentStatus: "payment_due", quotedAmount: Math.round(quotedAmount * 100) / 100, currency: "SAR", zoomMeeting: zoomMeeting ? { joinUrl: zoomMeeting.joinUrl, startTime: zoomMeeting.startTime } : undefined });
  } catch (error) {
    console.error("Unable to review platform request", error);
    return NextResponse.json({ error: "تعذر تحديث الطلب حالياً." }, { status: 503 });
  }
}
