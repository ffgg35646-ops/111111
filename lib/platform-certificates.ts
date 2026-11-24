import { randomBytes } from "node:crypto";
import type { Db } from "mongodb";

export function createPlatformCertificateSerial(date = new Date()) {
  return "ETZ-" + date.getFullYear() + "-" + randomBytes(6).toString("hex").toUpperCase();
}

export function isPlatformCertificateSerial(value: string) {
  return /^[A-Z0-9-]{12,60}$/.test(value);
}

export function scorePlatformCourseQuiz(trackId: string, answers: Record<string, unknown>, checked: boolean) {
  const correctByTrack: Record<string, number[]> = {
    "social-work": [1, 0, 1],
    cbt: [0, 1, 1],
    autism: [1, 0, 1],
    developmental: [1, 0, 0],
    "mental-health": [0, 1, 1],
  };
  const correct = correctByTrack[trackId] || correctByTrack["mental-health"];
  const score = correct.reduce((total, answer, index) => total + (answers[String(index)] === answer ? 1 : 0), 0);
  return { score, total: correct.length, passed: checked && score >= 2 };
}

export async function ensurePlatformCourseCertificate(
  db: Db,
  input: {
    userId: string;
    learnerName: string;
    courseId: string;
    courseTitle: string;
    quizScore: number;
    quizTotal: number;
    attendanceVerified: boolean;
    issuedAt?: Date;
  },
) {
  const certificates = db.collection("platform_certificates");
  await certificates.createIndex({ serial: 1 }, { unique: true });
  await certificates.createIndex(
    { userId: 1, courseId: 1 },
    { unique: true, partialFilterExpression: { userId: { $type: "string" }, courseId: { $type: "string" } } },
  );

  const identity = { userId: input.userId, courseId: input.courseId };
  const now = input.issuedAt || new Date();
  const existing = await certificates.findOne(identity, { projection: { _id: 0, serial: 1, status: 1 } });

  if (!existing) {
    try {
      await certificates.updateOne(
        identity,
        {
          $setOnInsert: {
            ...identity,
            serial: createPlatformCertificateSerial(now),
            learnerName: input.learnerName,
            courseTitle: input.courseTitle,
            certificateType: "completion",
            source: "automatic",
            issuedAt: now,
            status: "issued",
            issuedBy: "system-course-completion",
            completionVerified: true,
            quizScore: input.quizScore,
            quizTotal: input.quizTotal,
            attendanceVerified: input.attendanceVerified,
            createdAt: now,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
    }
  }

  return certificates.findOne(identity, {
    projection: {
      _id: 0,
      serial: 1,
      learnerName: 1,
      courseId: 1,
      courseTitle: 1,
      certificateType: 1,
      issuedAt: 1,
      status: 1,
      revokedAt: 1,
      quizScore: 1,
      quizTotal: 1,
      attendanceVerified: 1,
    },
  });
}
