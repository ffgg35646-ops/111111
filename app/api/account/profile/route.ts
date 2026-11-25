import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime = "nodejs";
const roles = ["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"] as const;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...roles]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  try {
    const db = await getClinicalDatabase();
    const account = await db.collection("platform_users").findOne({ userId: actor.userId }, { projection: { _id: 0, firstName: 1, fatherName: 1, name: 1, username: 1, email: 1, emailVerified: 1 } });
    if (!account) return NextResponse.json({ error: "الحساب غير موجود." }, { status: 404 });
    const profile = await db.collection("etzan_account_profiles").findOne({ userId: actor.userId }, { projection: { _id: 0, avatarDataUrl: 1, phone: 1, city: 1, bio: 1, updatedAt: 1 } });
    return NextResponse.json({ profile: { ...account, avatarDataUrl: profile?.avatarDataUrl || "", phone: profile?.phone || "", city: profile?.city || "", bio: profile?.bio || "" } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Account profile GET", error);
    return NextResponse.json({ error: "تعذر تحميل بيانات الحساب." }, { status: 503 });
  }
}
export async function PATCH(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...roles]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الملف غير صالحة." }, { status: 400 }); }
  const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const firstName = clean(data.firstName, 60), fatherName = clean(data.fatherName, 60);
  const username = clean(data.username, 30).toLowerCase();
  if (firstName.length < 2 || fatherName.length < 2 || !/^[a-z0-9_]{3,30}$/.test(username)) return NextResponse.json({ error: "تحقق من الاسم واسم الأب واسم المستخدم (3 إلى 30 حرفاً إنجليزياً أو رقماً)." }, { status: 400 });
  const avatarDataUrl = typeof data.avatarDataUrl === "string" ? data.avatarDataUrl : "";
  if (avatarDataUrl && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatarDataUrl) || avatarDataUrl.length > 1_500_000)) {
    return NextResponse.json({ error: "الصورة غير صالحة أو أكبر من الحجم المسموح (1 ميجابايت)." }, { status: 400 });
  }
  try {
    const db = await getClinicalDatabase(), users = db.collection("platform_users");
    const duplicate = await users.findOne({ username, userId: { $ne: actor.userId } }, { projection: { _id: 1 } });
    if (duplicate) return NextResponse.json({ error: "اسم المستخدم مستخدم بالفعل." }, { status: 409 });
    const now = new Date();
    await users.updateOne({ userId: actor.userId }, { $set: { firstName, fatherName, name: firstName + " " + fatherName, username, updatedAt: now } });
    await db.collection("etzan_account_profiles").updateOne({ userId: actor.userId }, {
      $set: { userId: actor.userId, avatarDataUrl, phone: clean(data.phone, 30), city: clean(data.city, 80), bio: clean(data.bio, 500), updatedAt: now },
      $setOnInsert: { createdAt: now },
    }, { upsert: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account profile PATCH", error);
    return NextResponse.json({ error: "تعذر حفظ الملف. تحقق من اسم المستخدم أو اتصال قاعدة البيانات." }, { status: 503 });
  }
}
