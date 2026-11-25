import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { issuePlatformSession, PLATFORM_DEVICE_COOKIE, PLATFORM_SESSION_COOKIE, platformDeviceCookieOptions, platformSessionCookieOptions, type PlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";
const hash = (email: string, code: string) => createHash("sha256").update(email + ":" + code + ":" + (process.env.PLATFORM_SESSION_SECRET || "")).digest("hex");
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات التأكيد غير صالحة." }, { status: 400 }); }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase().slice(0, 180) : "";
  const code = typeof data.code === "string" ? data.code.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "أدخل البريد الإلكتروني ورمز التأكيد المكوّن من 6 أرقام." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const codes = db.collection("platform_email_codes");
    const record = await codes.findOne({ email, purpose: "verify", expiresAt: { $gt: new Date() } });
    if (!record || Number(record.attempts || 0) >= 5) return NextResponse.json({ error: "رمز التأكيد غير صالح أو انتهت صلاحيته." }, { status: 400 });
    if (record.codeHash !== hash(email, code)) {
      await codes.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      return NextResponse.json({ error: "رمز التأكيد غير صحيح." }, { status: 400 });
    }
    const users = db.collection("platform_users");
    const account = await users.findOne({ email, userId: record.userId, role: "trainee", emailVerified: false });
    if (!account) return NextResponse.json({ error: "الحساب غير موجود أو تم تأكيده بالفعل." }, { status: 404 });
    const now = new Date();
    await users.updateOne({ userId: account.userId }, { $set: { emailVerified: true, status: "active", emailVerifiedAt: now } });
    await codes.deleteMany({ email });
    const deviceId = randomUUID(), sessionId = randomUUID();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    await db.collection("platform_sessions").createIndex({ sessionId: 1 }, { unique: true });
    await db.collection("platform_sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("platform_sessions").insertOne({ sessionId, userId: String(account.userId), deviceId, userAgent: request.headers.get("user-agent")?.slice(0, 240) || "", status: "active", createdAt: now, lastSeenAt: now, expiresAt, ipAddressStored: false });
    const sessionToken = await issuePlatformSession({ userId: String(account.userId), email, name: String(account.name), role: "trainee" as PlatformRole, sessionId, deviceId });
    const response = NextResponse.json({ success: true, user: { userId: account.userId, name: account.name, email, role: "trainee" } }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(PLATFORM_SESSION_COOKIE, sessionToken, platformSessionCookieOptions());
    response.cookies.set(PLATFORM_DEVICE_COOKIE, deviceId, platformDeviceCookieOptions());
    return response;
  } catch (error) {
    console.error("Email verification failed", error);
    return NextResponse.json({ error: "تعذر تأكيد البريد الإلكتروني." }, { status: 503 });
  }
}
