import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { createZoomMeeting } from "@/lib/zoom";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const expected = process.env.PLATFORM_ADMIN_API_KEY;
  const provided = request.headers.get("x-platform-admin-key") || "";
  return Boolean(expected && expected.length >= 32 && expected.length === provided.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(provided)));
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "هذه القائمة متاحة لإدارة المنصة فقط." }, { status: 403 });

  const status = clean(request.nextUrl.searchParams.get("status"), 30) || "pending_review";
  const kind = clean(request.nextUrl.searchParams.get("kind"), 40);
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 50));
  const filter: Record<string, unknown> = {};
  if (status !== "all") filter.status = status;
  if (kind) filter.kind = kind;

  try {
    const db = await getClinicalDatabase();
    const records = await db.collection("platform_requests")
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      requests: records.map((record) => ({
        requestId: record.requestId,
        kind: record.kind,
        name: record.name,
        email: record.email,
        phone: record.phone,
        status: record.status,
        courseTitle: record.courseTitle,
        deliveryMode: record.deliveryMode,
        serviceId: record.serviceId,
        preferredAt: record.preferredAt,
        durationMinutes: record.durationMinutes,
        attendees: record.attendees,
        items: record.items,
        createdAt: record.createdAt,
        zoomMeeting: record.zoomMeeting,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to read platform request queue", error);
    return NextResponse.json({ error: "تعذر تحميل قائمة الطلبات." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "تعديل الطلبات متاح لإدارة المنصة فقط." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات القرار غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات القرار غير مكتملة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const requestId = clean(data.requestId, 60);
  const action = clean(data.action, 20);
  const adminNote = clean(data.adminNote, 500);
  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "اختر طلباً صحيحاً وحدد الموافقة أو الرفض." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const requests = db.collection("platform_requests");
    const record = await requests.findOne({ requestId });
    if (!record) return NextResponse.json({ error: "لم يتم العثور على الطلب." }, { status: 404 });
    if (record.status !== "pending_review") {
      return NextResponse.json({ error: "تمت معالجة هذا الطلب مسبقاً." }, { status: 409 });
    }

    let zoomMeeting: Awaited<ReturnType<typeof createZoomMeeting>> | undefined;
    if (action === "approve" && (record.kind === "room_rental" || record.kind === "classroom_registration")) {
      const startTime = record.preferredAt instanceof Date
        ? record.preferredAt
        : new Date(clean(data.startTime, 50) || "");
      const durationMinutes = record.kind === "room_rental"
        ? Number(record.durationMinutes)
        : Math.min(480, Math.max(15, Number(data.durationMinutes) || 90));

      if (!Number.isFinite(startTime.getTime()) || startTime.getTime() < Date.now() + 5 * 60 * 1000) {
        return NextResponse.json({ error: "موعد الطلب انتهى أو لم يعد مستقبلياً. حدّث الموعد ثم حاول مجدداً." }, { status: 400 });
      }

      const topic = record.kind === "room_rental"
        ? `قاعة افتراضية: ${clean(record.roomPurpose, 100) || "جلسة تدريبية"}`
        : `فصل تدريبي: ${clean(record.courseTitle, 120)}`;

      try {
        zoomMeeting = await createZoomMeeting({ topic, startTime, durationMinutes });
      } catch (error) {
        console.error("Unable to create Zoom meeting while approving request", error);
        return NextResponse.json({ error: "لم تتم الموافقة لأن إنشاء اجتماع Zoom لم ينجح. تحقق من حساب Zoom والمضيف والنطاقات." }, { status: 502 });
      }
    }

    const now = new Date();
    const update: Record<string, unknown> = {
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: now,
      reviewedBy: "platform-admin",
      adminNote,
    };
    if (zoomMeeting) update.zoomMeeting = zoomMeeting;

    await requests.updateOne(
      { _id: record._id, status: "pending_review" },
      { $set: update },
    );

    return NextResponse.json({
      success: true,
      requestId,
      status: update.status,
      zoomMeeting,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to update platform request", error);
    return NextResponse.json({ error: "تعذر تحديث الطلب." }, { status: 503 });
  }
}
