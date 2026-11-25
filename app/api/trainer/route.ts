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
    const dynamicCourses = await db.collection("platform_course_content").find(
      {}, { projection: { _id: 0, courseId: 1, title: 1, summary: 1, description: 1, trackId: 1, category: 1, mode: 1, duration: 1, lessons: 1, contentType: 1, status: 1 } },
    ).sort({ updatedAt: -1 }).limit(500).toArray();
    const courseCards = [...courses.map((course) => {
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
    }), ...dynamicCourses.map((course) => {
      const id = String(course.courseId || "");
      const assignment = byCourse.get(id);
      return {
        id,
        title: String(course.title || "دورة تدريبية"),
        summary: String(course.summary || course.description || ""),
        category: String(course.category || course.trackId || "تدريب مهني"),
        trackId: String(course.trackId || "mental-health"),
        mode: course.mode === "live" || course.mode === "hybrid" ? course.mode : "recorded",
        duration: String(course.duration || ""),
        lessonCount: Array.isArray(course.lessons) ? course.lessons.length : 0,
        contentType: course.contentType === "program" ? "program" : "course",
        contentStatus: String(course.status || "draft"),
        assignmentStatus: !assignment ? "available" : assignment.trainerId === actor.userId ? "mine" : "assigned",
        trainerName: assignment?.trainerName || null,
      };
    })];

    if (!courseId) {
      return NextResponse.json(
        { courses: courseCards, trainer: { name: actor.name }, assignedCount: courseCards.filter((item) => item.assignmentStatus === "mine").length },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const catalogCourse = courses.find((item) => item.id === courseId);
    const storedCourse = catalogCourse ? null : await db.collection("platform_course_content").findOne(
      { courseId }, { projection: { _id: 0, courseId: 1, title: 1, summary: 1, description: 1, trackId: 1, category: 1, mode: 1, duration: 1, lessons: 1, contentType: 1 } },
    );
    const course = catalogCourse || (storedCourse ? {
      id: String(storedCourse.courseId),
      title: String(storedCourse.title || "دورة تدريبية"),
      summary: String(storedCourse.summary || storedCourse.description || ""),
      trackId: String(storedCourse.trackId || "mental-health"),
      category: String(storedCourse.category || storedCourse.trackId || "تدريب مهني"),
      mode: storedCourse.mode === "live" || storedCourse.mode === "hybrid" ? storedCourse.mode : "recorded",
      duration: String(storedCourse.duration || ""),
      lessons: Array.isArray(storedCourse.lessons) ? storedCourse.lessons.map((lesson: Record<string, unknown>) => String(lesson.title || "")) : [],
    } : null);
    if (!course) return NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 });
    if (!(await isTrainerCourseOwner(db, courseId, actor.userId))) {
      return NextResponse.json({ error: "يجب إسناد الدورة إلى حسابك قبل عرض بيانات المتدربين أو الاختبارات." }, { status: 403 });
    }

    const registrations = await db.collection("platform_requests").find(
      { kind: { $in: ["course_enrollment", "classroom_registration"] }, courseId, status: "approved", paymentStatus: "paid" },
      { projection: { _id: 0, requestId: 1, email: 1, name: 1, paymentStatus: 1, createdAt: 1 } },
    ).sort({ createdAt: -1 }).toArray();

    const emails = [...new Set(registrations.map((row) => String(row.email || "").toLowerCase()).filter(Boolean))];
    const users = emails.length ? await db.collection("platform_users").find(
      { email: { $in: emails }, role: "trainee", status: "active" },
      { projection: { _id: 0, userId: 1, email: 1, name: 1 } },
    ).toArray() : [];
    const userIds = users.map((user) => String(user.userId));
    const [progressRows, attendanceRows, certificates, quizDocument, reviewRows] = await Promise.all([
      userIds.length ? db.collection("platform_course_progress").find(
        { courseId, userId: { $in: userIds } },
        { projection: { _id: 0, userId: 1, completedLessons: 1, preQuizAnswers: 1, preQuizChecked: 1, quizAnswers: 1, quizChecked: 1, updatedAt: 1 } },
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
        { projection: { _id: 0, questions: 1, preQuestions: 1, postQuestions: 1, updatedAt: 1 } },
      ),
      db.collection("platform_course_reviews").find(
        { courseId }, { projection: { _id: 0, courseScore: 1, trainerScore: 1, trainerId: 1 } },
      ).toArray(),
    ]);

    const userByEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]));
    const progressByUser = new Map(progressRows.map((row) => [String(row.userId), row]));
    const attendanceByUser = new Map(attendanceRows.map((row) => [String(row.userId), row]));
    const certificateByUser = new Map(certificates.map((row) => [String(row.userId), row]));
    const postQuiz = getPlatformCourseQuiz(course.trackId, Array.isArray(quizDocument?.postQuestions) ? quizDocument.postQuestions as PlatformQuizQuestion[] : Array.isArray(quizDocument?.questions) ? quizDocument.questions as PlatformQuizQuestion[] : null);
    const preQuiz = getPlatformCourseQuiz(course.trackId, Array.isArray(quizDocument?.preQuestions) ? quizDocument.preQuestions as PlatformQuizQuestion[] : null);
    const currentTrainerId = String(byCourse.get(courseId)?.trainerId || "");
    const courseReviewScores = reviewRows.map((item) => Number(item.courseScore)).filter((score) => Number.isInteger(score) && score >= 1 && score <= 5);
    const trainerReviewScores = reviewRows.filter((item) => currentTrainerId && item.trainerId === currentTrainerId).map((item) => Number(item.trainerScore)).filter((score) => Number.isInteger(score) && score >= 1 && score <= 5);
    const averageRating = (scores: number[]) => scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) : null;

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
      const quizResult = scorePlatformCourseQuiz(course.trackId, answers, progress?.quizChecked === true, postQuiz);
      const preAnswers = progress?.preQuizAnswers && typeof progress.preQuizAnswers === "object" ? progress.preQuizAnswers as Record<string, unknown> : {};
      const preQuizResult = scorePlatformCourseQuiz(course.trackId, preAnswers, progress?.preQuizChecked === true, preQuiz);
      const attendance = attendanceByUser.get(String(user.userId));
      const certificate = certificateByUser.get(String(user.userId));
      return [{
        userId: String(user.userId),
        name: String(user.name || registration.name || "متدرب"),
        email,
        paymentStatus: String(registration.paymentStatus || "غير محدد"),
        completedLessons: completedLessons.length,
        totalLessons: course.lessons.length,
        preQuizChecked: progress?.preQuizChecked === true,
        preQuizScore: progress?.preQuizChecked === true ? preQuizResult.score : null,
        preQuizTotal: preQuizResult.total,
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
      quiz: postQuiz,
      preQuiz,
      postQuiz,
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
        courseAverageRating: averageRating(courseReviewScores),
        courseReviewCount: courseReviewScores.length,
        trainerAverageRating: averageRating(trainerReviewScores),
        trainerReviewCount: trainerReviewScores.length,
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
  if (!courseId) return NextResponse.json({ error: "معرّف الدورة غير صالح." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const catalogCourse = courses.find((item) => item.id === courseId);
    const storedCourse = catalogCourse ? null : await db.collection("platform_course_content").findOne(
      { courseId }, { projection: { _id: 0, courseId: 1, title: 1, trackId: 1, category: 1, mode: 1, duration: 1, lessons: 1 } },
    );
    const course = catalogCourse || (storedCourse ? {
      id: String(storedCourse.courseId), title: String(storedCourse.title || "دورة تدريبية"),
      trackId: String(storedCourse.trackId || "mental-health"), category: String(storedCourse.category || storedCourse.trackId || "تدريب مهني"),
      mode: storedCourse.mode === "live" || storedCourse.mode === "hybrid" ? storedCourse.mode : "recorded",
      duration: String(storedCourse.duration || ""),
      lessons: Array.isArray(storedCourse.lessons) ? storedCourse.lessons.map((lesson: Record<string, unknown>) => String(lesson.title || "")) : [],
    } : null);
    if (!course) return NextResponse.json({ error: "الدورة غير موجودة." }, { status: 404 });
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
      const assessmentType = data.assessmentType === "pre" ? "pre" : "post";
      const now = new Date();
      await db.collection("platform_course_quizzes").createIndex({ courseId: 1 }, { unique: true });
      const field = assessmentType === "pre" ? "preQuestions" : "postQuestions";
      const update: Record<string, unknown> = {
        courseId, trainerId: actor.userId, [field]: questions, updatedAt: now, updatedBy: actor.userId,
      };
      if (assessmentType === "post") update.questions = questions;
      await db.collection("platform_course_quizzes").updateOne(
        { courseId },
        { $set: update, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      await db.collection("platform_audit_logs").insertOne({
        action: "trainer_course_quiz_updated",
        actorUserId: actor.userId,
        courseId,
        assessmentType,
        questionCount: questions.length,
        createdAt: now,
      });
      return NextResponse.json({ success: true, assessmentType, questionCount: questions.length, updatedAt: now });
    }

    return NextResponse.json({ error: "الإجراء المطلوب غير معروف." }, { status: 400 });
  } catch (error) {
    console.error("Trainer workspace POST failed", error);
    return NextResponse.json({ error: "تعذر حفظ التعديلات في لوحة المدرب." }, { status: 503 });
  }
}
