import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { ensurePlatformCourseCertificate } from "@/lib/platform-certificates";
import { scorePlatformCourseQuiz, type PlatformQuizQuestion } from "@/lib/platform-quizzes";
import { isTrainerCourseOwner } from "@/lib/platform-trainer";

export const runtime = "nodejs";

const managers = ["admin", "platform_manager", "supervisor", "trainer"] as const;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...managers]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بإدارة الحضور." }, { status: 403 });

  const courseId = clean(request.nextUrl.searchParams.get("courseId"), 80);
  const course = courses.find((item) => item.id === courseId);
  if (!course || course.mode === "recorded") {
    return NextResponse.json({ error: "اختر دورة مباشرة أو هجينة." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    if (actor.role === "trainer" && !(await isTrainerCourseOwner(db, courseId, actor.userId))) {
      return NextResponse.json({ error: "لا يمكنك إدارة حضور دورة غير مسندة إلى حسابك." }, { status: 403 });
    }
    const requests = await db.collection("platform_requests").find(
      { kind: "classroom_registration", courseId, status: "approved", paymentStatus: "paid" },
      { projection: { _id: 0, email: 1, name: 1, requestId: 1 } },
    ).toArray();
    const emails = [...new Set(requests.map((item) => String(item.email || "").toLowerCase()).filter(Boolean))];
    const users = emails.length ? await db.collection("platform_users").find(
      { email: { $in: emails }, role: "trainee", status: "active" },
      { projection: { _id: 0, userId: 1, email: 1, name: 1 } },
    ).toArray() : [];
    const attendance = await db.collection("platform_classroom_attendance").find(
      { courseId },
      { projection: { _id: 0, userId: 1, status: 1 } },
    ).toArray();
    const byEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]));
    const byUser = new Map(attendance.map((entry) => [entry.userId, entry]));
    const roster = requests.flatMap((registration) => {
      const user = byEmail.get(String(registration.email || "").toLowerCase());
      return user ? [{
        userId: user.userId,
        name: user.name || registration.name,
        email: user.email,
        status: byUser.get(user.userId)?.status || "unmarked",
      }] : [];
    });
    return NextResponse.json(
      { course: { id: course.id, title: course.title }, roster },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("attendance roster", error);
    return NextResponse.json({ error: "تعذر تحميل سجل الحضور." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...managers]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بإدارة الحضور." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الحضور غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات الحضور مطلوبة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const courseId = clean(data.courseId, 80);
  const userId = clean(data.userId, 100);
  const status = clean(data.status, 20);
  const course = courses.find((item) => item.id === courseId);
  if (!course || course.mode === "recorded" || !userId || !["attended", "absent"].includes(status)) {
    return NextResponse.json({ error: "الدورة أو المتدرب أو حالة الحضور غير صالحة." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    if (actor.role === "trainer" && !(await isTrainerCourseOwner(db, courseId, actor.userId))) {
      return NextResponse.json({ error: "لا يمكنك تسجيل حضور دورة غير مسندة إلى حسابك." }, { status: 403 });
    }
    const user = await db.collection("platform_users").findOne(
      { userId, role: "trainee", status: "active" },
      { projection: { _id: 0, userId: 1, email: 1, name: 1, role: 1 } },
    );
    if (!user) return NextResponse.json({ error: "حساب المتدرب غير موجود أو غير نشط." }, { status: 404 });

    const registration = await db.collection("platform_requests").findOne({
      kind: "classroom_registration",
      courseId,
      email: String(user.email).toLowerCase(),
      status: "approved",
    });
    if (!registration) {
      return NextResponse.json({ error: "لا يوجد طلب التحاق معتمد لهذا المتدرب في الدورة." }, { status: 409 });
    }

    const now = new Date();
    await db.collection("platform_classroom_attendance").createIndex({ userId: 1, courseId: 1 }, { unique: true });
    await db.collection("platform_classroom_attendance").updateOne(
      { userId, courseId },
      {
        $set: {
          userId, courseId, courseTitle: course.title, status,
          markedAt: now, markedBy: actor.userId, registrationId: registration.requestId,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    await db.collection("platform_audit_logs").insertOne({
      action: "classroom_attendance_marked",
      actorUserId: actor.userId,
      userId,
      courseId,
      status,
      createdAt: now,
    });

    let certificate: Record<string, unknown> | null = null;
    if (status === "attended" && user.role === "trainee") {
      const progress = await db.collection("platform_course_progress").findOne(
        { userId, courseId },
        { projection: { _id: 0, completedLessons: 1, quizAnswers: 1, quizChecked: 1 } },
      );
      const completed = Array.isArray(progress?.completedLessons) ? progress.completedLessons : [];
      const answers = progress?.quizAnswers && typeof progress.quizAnswers === "object"
        ? progress.quizAnswers as Record<string, unknown>
        : {};
      const quizDocument = await db.collection("platform_course_quizzes").findOne(
        { courseId },
        { projection: { _id: 0, questions: 1 } },
      );
      const customQuiz = Array.isArray(quizDocument?.questions) ? quizDocument.questions as PlatformQuizQuestion[] : null;
      const quiz = scorePlatformCourseQuiz(course.trackId, answers, progress?.quizChecked === true, customQuiz);
      if (progress && completed.length === course.lessons.length && quiz.passed) {
        certificate = await ensurePlatformCourseCertificate(db, {
          userId,
          learnerName: String(user.name || user.email || "المتدرب"),
          courseId,
          courseTitle: course.title,
          quizScore: quiz.score,
          quizTotal: quiz.total,
          attendanceVerified: true,
          issuedAt: now,
        }) as Record<string, unknown> | null;
      }
    }

    return NextResponse.json({ success: true, userId, courseId, status, markedAt: now, certificate });
  } catch (error) {
    console.error("attendance mark", error);
    return NextResponse.json({ error: "تعذر حفظ الحضور." }, { status: 503 });
  }
}
