import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import {
  issuePlatformSession, platformDeviceAgentHash, platformDeviceCookieOptions,
  platformSessionCookieOptions, PLATFORM_DEVICE_COOKIE, PLATFORM_SESSION_COOKIE,
} from "@/lib/platform-auth";

export const runtime = "nodejs";
const SETUP_LOCK_ID = "first-system-admin";
const codeHash = (email: string, code: string) => createHash("sha256").update(email + ":" + code + ":" + (process.env.PLATFORM_SESSION_SECRET || "")).digest("hex");

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات التأكيد غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل البريد الإلكتروني ورمز التأكيد." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase().slice(0, 180) : "";
  const code = typeof data.code === "string" ? data.code.trim() : "";
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !/^\\d{6}$/.test(code)) {
    return NextResponse.json({ error: "أدخل بريداً إلكترونياً صحيحاً ورمزاً من 6 أرقام." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const now = new Date();
    const lock = await db.collection("platform_setup_locks").findOne({
      _id: SETUP_LOCK_ID, email, expiresAt: { $gt: now },
    });
    if (!lock || typeof lock.userId !== "string") {
      return NextResponse.json({ error: "انتهت مهلة إعداد المدير. ابدأ إنشاء الحساب من جديد." }, { status: 410 });
    }

    const codes = db.collection("platform_email_codes");
    const record = await codes.findOne({ email, userId: lock.userId, purpose: "verify_admin", expiresAt: { $gt: now } });
    if (!record || Number(record.attempts || 0) >= 5) {
      return NextResponse.json({ error: "رمز التأكيد غير صالح أو انتهت صلاحيته." }, { status: 400 });
    }
    if (record.codeHash !== codeHash(email, code)) {
      await codes.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      return NextResponse.json({ error: "رمز التأكيد غير صحيح." }, { status: 400 });
    }

    const users = db.collection("platform_users");
    const otherAdmin = await users.findOne({ role: "admin", userId: { $ne: lock.userId } }, { projection: { _id: 0, userId: 1 } });
    if (otherAdmin) {
      await codes.deleteMany({ email, purpose: "verify_admin" });
      await db.collection("platform_setup_locks").deleteOne({ setupKey: SETUP_LOCK_ID, userId: lock.userId });
      return NextResponse.json({ error: "تم إعداد مدير النظام بالفعل. لا يمكن إنشاء مدير أول آخر من التسجيل العام." }, { status: 409 });
    }

    const account = await users.findOne({
      userId: lock.userId, email, role: "admin", status: "pending_verification", emailVerified: false,
    });
    if (!account || typeof account.name !== "string") {
      return NextResponse.json({ error: "طلب إنشاء حساب المدير غير موجود أو انتهت صلاحيته." }, { status: 404 });
    }

    await users.updateOne(
      { userId: lock.userId, email, role: "admin", status: "pending_verification", emailVerified: false },
      { $set: { status: "active", emailVerified: true, emailVerifiedAt: now, updatedAt: now } },
    );
    const activeAccount = await users.findOne({ userId: lock.userId, email, role: "admin", status: "active", emailVerified: true });
    if (!activeAccount) return NextResponse.json({ error: "تعذر تفعيل حساب المدير. أعد المحاولة." }, { status: 409 });

    await codes.deleteMany({ email });
    await db.collection("platform_setup_locks").deleteOne({ _id: SETUP_LOCK_ID, userId: lock.userId });

    const deviceId = randomUUID();
    const sessionId = randomUUID();
    const deviceAgentHash = platformDeviceAgentHash(request);
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const sessions = db.collection("platform_sessions");
    await sessions.createIndex({ sessionId: 1 }, { unique: true });
    await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await sessions.createIndex({ userId: 1, status: 1, expiresAt: 1 });
    await sessions.insertOne({
      sessionId, userId: String(activeAccount.userId), deviceId, deviceAgentHash,
      userAgent: request.headers.get("user-agent")?.slice(0, 240) || "",
      status: "active", createdAt: now, lastSeenAt: now, expiresAt, ipAddressStored: false,
    });

    const user = {
      userId: String(activeAccount.userId), email, name: String(activeAccount.name), role: "admin" as const,
      sessionId, deviceId, deviceAgentHash, mustChangePassword: false,
    };
    const token = await issuePlatformSession(user);
    await db.collection("platform_audit_logs").insertOne({
      action: "first_system_admin_registered", actorUserId: user.userId, actorEmail: email, targetUserId: user.userId, targetEmail: email, targetRole: "admin", createdAt: now,
    }).catch((error) => console.warn("Unable to record first admin registration", error));

    const response = NextResponse.json({
      success: true, user: { userId: user.userId, name: user.name, email, role: "admin" },
      message: "تم تأكيد البريد وإنشاء حساب مدير النظام. جارٍ فتح لوحة الإدارة.",
    }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(PLATFORM_SESSION_COOKIE, token, platformSessionCookieOptions());
    response.cookies.set(PLATFORM_DEVICE_COOKIE, deviceId, platformDeviceCookieOptions());
    return response;
  } catch (error) {
    console.error("First admin email verification failed", error);
    return NextResponse.json({ error: "تعذر تأكيد البريد أو إنشاء جلسة المدير. تحقق من اتصال قاعدة البيانات وإعداد سر الجلسات." }, { status: 503 });
  }
}
