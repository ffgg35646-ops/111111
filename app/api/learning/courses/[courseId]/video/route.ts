import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { allowedCourseVideoUrl, recordSecurityEvent, verifyCourseVideoAccessToken } from "@/lib/platform-security";
import { approvedCourseEnrollmentFilter } from "@/lib/platform-course-access";
export const runtime = "nodejs";
export const maxDuration = 60;
type Context = { params: Promise<{ courseId: string }> };
async function resolveMedia(request: NextRequest, courseId: string) {
  const actor = await requirePlatformRole(request, ["trainee"]);
  if (!actor) return { response: NextResponse.json({ error: "سجّل الدخول بحساب المتدرب." }, { status: 401 }) };
  const token = request.nextUrl.searchParams.get("token") || "";
  try {
    const grant = await verifyCourseVideoAccessToken(token);
    if (!grant || grant.userId !== actor.userId || grant.courseId !== courseId) {
      return { response: NextResponse.json({ error: "انتهت صلاحية رابط الفيديو. جدّد الرابط من المشغل." }, { status: 401 }) };
    }
  } catch {
    return { response: NextResponse.json({ error: "انتهت صلاحية رابط الفيديو. جدّد الرابط من المشغل." }, { status: 401 }) };
  }
  if (!courses.some(c => c.id === courseId)) return { response: NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 }) };
  try {
    const db = await getClinicalDatabase();
    const enrollment = await db.collection("platform_requests").findOne(approvedCourseEnrollmentFilter(courseId, actor.email), { projection: { _id: 1 } });
    if (!enrollment) return { response: NextResponse.json({ error: "يلزم اعتماد الالتحاق وسداد رسوم الدورة قبل تشغيل الفيديو." }, { status: 403 }) };
    const media = await db.collection("platform_course_media").findOne({ courseId, status: "published" }, { projection: { _id: 0, sourceUrl: 1, title: 1, sourceHost: 1 } });
    if (!media || !allowedCourseVideoUrl(media.sourceUrl)) return { response: NextResponse.json({ error: "الفيديو غير متاح أو نطاق التخزين غير معتمد." }, { status: 404 }) };
    return { actor, db, media };
  } catch (error) { console.error("Protected course media authorization failed", error); return { response: NextResponse.json({ error: "تعذر التحقق من صلاحية الفيديو." }, { status: 503 }) }; }
}
async function stream(request: NextRequest, context: Context, headOnly = false) {
  const { courseId } = await context.params;
  const resolved = await resolveMedia(request, courseId);
  if ("response" in resolved) return resolved.response;
  const range = request.headers.get("range") || "";
  if (range && (!/^bytes=\d*-\d*$/.test(range) || range === "bytes=-")) return new NextResponse(null, { status: 416, headers: { "Cache-Control": "private, no-store", "Content-Range": "bytes */*" } });
  try {
    const upstream = await fetch(resolved.media.sourceUrl, { method: headOnly ? "HEAD" : "GET", headers: range ? { Range: range } : {}, cache: "no-store", redirect: "error", signal: request.signal });
    if (upstream.status !== 200 && upstream.status !== 206) return NextResponse.json({ error: "تعذر جلب ملف الفيديو من التخزين المعتمد." }, { status: 502 });
    const contentType = upstream.headers.get("content-type") || "";
    if (!(contentType.startsWith("video/") || contentType === "application/octet-stream")) return NextResponse.json({ error: "نوع ملف الفيديو غير مدعوم." }, { status: 415 });
    const headers = new Headers({
      "Content-Type": contentType, "Cache-Control": "private, no-store, no-cache, must-revalidate", "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Disposition": "inline", "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
    });
    for (const name of ["content-length", "content-range", "last-modified"]) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
    if (!headOnly && !range) await recordSecurityEvent(resolved.db, { action: "course_video_started", actorUserId: resolved.actor.userId, targetId: courseId, request, metadata: { sourceHost: resolved.media.sourceHost || "" } });
    return new NextResponse(headOnly ? null : upstream.body, { status: upstream.status, headers });
  } catch (error) { console.error("Protected course video stream failed", error); return NextResponse.json({ error: "تعذر تشغيل الفيديو المحمي حالياً." }, { status: 502 }); }
}
export async function GET(request: NextRequest, context: Context) { return stream(request, context, false); }
export async function HEAD(request: NextRequest, context: Context) { return stream(request, context, true); }
