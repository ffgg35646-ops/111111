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
    const db = await getClinicalDatabase();
    const account = await db.collection("platform_users").findOne({ email, role: "trainee", status: "active", emailVerified: true }, { projection: { _id: 0, userId: 1 } });
    if (account) {
      const code = createEmailCode(), now = new Date(), codes = db.collection("platform_email_codes");
      await codes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await codes.updateOne({ email, purpose: "reset" }, { $set: { email, userId: account.userId, purpose: "reset", codeHash: hash(email, code), attempts: 0, createdAt: now, expiresAt: new Date(now.getTime() + 10 * 60 * 1000) } }, { upsert: true });
      await sendPlatformCode(email, code, "reset");
    }
    return NextResponse.json({ success: true, message: "إذا كان البريد مرتبطاً بحساب نشط، فسيصلك رمز استعادة خلال لحظات." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Password reset code delivery failed", error);
    return NextResponse.json({ error: "تعذر إرسال رمز الاستعادة. تحقق من إعداد خدمة البريد الإلكتروني." }, { status: 503 });
  }
}
