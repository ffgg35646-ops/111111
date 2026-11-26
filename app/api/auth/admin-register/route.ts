import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { createPasswordHash } from "@/lib/platform-auth";
import { createEmailCode, sendPlatformCode } from "@/lib/platform-email";

export const runtime = "nodejs";
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const codeHash = (email: string, code: string) => createHash("sha256").update(email + ":" + code + ":" + (process.env.PLATFORM_SESSION_SECRET || "")).digest("hex");
const SETUP_LOCK_ID = "first-system-admin";
const SETUP_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات إنشاء الحساب غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل بيانات المدير." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const name = clean(data.name, 100);
  const email = clean(data.email, 180).toLowerCase();
  const password = typeof data.password === "string" ? data.password : "";
  const confirmPassword = typeof data.confirmPassword === "string" ? data.confirmPassword : "";
  if (name.length < 2 || !emailPattern.test(email)) return NextResponse.json({ error: "تحقق من الاسم والبريد الإلكتروني." }, { status: 400 });
  if (password.length < 12 || password.length > 256) return NextResponse.json({ error: "كلمة المرور يجب أن تكون من 12 إلى 256 حرفاً." }, { status: 400 });
  if (password !== confirmPassword) return NextResponse.json({ error: "كلمتا المرور غير متطابقتين." }, { status: 400 });

  // Environment-based bootstrap credentials take precedence over public first-admin setup.
  if (process.env.PLATFORM_ADMIN_EMAIL?.trim() && process.env.PLATFORM_ADMIN_PASSWORD_HASH?.trim()) {
    return NextResponse.json({ error: "تم إعداد بيانات المدير من إعدادات النظام. سجّل الدخول بحساب المدير الموجود." }, { status: 409 });
  }

  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    await users.createIndex({ email: 1 }, { unique: true });
    const existingAdmin = await users.findOne({ role: "admin" }, { projection: { _id: 0, userId: 1 } });
    if (existingAdmin) return NextResponse.json({ error: "تم إنشاء حساب مدير النظام بالفعل. استخدم تسجيل دخول الإدارة أو اطلب من المدير الحالي إنشاء حساب لك." }, { status: 409 });

    const existingAccount = await users.findOne({ email }, { projection: { _id: 0, userId: 1, role: 1, status: 1 } });
    const locks = db.collection("platform_setup_locks");
    await locks.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    const now = new Date();
    await locks.deleteOne({ _id: SETUP_LOCK_ID, expiresAt: { $lte: now } });

    let lock = await locks.findOne({ _id: SETUP_LOCK_ID, expiresAt: { $gt: now } });
    if (lock && lock.email !== email) {
      return NextResponse.json({ error: "هناك طلب إعداد مدير أول قيد التأكيد. استخدم البريد الذي بدأ الطلب أو أعد المحاولة بعد انتهاء مهلة الطلب." }, { status: 409 });
    }
    if (existingAccount && (!lock || existingAccount.userId !== lock.userId || existingAccount.role !== "admin" || existingAccount.status !== "pending_verification")) {
      return NextResponse.json({ error: "هذا البريد مرتبط بحساب موجود بالفعل. استخدم تسجيل الدخول أو بريداً آخر." }, { status: 409 });
    }

    if (!lock) {
      const userId = randomUUID();
      try {
        await locks.insertOne({
          _id: SETUP_LOCK_ID, email, userId, purpose: "first_system_admin",
          createdAt: now, expiresAt: new Date(now.getTime() + SETUP_WINDOW_MS),
        });
        lock = { _id: SETUP_LOCK_ID, email, userId, purpose: "first_system_admin", createdAt: now, expiresAt: new Date(now.getTime() + SETUP_WINDOW_MS) };
      } catch {
        return NextResponse.json({ error: "بدأ طلب إعداد أول مدير للتو. أعد المحاولة بعد لحظات." }, { status: 409 });
      }
    }

    const userId = String(lock.userId);
    const passwordParts = createPasswordHash(password).split("$");
    await users.updateOne(
      { userId },
      {
        $set: {
          userId, name, email, role: "admin", status: "pending_verification",
          emailVerified: false, registrationSource: "first_admin_setup",
          passwordSalt: passwordParts[1], passwordHash: passwordParts[2],
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now, createdBy: "first_admin_setup" },
      },
      { upsert: true },
    );

    const code = createEmailCode();
    const codes = db.collection("platform_email_codes");
    await codes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await codes.updateOne(
      { email, purpose: "verify_admin" },
      { $set: { email, userId, purpose: "verify_admin", codeHash: codeHash(email, code), attempts: 0, createdAt: now, expiresAt: new Date(now.getTime() + 10 * 60 * 1000) } },
      { upsert: true },
    );

    try {
      await sendPlatformCode(email, code, "verify");
    } catch {
      return NextResponse.json({ error: "تعذر إرسال رمز التأكيد. تحقق من إعداد البريد الإلكتروني ثم أعد المحاولة بنفس البريد خلال مهلة الإعداد." }, { status: 503 });
    }

    return NextResponse.json({ success: true, email, message: "أرسلنا رمز تأكيد البريد. بعد التأكيد سيتم فتح لوحة الإدارة مباشرة." }, {
      status: 201, headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("First admin registration failed", error);
    return NextResponse.json({ error: "تعذر إنشاء حساب المدير. تحقق من اتصال قاعدة البيانات وإعداد البريد." }, { status: 503 });
  }
}
