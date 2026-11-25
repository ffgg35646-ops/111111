import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const idPattern = /^[a-z0-9][a-z0-9-]{2,79}$/;

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بإدارة محتوى الدورات." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const courseId = clean(request.nextUrl.searchParams.get("courseId"), 80);
    if (courseId) {
      const course = await db.collection("platform_course_content").findOne({ courseId }, { projection: { _id: 0 } });
      return NextResponse.json({ course: course || null }, { headers: { "Cache-Control": "no-store" } });
    }
    const courses = await db.collection("platform_course_content").find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).limit(500).toArray();
    return NextResponse.json({ courses }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Course content GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل محتوى الدورات." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بحفظ محتوى الدورات." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الدورة غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الدورة مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const courseId = clean(data.courseId, 80);
  const title = clean(data.title, 180);
  const description = clean(data.description, 3000);
  const trackId = clean(data.trackId, 80);
  const level = clean(data.level, 80);
  const duration = clean(data.duration, 100);
  const price = Number(data.price);
  const rawLessons = Array.isArray(data.lessons) ? data.lessons : [];
  if (!idPattern.test(courseId)) return NextResponse.json({ error: "معرّف الدورة غير صالح." }, { status: 400 });
  if (!title || !description) return NextResponse.json({ error: "اكتب اسم الكورس ووصفه." }, { status: 400 });
  if (!trackId || !level || !duration) return NextResponse.json({ error: "حدد المسار والمستوى والمدة." }, { status: 400 });
  if (!Number.isFinite(price) || price < 0 || price > 1000000) return NextResponse.json({ error: "أدخل سعراً صحيحاً؛ استخدم صفرًا إذا كانت الدورة مجانية." }, { status: 400 });
  if (rawLessons.length < 1 || rawLessons.length > 500) return NextResponse.json({ error: "أضف درساً واحداً على الأقل. لا يوجد حد عملي ثابت للدروس." }, { status: 400 });

  const lessons = rawLessons.map((item, index) => {
    const lesson = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : {};
    return {
      id: clean(lesson.id, 80) || "lesson-" + (index + 1),
      title: clean(lesson.title, 180),
      videoId: clean(lesson.videoId, 100),
      videoName: clean(lesson.videoName, 240),
      videoSize: Number.isFinite(Number(lesson.videoSize)) ? Math.max(0, Number(lesson.videoSize)) : 0,
      uploadStatus: clean(lesson.uploadStatus, 30) || "not_uploaded",
    };
  });
  if (lessons.some(lesson => !lesson.title)) return NextResponse.json({ error: "اكتب اسماً لكل درس قبل الحفظ." }, { status: 400 });
  if (lessons.some(lesson => lesson.uploadStatus === "uploaded" && !lesson.videoId)) return NextResponse.json({ error: "يوجد درس حالته مرفوع دون معرّف فيديو صالح." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const now = new Date();
    const collection = db.collection("platform_course_content");
    await collection.createIndex({ courseId: 1 }, { unique: true });
    const existing = await collection.findOne({ courseId }, { projection: { _id: 0, createdAt: 1 } });
    const document = {
      courseId, title, summary: description, description, trackId, category: trackId,
      mode: "recorded", level, duration, price: Math.round(price * 100) / 100, currency: "SAR",
      lessons, status: data.publish === true ? "published" : "draft",
      updatedAt: now, updatedBy: actor.userId, createdAt: existing?.createdAt || now,
    };
    await collection.updateOne({ courseId }, { $set: document }, { upsert: true });
    await db.collection("etzan_course_prices").updateOne(
      { courseId },
      { $set: { courseId, title, price: document.price, currency: "SAR", active: data.publish === true, updatedAt: now, updatedBy: actor.userId }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    await db.collection("platform_audit_logs").insertOne({
      action: existing ? "course_content_updated" : "course_content_created",
      actorUserId: actor.userId, courseId, title, lessonCount: lessons.length, createdAt: now,
    });
    return NextResponse.json({ success: true, courseId, status: document.status, lessonCount: lessons.length });
  } catch (error) {
    console.error("Course content save failed", error);
    return NextResponse.json({ error: "تعذر حفظ الكورس والدروس." }, { status: 503 });
  }
}
