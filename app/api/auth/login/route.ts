import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import {
  issuePlatformSession,
  parsePasswordHash,
  PLATFORM_SESSION_COOKIE,
  PLATFORM_ROLES,
  platformSessionCookieOptions,
  verifyPasswordHash,
  verifyStoredPassword,
  type PlatformRole,
} from "@/lib/platform-auth";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 7;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "مصدر تسجيل الدخول غير مسموح." }, { status: 403 });
  }

  const address = (request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim();
  const now = Date.now();
  const attempt = attempts.get(address);
  if (attempt && attempt.resetAt > now && attempt.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "محاولات كثيرة لتسجيل الدخول. انتظر 15 دقيقة ثم حاول مجدداً." }, {
      status: 429,
      headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil((attempt.resetAt - now) / 1000)) },
    });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات تسجيل الدخول غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "أدخل البريد الإلكتروني وكلمة المرور." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const email = clean(data.email, 180).toLowerCase();
  const password = typeof data.password === "string" ? data.password.slice(0, 256) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1) {
    return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيح." }, { status: 400 });
  }

  let account: Record<string, unknown> | null = null;
  let databaseUnavailable = false;
  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    await users.createIndex({ email: 1 }, { unique: true });
    account = await users.findOne({ email });
    if (!account) {
      const adminEmail = (process.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
      const adminHash = process.env.PLATFORM_ADMIN_PASSWORD_HASH || "";
      const parsedHash = parsePasswordHash(adminHash);
      if (email === adminEmail && parsedHash && verifyPasswordHash(password, adminHash)) {
        const bootstrap = {
          userId: randomUUID(),
          email,
          name: "مدير المنصة",
          role: "admin" as PlatformRole,
          status: "active",
          passwordSalt: parsedHash.salt,
          passwordHash: parsedHash.hash,
          createdAt: new Date(),
          createdBy: "environment-bootstrap",
          mustChangePassword: false,
        };
        await users.updateOne({ email }, { $setOnInsert: bootstrap }, { upsert: true });
        account = await users.findOne({ email });
      }
    }
  } catch (error) {
    databaseUnavailable = true;
    console.error("Platform account database is unavailable", error);
  }

  if (!account && databaseUnavailable) {
    return NextResponse.json({ error: "تعذر الاتصال بقاعدة حسابات المنصة. تحقق من MONGODB_URI ثم أعد المحاولة." }, { status: 503 });
  }

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
    attempts.set(address, current && current.resetAt > now
      ? { count: current.count + 1, resetAt: current.resetAt }
      : { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيح، أو أن الحساب غير نشط." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  attempts.delete(address);
  try {
    const user = {
      userId: String(account.userId),
      email: String(account.email),
      name: String(account.name),
      role: account.role as PlatformRole,
      mustChangePassword: account.mustChangePassword === true,
    };
    const token = await issuePlatformSession(user);
    const response = NextResponse.json({ success: true, user }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(PLATFORM_SESSION_COOKIE, token, platformSessionCookieOptions());
    if (user.userId !== "environment-admin") {
      try {
        const db = await getClinicalDatabase();
        await db.collection("platform_users").updateOne({ userId: user.userId }, { $set: { lastLoginAt: new Date() } });
      } catch (error) {
        console.warn("Unable to record platform last login", error);
      }
    }
    return response;
  } catch (error) {
    console.error("Unable to issue platform session", error);
    return NextResponse.json({ error: "إعداد جلسات المنصة غير مكتمل. أضف PLATFORM_SESSION_SECRET بطول 32 حرفاً على الأقل." }, { status: 503 });
  }
}
