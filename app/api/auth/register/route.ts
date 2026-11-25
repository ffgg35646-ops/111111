import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { createPasswordHash } from "@/lib/platform-auth";
import { createEmailCode, sendPlatformCode } from "@/lib/platform-email";

export const runtime = "nodejs";
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codeHash = (email: string, code: string) => createHash("sha256").update(email + ":" + code + ":" + (process.env.PLATFORM_SESSION_SECRET || "")).digest("hex");

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات التسجيل غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل بيانات التسجيل." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const firstName = clean(data.firstName, 60);
  const fatherName = clean(data.fatherName, 60);
  const username = clean(data.username, 30).toLowerCase();
  const email = clean(data.email, 180).toLowerCase();
  const password = typeof data.password === "string" ? data.password : "";
  const confirmPassword = typeof data.confirmPassword === "string" ? data.confirmPassword : "";
  if (firstName.length < 2 || fatherName.length < 2 || !/^[a-z0-9_]{3,30}$/.test(username) || !emailPattern.test(email)) {
    return NextResponse.json({ error: "تحقق من الاسم واسم الأب واسم المستخدم والبريد الإلكتروني." }, { status: 400 });
  }
  if (password.length < 12 || password.length > 256) return NextResponse.json({ error: "كلمة المرور يجب ألا تقل عن 12 حرفاً." }, { status: 400 });
  if (password !== confirmPassword) return NextResponse.json({ error: "كلمتا المرور غير متطابقتين." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ username: 1 }, { unique: true, sparse: true });
    const existing = await users.findOne({ $or: [{ email }, { username }] }, { projection: { _id: 0, email: 1, username: 1, emailVerified: 1 } });
    if (existing?.email === email && existing.emailVerified === true) return NextResponse.json({ error: "البريد الإلكتروني مسجل بالفعل." }, { status: 409 });
    if (existing?.username === username && existing.email !== email) return NextResponse.json({ error: "اسم المستخدم مستخدم بالفعل." }, { status: 409 });

    const now = new Date();
    const passwordParts = createPasswordHash(password).split("$");
    const userId = randomUUID();
    const name = firstName + " " + fatherName;
    await users.updateOne({ email, role: "trainee" }, {
      $set: {
        userId, firstName, fatherName, name, username, email, role: "trainee",
        status: "pending_verification", emailVerified: false,
        passwordSalt: passwordParts[1], passwordHash: passwordParts[2],
        updatedAt: now, registrationUpdatedAt: now,
      },
      $setOnInsert: { createdAt: now, createdBy: "self_registration" },
    }, { upsert: true });

    const code = createEmailCode();
    const codes = db.collection("platform_email_codes");
    await codes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await codes.updateOne({ email, purpose: "verify" }, {
      $set: { email, userId, purpose: "verify", codeHash: codeHash(email, code), attempts: 0, createdAt: now, expiresAt: new Date(now.getTime() + 10 * 60 * 1000) },
    }, { upsert: true });
    try { await sendPlatformCode(email, code, "verify"); }
    catch {
      await users.updateOne({ userId, emailVerified: false }, { $set: { status: "pending_email_delivery" } });
      return NextResponse.json({ error: "تعذر إرسال رمز التأكيد. تحقق من إعداد خدمة البريد الإلكتروني ثم أعد المحاولة." }, { status: 503 });
    }
    return NextResponse.json({ success: true, email, message: "تم إرسال رمز التأكيد إلى بريدك الإلكتروني." }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Self registration failed", error);
    return NextResponse.json({ error: "تعذر إنشاء الحساب. قد يكون البريد أو اسم المستخدم مسجلاً بالفعل." }, { status: 503 });
  }
}
