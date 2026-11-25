import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { createPasswordHash } from "@/lib/platform-auth";
export const runtime = "nodejs";
const hash = (email: string, code: string) => createHash("sha256").update(email + ":" + code + ":" + (process.env.PLATFORM_SESSION_SECRET || "")).digest("hex");
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الاستعادة غير صالحة." }, { status: 400 }); }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase().slice(0, 180) : "";
  const code = typeof data.code === "string" ? data.code.trim() : "";
  const password = typeof data.password === "string" ? data.password : "";
  const confirmPassword = typeof data.confirmPassword === "string" ? data.confirmPassword : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "تحقق من البريد ورمز الاستعادة." }, { status: 400 });
  if (password.length < 12 || password.length > 256 || password !== confirmPassword) return NextResponse.json({ error: password !== confirmPassword ? "كلمتا المرور غير متطابقتين." : "كلمة المرور يجب ألا تقل عن 12 حرفاً." }, { status: 400 });
  try {
    const db = await getClinicalDatabase(), codes = db.collection("platform_email_codes");
    const record = await codes.findOne({ email, purpose: "reset", expiresAt: { $gt: new Date() } });
    if (!record || Number(record.attempts || 0) >= 5) return NextResponse.json({ error: "رمز الاستعادة غير صالح أو انتهت صلاحيته." }, { status: 400 });
    if (record.codeHash !== hash(email, code)) {
      await codes.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      return NextResponse.json({ error: "رمز الاستعادة غير صحيح." }, { status: 400 });
    }
    const encoded = createPasswordHash(password).split("$"), now = new Date();
    const updated = await db.collection("platform_users").updateOne(
      { userId: record.userId, email, status: "active", $or: [{ emailVerified: true }, { registrationSource: { $ne: "self_registration" } }] },
      { $set: { passwordSalt: encoded[1], passwordHash: encoded[2], passwordChangedAt: now, updatedAt: now, mustChangePassword: false } },
    );
    if (!updated.modifiedCount) return NextResponse.json({ error: "الحساب غير متاح لإعادة تعيين كلمة المرور." }, { status: 404 });
    await Promise.all([
      codes.deleteMany({ email }),
      db.collection("platform_sessions").updateMany({ userId: record.userId, status: "active" }, { $set: { status: "revoked", revokedAt: now, revokeReason: "password_reset" } }),
    ]);
    return NextResponse.json({ success: true, message: "تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Password reset failed", error);
    return NextResponse.json({ error: "تعذر تحديث كلمة المرور." }, { status: 503 });
  }
}
