import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { PLATFORM_ROLES, requirePlatformRole } from "@/lib/platform-auth";
import { recordSecurityEvent } from "@/lib/platform-security";

export const runtime = "nodejs";
const sameOrigin = (request: NextRequest) => !request.headers.get("origin") || request.headers.get("origin") === request.nextUrl.origin;

function labelAgent(value: unknown) {
  const ua = typeof value === "string" ? value : "";
  const platform = /iPhone|iPad/i.test(ua) ? "iPhone / iPad"
    : /Android/i.test(ua) ? "Android"
    : /Windows/i.test(ua) ? "Windows"
    : /Macintosh|Mac OS/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux" : "متصفح غير محدد";
  const browser = /Edg\//i.test(ua) ? "Edge"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Safari\//i.test(ua) ? "Safari" : "Browser";
  return platform + " · " + browser;
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...PLATFORM_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول لعرض أجهزتك." }, { status: 401 });
  try {
    const db = await getClinicalDatabase();
    const now = new Date();
    const sessions = await db.collection("platform_sessions").find(
      { userId: actor.userId, status: "active", expiresAt: { $gt: now } },
      { projection: { _id: 0, sessionId: 1, deviceId: 1, userAgent: 1, createdAt: 1, lastSeenAt: 1, expiresAt: 1 } },
    ).sort({ lastSeenAt: -1 }).limit(20).toArray();
    return NextResponse.json({
      sessions: sessions.map((item) => ({
        sessionId: item.sessionId,
        deviceLabel: labelAgent(item.userAgent),
        createdAt: item.createdAt,
        lastSeenAt: item.lastSeenAt,
        expiresAt: item.expiresAt,
        current: item.sessionId === actor.sessionId,
      })),
      maxDevices: Math.max(1, Math.min(5, Number.parseInt(process.env.PLATFORM_MAX_DEVICES || "2", 10) || 2)),
      activeDevices: new Set(sessions.map((item) => item.deviceId)).size,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Account devices GET", error);
    return NextResponse.json({ error: "تعذر تحميل الجلسات النشطة." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...PLATFORM_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات إنهاء الجلسة غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "حدد الجهاز المطلوب إنهاء جلسته." }, { status: 400 });
  const sessionId = typeof (body as Record<string, unknown>).sessionId === "string" ? String((body as Record<string, unknown>).sessionId).trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || sessionId === actor.sessionId) return NextResponse.json({ error: "اختر جلسة جهاز آخر من القائمة." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("platform_sessions").updateOne(
      { sessionId, userId: actor.userId, status: "active" },
      { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "user_revoked_device" } },
    );
    if (!result.modifiedCount) return NextResponse.json({ error: "الجلسة غير نشطة أو غير موجودة." }, { status: 404 });
    await recordSecurityEvent(db, { action: "device_session_revoked", actorUserId: actor.userId, targetId: sessionId, request });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account device revocation failed", error);
    return NextResponse.json({ error: "تعذر إنهاء جلسة الجهاز." }, { status: 503 });
  }
}
