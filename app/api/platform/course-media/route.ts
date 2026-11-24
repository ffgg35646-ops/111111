import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { allowedCourseVideoUrl, recordSecurityEvent } from "@/lib/platform-security";
export const runtime = "nodejs";
const managers = ["admin", "platform_manager"] as const;
const sameOrigin = (r: NextRequest) => !r.headers.get("origin") || r.headers.get("origin") === r.nextUrl.origin;
export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...managers]);
  if (!actor) return NextResponse.json({ error: "إدارة وسائط الدورات متاحة لمدير المنصة فقط." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const media = await db.collection("platform_course_media").find({}, { projection: { _id: 0, courseId: 1, title: 1, status: 1, sourceHost: 1, updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(300).toArray();
    return NextResponse.json({ media }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Course media admin GET", error); return NextResponse.json({ error: "تعذر تحميل وسائط الدورات." }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...managers]);
  if (!actor) return NextResponse.json({ error: "إدارة وسائط الدورات متاحة لمدير المنصة فقط." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الوسيط غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الوسيط مطلوبة." }, { status: 400 });
  const d = body as Record<string, unknown>;
  const courseId = typeof d.courseId === "string" ? d.courseId.trim().slice(0, 80) : "";
  const title = typeof d.title === "string" ? d.title.trim().slice(0, 160) : "";
  const sourceUrl = typeof d.sourceUrl === "string" ? d.sourceUrl.trim() : "";
  const status = d.status === "draft" ? "draft" : "published";
  if (!courses.some(c => c.id === courseId) || !title || !allowedCourseVideoUrl(sourceUrl)) return NextResponse.json({ error: "اختر دورة موجودة وعنواناً صالحاً ورابط HTTPS من نطاق مسموح. أضف النطاق إلى ETZAN_VIDEO_ALLOWED_HOSTS." }, { status: 400 });
  try {
    const db = await getClinicalDatabase(), sourceHost = new URL(sourceUrl).hostname;
    await db.collection("platform_course_media").createIndex({ courseId: 1 }, { unique: true });
    await db.collection("platform_course_media").updateOne({ courseId }, { $set: { courseId, title, sourceUrl, sourceHost, status, updatedAt: new Date(), updatedBy: actor.userId }, $setOnInsert: { createdAt: new Date(), createdBy: actor.userId } }, { upsert: true });
    await recordSecurityEvent(db, { action: "protected_course_media_saved", actorUserId: actor.userId, targetId: courseId, request, metadata: { sourceHost, status } });
    return NextResponse.json({ success: true, courseId, sourceHost, status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { console.error("Course media save failed", error); return NextResponse.json({ error: "تعذر حفظ وسيط الدورة." }, { status: 503 }); }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...managers]);
  if (!actor) return NextResponse.json({ error: "إدارة وسائط الدورات متاحة لمدير المنصة فقط." }, { status: 403 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات التعطيل غير صالحة." }, { status: 400 }); }
  const courseId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).courseId === "string" ? String((body as Record<string, unknown>).courseId).trim().slice(0, 80) : "";
  if (!courseId) return NextResponse.json({ error: "حدد الدورة المطلوب تعطيل تسجيلها." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("platform_course_media").updateOne({ courseId, status: "published" }, { $set: { status: "disabled", disabledAt: new Date(), disabledBy: actor.userId, updatedAt: new Date() } });
    if (!result.modifiedCount) return NextResponse.json({ error: "لا يوجد تسجيل منشور لهذه الدورة." }, { status: 404 });
    await recordSecurityEvent(db, { action: "protected_course_media_disabled", actorUserId: actor.userId, targetId: courseId, request });
    return NextResponse.json({ success: true, status: "disabled" });
  } catch (error) { console.error("Course media disable failed", error); return NextResponse.json({ error: "تعذر تعطيل وسيط الدورة." }, { status: 503 }); }
}
