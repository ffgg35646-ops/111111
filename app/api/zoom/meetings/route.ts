import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const expected = process.env.PLATFORM_ADMIN_API_KEY;
  const provided = request.headers.get("x-platform-admin-key") || "";
  return Boolean(expected && expected.length >= 32 && expected.length === provided.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(provided)));
}

async function getZoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) throw new Error("Zoom Server-to-Server OAuth credentials are incomplete.");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenUrl = new URL("https://zoom.us/oauth/token");
  tokenUrl.searchParams.set("grant_type", "account_credentials");
  tokenUrl.searchParams.set("account_id", accountId);
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.access_token !== "string") {
    throw new Error(typeof result.message === "string" ? result.message : "Zoom token request failed.");
  }
  return result.access_token as string;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "إنشاء اجتماعات Zoom متاح لإدارة المنصة فقط." }, { status: 403 });
  const hostUserId = process.env.ZOOM_HOST_USER_ID;
  if (!hostUserId) return NextResponse.json({ error: "أضف ZOOM_HOST_USER_ID لتحديد حساب مضيف الاجتماعات." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الاجتماع غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الاجتماع غير مكتملة." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const topic = typeof data.topic === "string" ? data.topic.trim().slice(0, 180) : "";
  const startTime = typeof data.startTime === "string" ? data.startTime : "";
  const duration = Number(data.durationMinutes);
  const parsedStart = Date.parse(startTime);
  if (!topic || !Number.isFinite(parsedStart) || parsedStart < Date.now() + 5 * 60 * 1000 ||
      !Number.isInteger(duration) || duration < 15 || duration > 480) {
    return NextResponse.json({ error: "حدد عنوان الاجتماع وموعداً مستقبلياً بعد خمس دقائق ومدة من 15 إلى 480 دقيقة." }, { status: 400 });
  }

  try {
    const accessToken = await getZoomAccessToken();
    const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostUserId)}/meetings`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        type: 2,
        start_time: new Date(parsedStart).toISOString(),
        duration,
        timezone: process.env.ZOOM_TIMEZONE || "Africa/Cairo",
        settings: {
          join_before_host: false,
          waiting_room: true,
          participant_video: true,
          host_video: false,
        },
      }),
      cache: "no-store",
    });
    const meeting = await response.json().catch(() => ({}));
    if (!response.ok || typeof meeting.id === "undefined" || typeof meeting.join_url !== "string") {
      console.error("Zoom meeting creation failed", { status: response.status, code: meeting.code, message: meeting.message });
      return NextResponse.json({ error: "رفض Zoom إنشاء الاجتماع. تحقق من نطاقات التطبيق وصلاحية المضيف." }, { status: 502 });
    }

    const record = {
      provider: "zoom",
      meetingId: String(meeting.id),
      topic,
      startTime: new Date(parsedStart),
      durationMinutes: duration,
      timezone: process.env.ZOOM_TIMEZONE || "Africa/Cairo",
      joinUrl: meeting.join_url,
      hostStartUrl: typeof meeting.start_url === "string" ? meeting.start_url : "",
      createdAt: new Date(),
      createdBy: "platform-admin",
      status: "scheduled",
    };
    const db = await getClinicalDatabase();
    await db.collection("platform_zoom_meetings").insertOne(record);
    return NextResponse.json({
      success: true,
      meeting: {
        meetingId: record.meetingId,
        topic,
        startTime: record.startTime,
        durationMinutes: duration,
        joinUrl: record.joinUrl,
        timezone: record.timezone,
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Zoom meeting integration failed", error);
    return NextResponse.json({ error: "تعذر الاتصال بخدمة Zoom أو قاعدة البيانات. راجع إعدادات الخادم." }, { status: 503 });
  }
}
