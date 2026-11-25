import type { Db, Document, Filter } from "mongodb";

export function approvedCourseEnrollmentFilter(courseId: string, email?: string): Filter<Document> {
  return {
    courseId,
    ...(email ? { email: email.toLowerCase() } : {}),
    status: "approved",
    $or: [
      { kind: "course_enrollment", paymentStatus: "paid" },
      { kind: "classroom_registration" },
    ],
  };
}

export async function hasApprovedCourseEnrollment(db: Db, courseId: string, email: string) {
  const enrollment = await db.collection("platform_requests").findOne(
    approvedCourseEnrollmentFilter(courseId, email),
    { projection: { _id: 1 } },
  );
  return Boolean(enrollment);
}
