import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { ensurePlatformCourseCertificate } from "@/lib/platform-certificates";
import { getPlatformCourseQuiz, scorePlatformCourseQuiz, type PlatformQuizQuestion } from "@/lib/platform-quizzes";

export const runtime = "nodejs";

const allowed = ["admin", "platform_manager", "supervisor", "trainer", "trainee"] as const;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

type Actor = NonNullable<Awaited<ReturnType<typeof requirePlatformRole>>>;

async function hasCourseAccess(
  db: Awaited<ReturnType<typeof getClinicalDatabase>>,
  actor: Actor,
  courseId: string,
) {
  if (actor.role !== "trainee") return true;
  const enrollment = await db.collection("platform_requests").findOne(
    {
      kind: { $in: ["course_enrollment", "classroom_registration"] },
      courseId,
      email: actor.email.toLowerCase(),
      status: "approved",
      paymentStatus: "paid",
    },
    { projection: { _id: 1 } },
  );
  return Boolean(enrollment);
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...allowed]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لحفظ تقدم التعلم." }, { status: 401 });

  const courseId = clean(request.nextUrl.searchParams.get("courseId"), 80);
  const course = courses.find((item) => item.id === courseId);
  if (!course) return NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 });

  try {
    const db = await getClinicalDatabase();
    if (!(await hasCourseAccess(db, actor, courseId))) {
      return NextResponse.json(
        { error: "يلزم اعتماد الالتحاق وسداد رسوم الدورة قبل فتح محتواها.", code: "payment_required" },
        { status: 402 },
      );
    }
    const [record, certificate, quizDocument] = await Promise.all([
      db.collection("platform_course_progress").findOne(
        { userId: actor.userId, courseId },
        { projection: { _id: 0, completedLessons: 1, reflection: 1, quizAnswers: 1, quizChecked: 1, updatedAt: 1 } },
      ),
      db.collection("platform_certificates").findOne(
        { userId: actor.userId, courseId },
        { projection: { _id: 0, serial: 1, courseTitle: 1, issuedAt: 1, status: 1, revokedAt: 1 } },
      ),
      db.collection("platform_course_quizzes").findOne(
        { courseId },
        { projection: { _id: 0, questions: 1 } },
      ),
    ]);
    const quiz = getPlatformCourseQuiz(course.trackId, Array.isArray(quizDocument?.questions) ? quizDocument.questions as PlatformQuizQuestion[] : null);
    return NextResponse.json(
      { ...(record || { completedLessons: [], reflection: "", quizAnswers: {}, quizChecked: false }), certificate, quiz },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("course progress GET", error);
    return NextResponse.json({ error: "تعذر تحميل تقدم التعلم." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...allowed]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لحفظ تقدم التعلم." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات التقدم غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات التقدم مطلوبة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const courseId = clean(data.courseId, 80);
  const course = courses.find((item) => item.id === courseId);
  if (!course) return NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 });

  const completed = Array.isArray(data.completedLessons)
    ? [...new Set(data.completedLessons.filter(
        (value): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) < course.lessons.length,
      ))]
    : [];
  const reflection = clean(data.reflection, 3000);
  const rawAnswers = data.quizAnswers && typeof data.quizAnswers === "object" && !Array.isArray(data.quizAnswers)
    ? data.quizAnswers as Record<string, unknown>
    : {};
  const quizAnswers = Object.fromEntries(
    Object.entries(rawAnswers).filter(
      ([key, value]) => /^\d{1,2}$/.test(key) && Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 5,
    ).slice(0, 20),
  );
  const quizChecked = data.quizChecked === true;
  const now = new Date();

  try {
    const db = await getClinicalDatabase();
    if (!(await hasCourseAccess(db, actor, courseId))) {
      return NextResponse.json(
        { error: "يلزم اعتماد الالتحاق وسداد رسوم الدورة قبل حفظ تقدمها.", code: "payment_required" },
        { status: 402 },
      );
    }

    await db.collection("platform_course_progress").updateOne(
      { userId: actor.userId, courseId },
      {
        $set: {
          userId: actor.userId,
          courseId,
          courseTitle: course.title,
          completedLessons: completed,
          reflection,
          quizAnswers,
          quizChecked,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    const quizDocument = await db.collection("platform_course_quizzes").findOne(
      { courseId },
      { projection: { _id: 0, questions: 1 } },
    );
    const customQuiz = Array.isArray(quizDocument?.questions) ? quizDocument.questions as PlatformQuizQuestion[] : null;
    const quiz = scorePlatformCourseQuiz(course.trackId, quizAnswers, quizChecked, customQuiz);
    let attendanceVerified = course.mode === "recorded";
    if (actor.role === "trainee" && completed.length === course.lessons.length && quiz.passed && course.mode !== "recorded") {
      const attendance = await db.collection("platform_classroom_attendance").findOne(
        { userId: actor.userId, courseId, status: "attended" },
        { projection: { _id: 1 } },
      );
      attendanceVerified = Boolean(attendance);
    }

    let certificate: Record<string, unknown> | null = null;
    if (actor.role === "trainee" && completed.length === course.lessons.length && quiz.passed && attendanceVerified) {
      certificate = await ensurePlatformCourseCertificate(db, {
        userId: actor.userId,
        learnerName: actor.name,
        courseId,
        courseTitle: course.title,
        quizScore: quiz.score,
        quizTotal: quiz.total,
        attendanceVerified,
        issuedAt: now,
      }) as Record<string, unknown> | null;
    }

    return NextResponse.json({
      success: true,
      completedCount: completed.length,
      totalLessons: course.lessons.length,
      quizScore: quiz.score,
      quizTotal: quiz.total,
      quizPassed: quiz.passed,
      attendanceVerified,
      certificate,
      updatedAt: now,
    });
  } catch (error) {
    console.error("course progress POST", error);
    return NextResponse.json({ error: "تعذر حفظ تقدم التعلم." }, { status: 503 });
  }
}
