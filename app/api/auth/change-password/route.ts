import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import {
  createPasswordHash,
  issuePlatformSession,
  parsePasswordHash,
  platformSessionCookieOptions,
  PLATFORM_SESSION_COOKIE,
  readPlatformSession,
  verifyStoredPassword,
} from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await readPlatformSession(request);
  if (!session) return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات تغيير كلمة المرور غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "أدخل كلمة المرور الحالية والجديدة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const currentPassword = typeof data.currentPassword === "string" ? data.currentPassword.slice(0, 256) : "";
  const newPassword = typeof data.newPassword === "string" ? data.newPassword : "";
  if (newPassword.length < 12 || newPassword.length > 256) {
    return NextResponse.json({ error: "يجب أن تكون كلمة المرور الجديدة من 12 إلى 256 حرفاً." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    const account = await users.findOne({ userId: session.userId });
    if (!account) {
      return NextResponse.json({ error: "تعذر العثور على حسابك في قاعدة البيانات. أعد تسجيل الدخول بعد التأكد من إعداد قاعدة الحسابات." }, { status: 404 });
    }
    if (!verifyStoredPassword(currentPassword, String(account.passwordSalt || ""), String(account.passwordHash || ""))) {
      return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة." }, { status: 401 });
    }

    const encoded = createPasswordHash(newPassword);
    const parsed = parsePasswordHash(encoded);
    if (!parsed) return NextResponse.json({ error: "تعذر إنشاء كلمة المرور الجديدة." }, { status: 500 });
    await users.updateOne({ userId: session.userId }, {
      $set: {
        passwordSalt: parsed.salt,
        passwordHash: parsed.hash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    const nextSession = await issuePlatformSession({ ...session, mustChangePassword: false });
    const response = NextResponse.json({ success: true, message: "تم تحديث كلمة المرور بنجاح." }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(PLATFORM_SESSION_COOKIE, nextSession, platformSessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Unable to change platform password", error);
    return NextResponse.json({ error: "تعذر تحديث كلمة المرور. تحقق من اتصال قاعدة البيانات." }, { status: 503 });
  }
}
