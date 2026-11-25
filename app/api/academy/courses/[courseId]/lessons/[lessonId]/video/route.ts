import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { recordSecurityEvent } from "@/lib/platform-security";
import { approvedCourseEnrollmentFilter } from "@/lib/platform-course-access";

export const runtime = "nodejs";
type Context = { params: Promise<{ courseId: string; lessonId: string }> };

export async function GET(request: NextRequest, context: Context) {
  const actor = await requirePlatformRole(request, ["trainee"]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول بحساب المتدرب." }, { status: 401 });
  const { courseId, lessonId } = await context.params;
  try {
    const db = await getClinicalDatabase();
    const [course, enrollment] = await Promise.all([
      db.collection("platform_course_content").findOne({ courseId, status: "published" }, { projection: { _id: 0, title: 1, lessons: 1 } }),
      db.collection("platform_requests").findOne(approvedCourseEnrollmentFilter(courseId, actor.email), { projection: { _id: 1 } }),
    ]);
    if (!course) return NextResponse.json({ error: "الدورة غير منشورة." }, { status: 404 });
    if (!enrollment) return NextResponse.json({ error: "يلزم اعتماد الالتحاق وسداد رسوم الدورة." }, { status: 403 });
    const lessons = Array.isArray(course.lessons) ? course.lessons : [];
    const lesson = lessons.find((item: Record<string, unknown>) => item.id === lessonId);
    if (!lesson || lesson.uploadStatus !== "uploaded" || typeof lesson.videoId !== "string") {
      return NextResponse.json({ error: "فيديو هذا الدرس غير جاهز للمشاهدة بعد." }, { status: 404 });
    }
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const tokenKey = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY;
    if (!libraryId || !tokenKey) return NextResponse.json({ error: "إعدادات تشغيل الفيديو المحمي غير مكتملة على الخادم." }, { status: 503 });
    const expires = Math.floor(Date.now() / 1000) + 300;
    const token = createHash("sha256").update(tokenKey + lesson.videoId + String(expires)).digest("hex");
    const embedUrl = "https://player.mediadelivery.net/embed/" + encodeURIComponent(libraryId) + "/" + encodeURIComponent(lesson.videoId) + "?token=" + token + "&expires=" + expires;
    await recordSecurityEvent(db, { action: "course_lesson_video_access_issued", actorUserId: actor.userId, targetId: courseId, request, metadata: { lessonId } });
    return NextResponse.json({ embedUrl, expiresInSeconds: 300, title: String(lesson.title || course.title) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Dynamic lesson video authorization failed", error);
    return NextResponse.json({ error: "تعذر إنشاء رابط مشاهدة آمن." }, { status: 503 });
  }
}
