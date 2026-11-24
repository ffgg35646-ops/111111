import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses, learningTracks } from "@/lib/platform-catalog";

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
        { projection: { _id: 0, courseId: 1, completedLessons: 1, updatedAt: 1, quizChecked: 1 } },
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
        { projection: { _id: 0, activityId: 1, caseTitle: 1, score: 1, completedAt: 1, aiReviewStatus: 1, supervisorReview: 1, clinicalFormulation: { reviewStatus: 1 } } },
      ).sort({ completedAt: -1 }).limit(30).toArray(),
      db.collection("platform_assessment_attempts").find(
        { userId: actor.userId },
        { projection: { _id: 0, attemptId: 1, title: 1, score: 1, total: 1, percentage: 1, createdAt: 1 } },
      ).sort({ createdAt: -1 }).limit(30).toArray(),
    ]);

    const latestCourseRequest = new Map<string, Record<string, unknown>>();
    for (const item of requests) {
      if ((item.kind === "course_enrollment" || item.kind === "classroom_registration") && typeof item.courseId === "string" && !latestCourseRequest.has(item.courseId)) {
        latestCourseRequest.set(item.courseId, item);
      }
    }
    const progressByCourse = new Map(progressRows.map((row) => [String(row.courseId), row]));
    const enrolledCourses = [...latestCourseRequest.entries()].flatMap(([courseId, registration]) => {
      const course = courses.find((item) => item.id === courseId);
      if (!course) return [];
      const progress = progressByCourse.get(courseId);
      const completedLessons = Array.isArray(progress?.completedLessons) ? progress.completedLessons.length : 0;
      const paid = registration.status === "approved" && registration.paymentStatus === "paid";
      return [{
        id: course.id,
        title: course.title,
        trackId: course.trackId,
        trackTitle: learningTracks.find((item) => item.id === course.trackId)?.title || "مسار تدريبي",
        mode: course.mode,
        status: String(registration.status || "pending_review"),
        paymentStatus: String(registration.paymentStatus || "unpaid"),
        paid,
        completedLessons: Math.min(completedLessons, course.lessons.length),
        totalLessons: course.lessons.length,
        progressPercent: Math.round((Math.min(completedLessons, course.lessons.length) / Math.max(1, course.lessons.length)) * 100),
        updatedAt: progress?.updatedAt || registration.createdAt || null,
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
    const completedLessonCount = activeCourses.reduce((sum, course) => sum + course.completedLessons, 0);
    const totalLessonCount = activeCourses.reduce((sum, course) => sum + course.totalLessons, 0);
    const completedCourses = activeCourses.filter((course) => course.totalLessons > 0 && course.completedLessons === course.totalLessons).length;
    const upcomingAppointments = consultations.filter((item) => {
      const time = item.preferredAt ? new Date(item.preferredAt as string | Date).getTime() : NaN;
      return Number.isFinite(time) && time >= Date.now() && !["cancelled", "rejected", "refunded"].includes(String(item.status));
    }).length;
    const upcomingSessions = sessions.filter((item) => new Date(item.startTime as string | Date).getTime() >= Date.now()).length;

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
        assessmentAttempts: attempts.length,
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
      sessions,
      simulations: activities,
      assessmentAttempts: attempts,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Trainee dashboard GET", error);
    return NextResponse.json({ error: "تعذر تحميل لوحة المتدرب حالياً." }, { status: 503 });
  }
}
