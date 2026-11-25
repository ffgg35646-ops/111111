import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { scorePlatformCourseQuiz, type PlatformQuizQuestion } from "@/lib/platform-quizzes";
import { hasApprovedCourseEnrollment } from "@/lib/platform-course-access";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
async function resolveCourse(db: Awaited<ReturnType<typeof getClinicalDatabase>>, courseId: string) {
  const catalog = courses.find((item) => item.id === courseId);
  if (catalog) return { id: catalog.id, title: catalog.title, trackId: catalog.trackId, mode: catalog.mode, lessons: catalog.lessons };
  const stored = await db.collection("platform_course_content").findOne(
    { courseId, status: "published" },
    { projection: { _id: 0, courseId: 1, title: 1, trackId: 1, mode: 1, lessons: 1 } },
  );
  if (!stored) return null;
  return {
    id: String(stored.courseId), title: String(stored.title || "دورة تدريبية"),
    trackId: String(stored.trackId || "mental-health"),
    mode: stored.mode === "live" || stored.mode === "hybrid" ? stored.mode : "recorded",
    lessons: Array.isArray(stored.lessons) ? stored.lessons : [],
  };
}
async function hasCourseAccess(db: Awaited<ReturnType<typeof getClinicalDatabase>>, email: string, courseId: string) {
  return hasApprovedCourseEnrollment(db, courseId, email);
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager", "trainer", "supervisor", "trainee"]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول لعرض تقييمات الدورة." }, { status: 401 });
  const courseId = clean(request.nextUrl.searchParams.get("courseId"), 80);
  if (!courseId) return NextResponse.json({ error: "معرّف الدورة مطلوب." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const [reviews, ownReview, assignment] = await Promise.all([
      db.collection("platform_course_reviews").find(
        { courseId }, { projection: { _id: 0, courseId: 1, courseScore: 1, trainerScore: 1, createdAt: 1 } },
      ).limit(1000).toArray(),
      db.collection("platform_course_reviews").findOne(
        { courseId, userId: actor.userId }, { projection: { _id: 0, courseScore: 1, trainerScore: 1, comment: 1, createdAt: 1, updatedAt: 1 } },
      ),
      db.collection("platform_trainer_course_assignments").findOne(
        { courseId }, { projection: { _id: 0, trainerId: 1, trainerName: 1 } },
      ),
    ]);
    const courseScores = reviews.map((item) => Number(item.courseScore)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
    const trainerScores = reviews.filter(item => assignment?.trainerId && item.trainerId === assignment.trainerId)
      .map((item) => Number(item.trainerScore)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
    const average = (values: number[]) => values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : null;
    return NextResponse.json({
      courseAverage: average(courseScores),
      courseReviewCount: courseScores.length,
      trainerAverage: average(trainerScores),
      trainerReviewCount: trainerScores.length,
      trainerName: assignment?.trainerName || null,
      hasTrainer: Boolean(assignment?.trainerId),
      ownReview: ownReview || null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Course reviews GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل تقييمات الدورة." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, ["trainee"]);
  if (!actor) return NextResponse.json({ error: "إضافة تقييم متاحة للمتدربين المسجلين فقط." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات التقييم غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات التقييم مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const courseId = clean(data.courseId, 80);
  const courseScore = Number(data.courseScore);
  const trainerScore = data.trainerScore === null || data.trainerScore === undefined || data.trainerScore === "" ? null : Number(data.trainerScore);
  const comment = clean(data.comment, 1200);
  if (!courseId || !Number.isInteger(courseScore) || courseScore < 1 || courseScore > 5 ||
      (trainerScore !== null && (!Number.isInteger(trainerScore) || trainerScore < 1 || trainerScore > 5))) {
    return NextResponse.json({ error: "اختر تقييماً صحيحاً للدورة والمدرب من نجمة إلى خمس نجوم." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const course = await resolveCourse(db, courseId);
    if (!course) return NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 });
    if (!(await hasCourseAccess(db, actor.email, courseId))) {
      return NextResponse.json({ error: "يلزم اعتماد الالتحاق وسداد الدورة قبل التقييم." }, { status: 403 });
    }
    const progress = await db.collection("platform_course_progress").findOne(
      { userId: actor.userId, courseId },
      { projection: { _id: 0, completedLessons: 1, quizAnswers: 1, quizChecked: 1 } },
    );
    const completed = Array.isArray(progress?.completedLessons) ? progress.completedLessons.length : 0;
    if (completed < course.lessons.length) {
      return NextResponse.json({ error: "يمكنك تقييم الدورة بعد إكمال جميع وحداتها التعليمية." }, { status: 409 });
    }
    const quizDocument = await db.collection("platform_course_quizzes").findOne(
      { courseId }, { projection: { _id: 0, questions: 1, postQuestions: 1 } },
    );
    const customPostQuiz = Array.isArray(quizDocument?.postQuestions) ? quizDocument.postQuestions as PlatformQuizQuestion[] :
      Array.isArray(quizDocument?.questions) ? quizDocument.questions as PlatformQuizQuestion[] : null;
    const answers = progress?.quizAnswers && typeof progress.quizAnswers === "object" ? progress.quizAnswers as Record<string, unknown> : {};
    const finalQuiz = scorePlatformCourseQuiz(course.trackId, answers, progress?.quizChecked === true, customPostQuiz);
    if (!finalQuiz.passed) {
      return NextResponse.json({ error: "اجتز الاختبار البعدي أولاً قبل إرسال تقييمك للدورة." }, { status: 409 });
    }
    if (course.mode !== "recorded") {
      const attendance = await db.collection("platform_classroom_attendance").findOne(
        { userId: actor.userId, courseId, status: "attended" }, { projection: { _id: 1 } },
      );
      if (!attendance) return NextResponse.json({ error: "يجب اعتماد حضورك في الدورة المباشرة قبل التقييم." }, { status: 409 });
    }
    const assignment = await db.collection("platform_trainer_course_assignments").findOne({ courseId }, { projection: { _id: 0, trainerId: 1, trainerName: 1 } });
    if (trainerScore !== null && !assignment?.trainerId) {
      return NextResponse.json({ error: "لا يوجد مدرب مسند لهذه الدورة حالياً؛ يمكنك تقييم محتوى الدورة فقط." }, { status: 409 });
    }

    const now = new Date();
    const collection = db.collection("platform_course_reviews");
    await collection.createIndex({ courseId: 1, userId: 1 }, { unique: true });
    const existing = await collection.findOne({ courseId, userId: actor.userId }, { projection: { _id: 0, createdAt: 1 } });
    await collection.updateOne(
      { courseId, userId: actor.userId },
      { $set: {
        courseId, courseTitle: course.title, userId: actor.userId, learnerName: actor.name,
        courseScore,
        ...(trainerScore !== null ? { trainerScore, trainerId: assignment?.trainerId, trainerName: assignment?.trainerName } : { trainerScore: null }),
        comment, updatedAt: now,
      }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    await db.collection("platform_audit_logs").insertOne({
      action: existing ? "course_review_updated" : "course_review_created",
      actorUserId: actor.userId, courseId, courseScore, trainerScore, createdAt: now,
    }).catch((error) => console.warn("Unable to write course review audit event", error));
    return NextResponse.json({ success: true, courseScore, trainerScore, updatedAt: now });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) return NextResponse.json({ error: "يوجد تقييم محفوظ لهذا الحساب والدورة." }, { status: 409 });
    console.error("Course review POST failed", error);
    return NextResponse.json({ error: "تعذر حفظ تقييم الدورة." }, { status: 503 });
  }
}
