import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { createEmailCode, sendPlatformCode } from "@/lib/platform-email";
export const runtime = "nodejs";
const hash = (email: string, code: string) => createHash("sha256").update(email + ":" + code + ":" + (process.env.PLATFORM_SESSION_SECRET || "")).digest("hex");
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 }); }
  const email = body && typeof body === "object" && typeof (body as Record<string, unknown>).email === "string" ? String((body as Record<string, unknown>).email).trim().toLowerCase().slice(0, 180) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "أدخل بريداً إلكترونياً صحيحاً." }, { status: 400 });
  try {
    const db = await getClinicalDatabase(), users = db.collection("platform_users");
    const account = await users.findOne({ email, role: "trainee", registrationSource: "self_registration", emailVerified: false }, { projection: { _id: 0, userId: 1 } });
    if (!account) return NextResponse.json({ success: true, message: "إذا كان الحساب بانتظار التأكيد، فسيصلك رمز جديد." });
    const codes = db.collection("platform_email_codes");
    const previous = await codes.findOne({ email, purpose: "verify" });
    if (previous?.createdAt && Date.now() - new Date(previous.createdAt).getTime() < 60_000) return NextResponse.json({ error: "انتظر دقيقة قبل طلب رمز جديد." }, { status: 429 });
    const code = createEmailCode(), now = new Date();
    await codes.updateOne({ email, purpose: "verify" }, { $set: { email, userId: account.userId, purpose: "verify", codeHash: hash(email, code), attempts: 0, createdAt: now, expiresAt: new Date(now.getTime() + 10 * 60 * 1000) } }, { upsert: true });
    await sendPlatformCode(email, code, "verify");
    await users.updateOne({ userId: account.userId }, { $set: { status: "pending_verification" } });
    return NextResponse.json({ success: true, message: "تم إرسال رمز تأكيد جديد." });
  } catch (error) {
    console.error("Resend verification failed", error);
    return NextResponse.json({ error: "تعذر إرسال رمز التأكيد." }, { status: 503 });
  }
}
