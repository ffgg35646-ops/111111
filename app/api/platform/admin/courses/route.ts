import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";

export const runtime = "nodejs";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const sameOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
};

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بإدارة الدورات." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const [assignments, trainers] = await Promise.all([
      db.collection("platform_trainer_course_assignments").find(
        {}, { projection: { _id: 0, courseId: 1, trainerId: 1, trainerName: 1, assignedAt: 1 } },
      ).toArray(),
      db.collection("platform_users").find(
        { role: "trainer", status: "active" },
        { projection: { _id: 0, userId: 1, name: 1, email: 1 } },
      ).sort({ name: 1 }).limit(300).toArray(),
    ]);
    const byCourse = new Map(assignments.map((entry) => [String(entry.courseId), entry]));
    return NextResponse.json({
      courses: courses.map((course) => {
        const assigned = byCourse.get(course.id);
        return {
          id: course.id, title: course.title, category: course.category, mode: course.mode,
          duration: course.duration, lessonCount: course.lessons.length,
          trainerId: assigned?.trainerId || null, trainerName: assigned?.trainerName || null,
          assignedAt: assigned?.assignedAt || null,
        };
      }),
      trainers,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin courses GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل قائمة الدورات والمدربين." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بإسناد الدورات." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات الإسناد غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الإسناد مطلوبة." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const courseId = clean(data.courseId, 80);
  const trainerId = clean(data.trainerId, 100);
  const course = courses.find((item) => item.id === courseId);
  if (!course) return NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 });

  try {
    const db = await getClinicalDatabase();
    const assignments = db.collection("platform_trainer_course_assignments");
    await assignments.createIndex({ courseId: 1 }, { unique: true });

    if (!trainerId) {
      const existing = await assignments.findOne({ courseId });
      if (!existing) return NextResponse.json({ success: true, courseId, trainerId: null });
      await assignments.deleteOne({ courseId });
      await db.collection("platform_audit_logs").insertOne({
        action: "admin_trainer_course_unassigned", actorUserId: actor.userId, courseId, previousTrainerId: existing.trainerId, createdAt: new Date(),
      });
      return NextResponse.json({ success: true, courseId, trainerId: null });
    }

    const trainer = await db.collection("platform_users").findOne(
      { userId: trainerId, role: "trainer", status: "active" },
      { projection: { _id: 0, userId: 1, name: 1 } },
    );
    if (!trainer) return NextResponse.json({ error: "حساب المدرب غير موجود أو غير نشط." }, { status: 404 });

    const now = new Date();
    await assignments.updateOne(
      { courseId },
      { $set: { courseId, trainerId, trainerName: String(trainer.name || "المدرب"), assignedAt: now, assignedBy: actor.userId } },
      { upsert: true },
    );
    await db.collection("platform_audit_logs").insertOne({
      action: "admin_trainer_course_assigned", actorUserId: actor.userId, courseId, trainerId, trainerName: trainer.name, createdAt: now,
    });
    return NextResponse.json({ success: true, courseId, trainerId, trainerName: trainer.name, assignedAt: now });
  } catch (error) {
    console.error("Admin course assignment failed", error);
    return NextResponse.json({ error: "تعذر حفظ إسناد الدورة." }, { status: 503 });
  }
}
