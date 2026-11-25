import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses, learningTracks } from "@/lib/platform-catalog";
import { scorePlatformCourseQuiz } from "@/lib/platform-quizzes";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["trainee"]);
  if (!actor) return NextResponse.json({ error: "هذه المساحة متاحة لحساب المتدرب فقط." }, { status: 403 });

  try {
    const db = await getClinicalDatabase();
    const email = actor.email.toLowerCase();
    const [requests, progressRows, certificates, payments, activities, attempts] = await Promise.all([
      db.collection("platform_requests").find(
        { email, kind: { $in: ["course_enrollment", "classroom_registration", "consultation"] } },
        { projection: { _id: 0, requestId: 1, kind: 1, courseId: 1, courseTitle: 1, status: 1, paymentStatus: 1, quotedAmount: 1, currency: 1, preferredAt: 1, durationMinutes: 1, serviceId: 1, providerName: 1, zoomMeeting: 1, createdAt: 1, paidAt: 1 } },
      ).sort({ createdAt: -1 }).limit(150).toArray(),
      db.collection("platform_course_progress").find(
        { userId: actor.userId },
        { projection: { _id: 0, courseId: 1, completedLessons: 1, updatedAt: 1, quizAnswers: 1, quizChecked: 1 } },
      ).sort({ updatedAt: -1 }).limit(150).toArray(),
      db.collection("platform_certificates").find(
        { userId: actor.userId },
        { projection: { _id: 0, serial: 1, courseTitle: 1, issuedAt: 1, status: 1, certificateType: 1 } },
      ).sort({ issuedAt: -1 }).limit(100).toArray(),
      db.collection("platform_payments").find(
        { email },
        { projection: { _id: 0, providerPaymentId: 1, requestId: 1, amount: 1, currency: 1, status: 1, paymentMethod: 1, paidAt: 1, createdAt: 1, refundedAmount: 1 } },
      ).sort({ createdAt: -1 }).limit(100).toArray(),
      db.collection("platform_learning_activities").find(
        { "trainee.userId": actor.userId },
        { projection: { _id: 0, activityId: 1, caseTitle: 1, score: 1, completedAt: 1, aiReviewStatus: 1, supervisorReview: 1, "clinicalFormulation.reviewStatus": 1 } },
      ).sort({ completedAt: -1 }).limit(30).toArray(),
      db.collection("platform_assessment_attempts").find(
        { userId: actor.userId },
        { projection: { _id: 0, attemptId: 1, title: 1, score: 1, total: 1, percentage: 1, createdAt: 1 } },
      ).sort({ createdAt: -1 }).limit(30).toArray(),
    ]);

    const requestedCourseIds = [...new Set(requests
      .filter((item) => item.kind === "course_enrollment" || item.kind === "classroom_registration")
      .map((item) => String(item.courseId || ""))
      .filter((id) => id && !courses.some((course) => course.id === id)))];
    const customCourses = requestedCourseIds.length ? await db.collection("platform_course_content").find(
      { courseId: { $in: requestedCourseIds }, status: "published" },
      { projection: { _id: 0, courseId: 1, title: 1, trackId: 1, mode: 1, lessons: 1, contentType: 1 } },
    ).toArray() : [];
    const customCourseMap = new Map(customCourses.map((course) => [String(course.courseId), course]));
    const latestCourseRequest = new Map<string, Record<string, unknown>>();
    for (const item of requests) {
      if ((item.kind === "course_enrollment" || item.kind === "classroom_registration") && typeof item.courseId === "string" && !latestCourseRequest.has(item.courseId)) {
        latestCourseRequest.set(item.courseId, item);
      }
    }
    const progressByCourse = new Map(progressRows.map((row) => [String(row.courseId), row]));
    const enrolledCourses = [...latestCourseRequest.entries()].flatMap(([courseId, registration]) => {
      const staticCourse = courses.find((item) => item.id === courseId);
      const customCourse = customCourseMap.get(courseId);
      if (!staticCourse && !customCourse) return [];
      const title = staticCourse?.title || String(customCourse?.title || "دورة تدريبية");
      const trackId = staticCourse?.trackId || String(customCourse?.trackId || "mental-health");
      const mode = staticCourse?.mode || (customCourse?.mode === "live" || customCourse?.mode === "hybrid" ? customCourse.mode : "recorded");
      const lessonCount = staticCourse?.lessons.length ?? (Array.isArray(customCourse?.lessons) ? customCourse.lessons.length : 0);
      const progress = progressByCourse.get(courseId);
      const completedLessons = Array.isArray(progress?.completedLessons) ? progress.completedLessons.length : 0;
      const paid = registration.status === "approved" && (registration.paymentStatus === "paid" || registration.kind === "classroom_registration");
      return [{
        id: courseId,
        title,
        trackId,
        trackTitle: learningTracks.find((item) => item.id === trackId)?.title || "مسار تدريبي",
        mode,
        contentType: customCourse?.contentType === "program" ? "program" : "course",
        status: String(registration.status || "pending_review"),
        paymentStatus: String(registration.paymentStatus || (registration.kind === "classroom_registration" ? "not_required" : "unpaid")),
        paid,
        completedLessons: Math.min(completedLessons, lessonCount),
        totalLessons: lessonCount,
        progressPercent: Math.round((Math.min(completedLessons, lessonCount) / Math.max(1, lessonCount)) * 100),
        updatedAt: progress?.updatedAt || registration.createdAt || null,
        ...(registration.kind === "classroom_registration" && registration.status === "approved" && registration.zoomMeeting ? { zoomMeeting: registration.zoomMeeting } : {}),
      }];
    }).sort((a, b) => Number(b.paid) - Number(a.paid));

    const paidCourseIds = enrolledCourses.filter((course) => course.paid).map((course) => course.id);
    const [sessions] = await Promise.all([
      paidCourseIds.length
        ? db.collection("platform_classroom_sessions").find(
            { courseId: { $in: paidCourseIds }, status: { $ne: "cancelled" } },
            { projection: { _id: 0, sessionId: 1, courseId: 1, courseTitle: 1, topic: 1, startTime: 1, durationMinutes: 1, joinUrl: 1, status: 1, recordingAllowed: 1, recordingStatus: 1, recordingUrl: 1 } },
          ).sort({ startTime: 1 }).limit(40).toArray()
        : Promise.resolve([]),
    ]);
    const directClassroomSessions = requests.flatMap((item) => {
      const meeting = item.zoomMeeting && typeof item.zoomMeeting === "object" && !Array.isArray(item.zoomMeeting)
        ? item.zoomMeeting as Record<string, unknown>
        : {};
      const joinUrl = typeof meeting.joinUrl === "string" ? meeting.joinUrl : "";
      if (item.kind !== "classroom_registration" || item.status !== "approved" || !joinUrl || !item.preferredAt) return [];
      return [{
        sessionId: String(item.requestId || ""),
        courseId: String(item.courseId || ""),
        courseTitle: String(item.courseTitle || "فصل مباشر"),
        topic: String(item.courseTitle || "فصل مباشر"),
        startTime: item.preferredAt,
        durationMinutes: Number(item.durationMinutes) || 90,
        joinUrl,
        status: "scheduled",
      }];
    });
    const allSessions = [...sessions, ...directClassroomSessions].sort((left, right) =>
      new Date(String(left.startTime || "")).getTime() - new Date(String(right.startTime || "")).getTime(),
    );

    const consultations = requests.filter((item) => item.kind === "consultation").map((item) => ({
      requestId: item.requestId,
      status: item.status,
      serviceId: item.serviceId,
      providerName: item.providerName,
      preferredAt: item.preferredAt,
      durationMinutes: item.durationMinutes,
      paymentStatus: item.paymentStatus,
      quotedAmount: item.quotedAmount,
      currency: item.currency,
      zoomMeeting: item.status === "approved" && item.paymentStatus === "paid" ? item.zoomMeeting : undefined,
      createdAt: item.createdAt,
    }));

    const activeCourses = enrolledCourses.filter((course) => course.paid);
    const courseQuizAttempts = activeCourses.flatMap((course) => {
      const progress = progressByCourse.get(course.id);
      if (!progress || progress.quizChecked !== true) return [];
      const answers = progress.quizAnswers && typeof progress.quizAnswers === "object"
        ? progress.quizAnswers as Record<string, unknown>
        : {};
      const definition = courses.find((item) => item.id === course.id);
      if (!definition) return [];
      const result = scorePlatformCourseQuiz(definition.trackId, answers, true);
      const createdAt = progress.updatedAt || null;
      return [{
        attemptId: "course-quiz-" + course.id,
        title: "اختبار الدورة: " + course.title,
        score: result.score,
        total: result.total,
        percentage: Math.round((result.score / Math.max(1, result.total)) * 100),
        passed: result.passed,
        kind: "course",
        createdAt,
      }];
    });
    const allAssessmentAttempts = [...attempts, ...courseQuizAttempts]
      .sort((left, right) => {
        const toTime = (value: unknown) => value instanceof Date ? value.getTime() : new Date(String(value || "")).getTime();
        return toTime(right.createdAt) - toTime(left.createdAt);
      })
      .slice(0, 50);
    const completedLessonCount = activeCourses.reduce((sum, course) => sum + course.completedLessons, 0);
    const totalLessonCount = activeCourses.reduce((sum, course) => sum + course.totalLessons, 0);
    const completedCourses = activeCourses.filter((course) => course.totalLessons > 0 && course.completedLessons === course.totalLessons).length;
    const toTimestamp = (value: unknown) => value instanceof Date ? value.getTime() : new Date(String(value || "")).getTime();
    const upcomingAppointments = consultations.filter((item) => {
      const time = item.preferredAt ? toTimestamp(item.preferredAt) : NaN;
      return Number.isFinite(time) && time >= Date.now() && !["cancelled", "rejected", "refunded"].includes(String(item.status));
    }).length;
    const upcomingSessions = allSessions.filter((item) => toTimestamp(item.startTime) >= Date.now()).length;

    return NextResponse.json({
      user: { name: actor.name, email: actor.email },
      summary: {
        enrolledCourses: activeCourses.length,
        completedCourses,
        completedLessons: completedLessonCount,
        totalLessons: totalLessonCount,
        progressPercent: totalLessonCount ? Math.round((completedLessonCount / totalLessonCount) * 100) : 0,
        certificates: certificates.filter((item) => item.status === "issued").length,
        payments: payments.length,
        upcomingAppointments: upcomingAppointments + upcomingSessions,
        simulations: activities.length,
        assessmentAttempts: allAssessmentAttempts.length,
      },
      courses: enrolledCourses,
      tracks: learningTracks.map((track) => ({
        id: track.id,
        title: track.title,
        summary: track.summary,
        enrolledCount: activeCourses.filter((course) => course.trackId === track.id).length,
      })),
      certificates,
      payments: payments.map((payment) => ({
        ...payment,
        amountMajor: typeof payment.amount === "number" ? payment.amount / 100 : null,
      })),
      appointments: consultations,
      sessions: allSessions,
      simulations: activities,
      assessmentAttempts: allAssessmentAttempts,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trainee dashboard GET", error);
    return NextResponse.json({ error: "تعذر تحميل لوحة المتدرب حالياً." }, { status: 503 });
  }
}
