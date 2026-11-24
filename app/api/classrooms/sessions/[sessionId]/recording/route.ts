import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { recordSecurityEvent, trustedZoomUrl, verifyClassroomAccessToken } from "@/lib/platform-security";
export const runtime = "nodejs";
type Context = { params: Promise<{ sessionId: string }> };
export async function GET(request: NextRequest, context: Context) {
  const actor = await requirePlatformRole(request, ["trainee"]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول بحساب المتدرب." }, { status: 401 });
  const { sessionId } = await context.params;
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: "رابط الوصول غير صالح." }, { status: 404 });
  try {
    const grant = await verifyClassroomAccessToken(token);
    if (!grant || grant.userId !== actor.userId || grant.sessionId !== sessionId || grant.action !== "recording") return NextResponse.json({ error: "انتهت صلاحية الرابط. حدّث قائمة جلساتك للحصول على رابط جديد." }, { status: 401 });
    const db = await getClinicalDatabase();
    const session = await db.collection("platform_classroom_sessions").findOne({ sessionId, status: { $ne: "cancelled" } }, { projection: { _id: 0, courseId: 1, joinUrl: 1, recordingUrl: 1, recordingAllowed: 1, recordingStatus: 1 } });
    if (!session) return NextResponse.json({ error: "الجلسة غير موجودة أو ملغاة." }, { status: 404 });
    const enrollment = await db.collection("platform_requests").findOne({ email: actor.email.toLowerCase(), courseId: session.courseId, kind: "classroom_registration", status: "approved", paymentStatus: "paid" }, { projection: { _id: 1 } });
    if (!enrollment) return NextResponse.json({ error: "لم يعد حسابك مخولاً لدخول هذه الجلسة." }, { status: 403 });
    const target = session.recordingAllowed === true && session.recordingStatus === "published" ? trustedZoomUrl(session.recordingUrl) : "";
    if (!target) return NextResponse.json({ error: "المحتوى غير متاح أو لم يتم نشر التسجيل." }, { status: 404 });
    await recordSecurityEvent(db, { action: "classroom_recording_accessed", actorUserId: actor.userId, targetId: sessionId, request });
    return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { console.error("Temporary classroom access failed", error); return NextResponse.json({ error: "تعذر التحقق من رابط الوصول المؤقت." }, { status: 503 }); }
}
