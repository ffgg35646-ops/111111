import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { allowedCourseVideoUrl, createCourseVideoAccessUrl, recordSecurityEvent } from "@/lib/platform-security";
import { approvedCourseEnrollmentFilter } from "@/lib/platform-course-access";
export const runtime = "nodejs";
type Context = { params: Promise<{ courseId: string }> };
export async function GET(request: NextRequest, context: Context) {
  const actor = await requirePlatformRole(request, ["trainee"]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول بحساب المتدرب." }, { status: 401 });
  const { courseId } = await context.params;
  if (!courses.some(course => course.id === courseId)) return NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 });
  try {
    const db = await getClinicalDatabase();
    const [enrollment, media] = await Promise.all([
      db.collection("platform_requests").findOne(approvedCourseEnrollmentFilter(courseId, actor.email), { projection: { _id: 1 } }),
      db.collection("platform_course_media").findOne(
        { courseId, status: "published" },
        { projection: { _id: 0, sourceUrl: 1 } },
      ),
    ]);
    if (!enrollment) return NextResponse.json({ error: "يلزم اعتماد الالتحاق وسداد رسوم الدورة." }, { status: 403 });
    if (!media || !allowedCourseVideoUrl(media.sourceUrl)) return NextResponse.json({ error: "الفيديو غير متاح أو نطاق التخزين غير معتمد." }, { status: 404 });
    const videoUrl = await createCourseVideoAccessUrl(courseId, actor.userId);
    await recordSecurityEvent(db, { action: "course_video_access_link_issued", actorUserId: actor.userId, targetId: courseId, request });
    return NextResponse.json({ videoUrl, expiresInSeconds: 600 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Course video access link issuance failed", error);
    return NextResponse.json({ error: "تعذر إنشاء رابط فيديو مؤقت." }, { status: 503 });
  }
}
