import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { getPlatformCourseQuiz, scorePlatformCourseQuiz, type PlatformQuizQuestion } from "@/lib/platform-quizzes";
import { isTrainerCourseOwner } from "@/lib/platform-trainer";

export const runtime = "nodejs";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const sameOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
};

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["trainer"]);
  if (!actor) return NextResponse.json({ error: "هذه المساحة مخصصة لحساب المدرب النشط." }, { status: 403 });

  const courseId = clean(request.nextUrl.searchParams.get("courseId"), 80);
  try {
    const db = await getClinicalDatabase();
    const assignments = await db.collection("platform_trainer_course_assignments")
      .find({}, { projection: { _id: 0, courseId: 1, trainerId: 1, trainerName: 1, assignedAt: 1 } })
      .toArray();
    const byCourse = new Map(assignments.map((item) => [String(item.courseId), item]));
    const courseCards = courses.map((course) => {
      const assignment = byCourse.get(course.id);
      return {
        id: course.id,
        title: course.title,
        summary: course.summary,
        category: course.category,
        trackId: course.trackId,
        mode: course.mode,
        duration: course.duration,
        lessonCount: course.lessons.length,
        assignmentStatus: !assignment ? "available" : assignment.trainerId === actor.userId ? "mine" : "assigned",
        trainerName: assignment?.trainerName || null,
      };
    });

    if (!courseId) {
      return NextResponse.json(
        { courses: courseCards, trainer: { name: actor.name }, assignedCount: courseCards.filter((item) => item.assignmentStatus === "mine").length },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const course = courses.find((item) => item.id === courseId);
    if (!course) return NextResponse.json({ error: "الدورة غير موجودة في الكتالوج." }, { status: 404 });
    if (!(await isTrainerCourseOwner(db, courseId, actor.userId))) {
      return NextResponse.json({ error: "يجب إسناد الدورة إلى حسابك قبل عرض بيانات المتدربين أو الاختبارات." }, { status: 403 });
    }

    const registrations = await db.collection("platform_requests").find(
      { kind: { $in: ["course_enrollment", "classroom_registration"] }, courseId, status: "approved" },
      { projection: { _id: 0, requestId: 1, email: 1, name: 1, paymentStatus: 1, createdAt: 1 } },
    ).sort({ createdAt: -1 }).toArray();

    const emails = [...new Set(registrations.map((row) => String(row.email || "").toLowerCase()).filter(Boolean))];
    const users = emails.length ? await db.collection("platform_users").find(
      { email: { $in: emails }, role: "trainee", status: "active" },
      { projection: { _id: 0, userId: 1, email: 1, name: 1 } },
    ).toArray() : [];
    const userIds = users.map((user) => String(user.userId));
    const [progressRows, attendanceRows, certificates, quizDocument] = await Promise.all([
      userIds.length ? db.collection("platform_course_progress").find(
        { courseId, userId: { $in: userIds } },
        { projection: { _id: 0, userId: 1, completedLessons: 1, quizAnswers: 1, quizChecked: 1, updatedAt: 1 } },
      ).toArray() : Promise.resolve([]),
      userIds.length ? db.collection("platform_classroom_attendance").find(
        { courseId, userId: { $in: userIds } },
        { projection: { _id: 0, userId: 1, status: 1, markedAt: 1 } },
      ).toArray() : Promise.resolve([]),
      userIds.length ? db.collection("platform_certificates").find(
        { courseId, userId: { $in: userIds } },
        { projection: { _id: 0, serial: 1, userId: 1, learnerName: 1, courseTitle: 1, issuedAt: 1, status: 1, revokedAt: 1, quizScore: 1, quizTotal: 1 } },
      ).sort({ issuedAt: -1 }).toArray() : Promise.resolve([]),
      db.collection("platform_course_quizzes").findOne(
        { courseId },
        { projection: { _id: 0, questions: 1, updatedAt: 1 } },
      ),
    ]);

    const userByEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]));
    const progressByUser = new Map(progressRows.map((row) => [String(row.userId), row]));
    const attendanceByUser = new Map(attendanceRows.map((row) => [String(row.userId), row]));
    const certificateByUser = new Map(certificates.map((row) => [String(row.userId), row]));
    const quiz = getPlatformCourseQuiz(course.trackId, Array.isArray(quizDocument?.questions) ? quizDocument.questions as PlatformQuizQuestion[] : null);

    const seen = new Set<string>();
    const roster = registrations.flatMap((registration) => {
      const email = String(registration.email || "").toLowerCase();
      const user = userByEmail.get(email);
      if (!user || seen.has(String(user.userId))) return [];
      seen.add(String(user.userId));
      const progress = progressByUser.get(String(user.userId));
      const completedLessons = Array.isArray(progress?.completedLessons) ? progress.completedLessons : [];
      const answers = progress?.quizAnswers && typeof progress.quizAnswers === "object"
        ? progress.quizAnswers as Record<string, unknown>
        : {};
      const quizResult = scorePlatformCourseQuiz(course.trackId, answers, progress?.quizChecked === true, quiz);
      const attendance = attendanceByUser.get(String(user.userId));
      const certificate = certificateByUser.get(String(user.userId));
      return [{
        userId: String(user.userId),
        name: String(user.name || registration.name || "متدرب"),
        email,
        paymentStatus: String(registration.paymentStatus || "غير محدد"),
        completedLessons: completedLessons.length,
        totalLessons: course.lessons.length,
        quizChecked: progress?.quizChecked === true,
        quizScore: progress?.quizChecked === true ? quizResult.score : null,
        quizTotal: quizResult.total,
        quizPassed: quizResult.passed,
        attendanceStatus: String(attendance?.status || "unmarked"),
        lastActivityAt: progress?.updatedAt || null,
        certificateSerial: certificate?.serial || null,
        certificateStatus: certificate?.status || null,
      }];
    });

    const quizAttempts = roster.filter((person) => person.quizChecked);
    const averageQuizScore = quizAttempts.length
      ? Number((quizAttempts.reduce((sum, person) => sum + Number(person.quizScore || 0), 0) / quizAttempts.length).toFixed(1))
      : 0;
    const completedCount = roster.filter((person) => person.completedLessons === person.totalLessons && person.quizPassed).length;
    const attendedCount = roster.filter((person) => person.attendanceStatus === "attended").length;
    const passCount = quizAttempts.filter((person) => person.quizPassed).length;

    return NextResponse.json({
      courses: courseCards,
      course: { id: course.id, title: course.title, category: course.category, trackId: course.trackId, mode: course.mode, duration: course.duration, lessons: course.lessons },
      roster,
      quiz,
      quizUpdatedAt: quizDocument?.updatedAt || null,
      certificates,
      report: {
        enrolledCount: roster.length,
        completedCount,
        completionRate: roster.length ? Math.round(completedCount / roster.length * 100) : 0,
        quizAttempts: quizAttempts.length,
        quizPassCount: passCount,
        quizPassRate: quizAttempts.length ? Math.round(passCount / quizAttempts.length * 100) : 0,
        averageQuizScore,
        attendanceCount: attendedCount,
        attendanceRate: roster.length && course.mode !== "recorded" ? Math.round(attendedCount / roster.length * 100) : null,
        certificateCount: certificates.filter((item) => item.status === "issued").length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trainer workspace GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل بيانات لوحة المدرب." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, ["trainer"]);
  if (!actor) return NextResponse.json({ error: "هذه العملية متاحة للمدرب النشط فقط." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الطلب مطلوبة." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const action = clean(data.action, 40);
  const courseId = clean(data.courseId, 80);
  const course = courses.find((item) => item.id === courseId);
  if (!course) return NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 });

  try {
    const db = await getClinicalDatabase();
    if (action === "claim_course") {
      const assignments = db.collection("platform_trainer_course_assignments");
      await assignments.createIndex({ courseId: 1 }, { unique: true });
      try {
        await assignments.updateOne(
          { courseId, trainerId: actor.userId },
          { $setOnInsert: { courseId, trainerId: actor.userId, trainerName: actor.name, assignedAt: new Date() } },
          { upsert: true },
        );
      } catch (error) {
        if ((error as { code?: number })?.code !== 11000) throw error;
      }
      const assignment = await assignments.findOne({ courseId });
      if (assignment?.trainerId !== actor.userId) {
        return NextResponse.json({ error: "هذه الدورة مسندة بالفعل إلى مدرب آخر. تواصل مع مدير المنصة لإعادة الإسناد." }, { status: 409 });
      }
      await db.collection("platform_audit_logs").insertOne({
        action: "trainer_course_claimed",
        actorUserId: actor.userId,
        courseId,
        createdAt: new Date(),
      });
      return NextResponse.json({ success: true, courseId });
    }

    if (action === "save_quiz") {
      if (!(await isTrainerCourseOwner(db, courseId, actor.userId))) {
        return NextResponse.json({ error: "لا يمكنك تعديل اختبار دورة غير مسندة إلى حسابك." }, { status: 403 });
      }
      if (!Array.isArray(data.questions) || data.questions.length < 3 || data.questions.length > 12) {
        return NextResponse.json({ error: "يتطلب الاختبار من 3 إلى 12 سؤالاً." }, { status: 400 });
      }
      const questions: PlatformQuizQuestion[] = [];
      for (const input of data.questions) {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
          return NextResponse.json({ error: "بنية أحد الأسئلة غير صالحة." }, { status: 400 });
        }
        const row = input as Record<string, unknown>;
        const q = clean(row.q, 240);
        const why = clean(row.why, 500);
        const options = Array.isArray(row.options) ? row.options.slice(0, 5).map((value) => clean(value, 180)) : [];
        const correct = Number(row.correct);
        if (q.length < 8 || options.length < 2 || options.some((option) => option.length < 1) || !Number.isInteger(correct) || correct < 0 || correct >= options.length) {
          return NextResponse.json({ error: "راجع نص كل سؤال وخياراته وحدد إجابة صحيحة واحدة." }, { status: 400 });
        }
        questions.push({ q, options, correct, why });
      }
      const now = new Date();
      await db.collection("platform_course_quizzes").createIndex({ courseId: 1 }, { unique: true });
      await db.collection("platform_course_quizzes").updateOne(
        { courseId },
        { $set: { courseId, trainerId: actor.userId, questions, updatedAt: now, updatedBy: actor.userId }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      await db.collection("platform_audit_logs").insertOne({
        action: "trainer_course_quiz_updated",
        actorUserId: actor.userId,
        courseId,
        questionCount: questions.length,
        createdAt: now,
      });
      return NextResponse.json({ success: true, questionCount: questions.length, updatedAt: now });
    }

    return NextResponse.json({ error: "الإجراء المطلوب غير معروف." }, { status: 400 });
  } catch (error) {
    console.error("Trainer workspace POST failed", error);
    return NextResponse.json({ error: "تعذر حفظ التعديلات في لوحة المدرب." }, { status: 503 });
  }
}
