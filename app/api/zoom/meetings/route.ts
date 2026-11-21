import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createZoomMeeting } from "@/lib/zoom";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const expected = process.env.PLATFORM_ADMIN_API_KEY;
  const provided = request.headers.get("x-platform-admin-key") || "";
  return Boolean(expected && expected.length >= 32 && expected.length === provided.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(provided)));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "إنشاء اجتماعات Zoom متاح لإدارة المنصة فقط." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الاجتماع غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات الاجتماع غير مكتملة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const topic = typeof data.topic === "string" ? data.topic.trim().slice(0, 180) : "";
  const startTime = typeof data.startTime === "string" ? new Date(data.startTime) : new Date("");
  const durationMinutes = Number(data.durationMinutes);
  if (!topic || !Number.isFinite(startTime.getTime()) || startTime.getTime() < Date.now() + 5 * 60 * 1000 ||
      !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    return NextResponse.json({ error: "حدد عنوان الاجتماع وموعداً مستقبلياً بعد خمس دقائق ومدة من 15 إلى 480 دقيقة." }, { status: 400 });
  }

  try {
    const meeting = await createZoomMeeting({ topic, startTime, durationMinutes });
    return NextResponse.json({ success: true, meeting }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Zoom meeting integration failed", error);
    return NextResponse.json({ error: "تعذر إنشاء اجتماع Zoom. تحقق من الحساب والمضيف والنطاقات وقاعدة البيانات." }, { status: 503 });
  }
}
