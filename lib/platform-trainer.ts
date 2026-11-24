import type { Db } from "mongodb";

export async function isTrainerCourseOwner(db: Db, courseId: string, trainerId: string) {
  const assignment = await db.collection("platform_trainer_course_assignments").findOne(
    { courseId, trainerId },
    { projection: { _id: 1 } },
  );
  return Boolean(assignment);
}
