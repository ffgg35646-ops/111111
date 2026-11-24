import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { recordSecurityEvent } from "@/lib/platform-security";
import {
  issuePlatformSession, parsePasswordHash, PLATFORM_DEVICE_COOKIE, PLATFORM_SESSION_COOKIE,
  PLATFORM_ROLES, platformDeviceCookieOptions, platformSessionCookieOptions,
  verifyPasswordHash, verifyStoredPassword, type PlatformRole,
} from "@/lib/platform-auth";

export const runtime = "nodejs";
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 7;
const validUuid = (value: string | undefined) => Boolean(value && /^[0-9a-f-]{36}$/i.test(value));
const maxDevices = () => Math.max(1, Math.min(5, Number.parseInt(process.env.PLATFORM_MAX_DEVICES || "2", 10) || 2));
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر تسجيل الدخول غير مسموح." }, { status: 403 });

  const address = (request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
  const nowMs = Date.now();
  const attempt = attempts.get(address);
  if (attempt && attempt.resetAt > nowMs && attempt.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "محاولات كثيرة لتسجيل الدخول. انتظر 15 دقيقة ثم حاول مجدداً." }, {
      status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil((attempt.resetAt - nowMs) / 1000)) },
    });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات تسجيل الدخول غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل البريد الإلكتروني وكلمة المرور." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const email = clean(data.email, 180).toLowerCase();
  const password = typeof data.password === "string" ? data.password.slice(0, 256) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1) {
    return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيح." }, { status: 400 });
  }

  let account: Record<string, unknown> | null = null;
  let db: Awaited<ReturnType<typeof getClinicalDatabase>> | null = null;
  let databaseUnavailable = false;
  try {
    db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    await users.createIndex({ email: 1 }, { unique: true });
    account = await users.findOne({ email });
    if (!account) {
      const adminEmail = (process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
      const adminHash = process.env.PLATFORM_ADMIN_PASSWORD_HASH || "";
      const parsedHash = parsePasswordHash(adminHash);
      if (email === adminEmail && parsedHash && verifyPasswordHash(password, adminHash)) {
        const bootstrap = {
          userId: randomUUID(), email, name: "مدير النظام", role: "admin" as PlatformRole,
          status: "active", passwordSalt: parsedHash.salt, passwordHash: parsedHash.hash,
          createdAt: new Date(), createdBy: "environment-bootstrap", mustChangePassword: false,
        };
        await users.updateOne({ email }, { $setOnInsert: bootstrap }, { upsert: true });
        account = await users.findOne({ email });
      }
    }
  } catch (error) {
    databaseUnavailable = true;
    console.error("Platform account database is unavailable", error);
  }

  if (!account && databaseUnavailable) return NextResponse.json({ error: "تعذر الاتصال بقاعدة حسابات المنصة. تحقق من MONGODB_URI ثم أعد المحاولة." }, { status: 503 });

  const validAccount = Boolean(account &&
    account.status === "active" &&
    typeof account.userId === "string" &&
    typeof account.email === "string" &&
    typeof account.name === "string" &&
    typeof account.role === "string" &&
    PLATFORM_ROLES.includes(account.role as PlatformRole) &&
    verifyStoredPassword(password, String(account.passwordSalt || ""), String(account.passwordHash || "")));

  if (!validAccount || !account) {
    const current = attempts.get(address);
    attempts.set(address, current && current.resetAt > nowMs
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: nowMs + WINDOW_MS });
    if (db) await recordSecurityEvent(db, { action: "login_failed", request, metadata: { reason: "invalid_credentials" } });
    return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيح، أو أن الحساب غير نشط." }, {
      status: 401, headers: { "Cache-Control": "no-store" },
    });
  }

  if (!db) return NextResponse.json({ error: "تعذر إنشاء جلسة آمنة. حاول مجدداً." }, { status: 503 });
  const user = {
    userId: String(account.userId), email: String(account.email), name: String(account.name),
    role: account.role as PlatformRole, mustChangePassword: account.mustChangePassword === true,
  };

  try {
    const now = new Date();
    const deviceCookie = request.cookies.get(PLATFORM_DEVICE_COOKIE)?.value;
    const deviceId = validUuid(deviceCookie) ? deviceCookie! : randomUUID();
    const sessions = db.collection("platform_sessions");
    await sessions.createIndex({ sessionId: 1 }, { unique: true });
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await sessions.createIndex({ userId: 1, status: 1, expiresAt: 1 });

    await sessions.updateMany(
      { userId: user.userId, deviceId, status: "active" },
      { $set: { status: "replaced", replacedAt: now, closedAt: now } },
    );
    const activeDevices = await sessions.distinct("deviceId", {
      userId: user.userId, status: "active", expiresAt: { $gt: now },
    }) as string[];
    if (!activeDevices.includes(deviceId) && activeDevices.length >= maxDevices()) {
      await recordSecurityEvent(db, {
        action: "login_blocked_device_limit", actorUserId: user.userId, request,
        metadata: { activeDeviceCount: activeDevices.length, allowedDeviceCount: maxDevices() },
      });
      return NextResponse.json({
        error: "وصل حسابك إلى الحد الأقصى للأجهزة (" + maxDevices() + "). سجّل الدخول من جهاز نشط وافتح «أمان الحساب» لإنهاء جلسة جهاز آخر.",
        code: "device_limit_reached",
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    await sessions.insertOne({
      sessionId, userId: user.userId, deviceId, userAgent: request.headers.get("user-agent")?.slice(0, 240) || "",
      status: "active", createdAt: now, lastSeenAt: now, expiresAt, ipAddressStored: false,
    });

    const token = await issuePlatformSession({ ...user, sessionId, deviceId });
    const response = NextResponse.json({
      success: true,
      user: { ...user, sessionId, sessionExpiresAt: expiresAt },
      security: { maxDevices: maxDevices(), activeDevices: activeDevices.length + (activeDevices.includes(deviceId) ? 0 : 1) },
    }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(PLATFORM_SESSION_COOKIE, token, platformSessionCookieOptions());
    if (!validUuid(deviceCookie)) response.cookies.set(PLATFORM_DEVICE_COOKIE, deviceId, platformDeviceCookieOptions());
    else response.cookies.set(PLATFORM_DEVICE_COOKIE, deviceId, platformDeviceCookieOptions());

    attempts.delete(address);
    await db.collection("platform_users").updateOne({ userId: user.userId }, { $set: { lastLoginAt: now } });
    await recordSecurityEvent(db, {
      action: "login_succeeded", actorUserId: user.userId, request,
      metadata: { sessionId, deviceId, role: user.role },
    });
    return response;
  } catch (error) {
    console.error("Unable to issue registered platform session", error);
    return NextResponse.json({ error: "تعذر إنشاء جلسة آمنة. تحقق من إعداد قاعدة البيانات وسر الجلسات." }, { status: 503 });
  }
}
