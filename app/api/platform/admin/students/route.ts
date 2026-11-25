import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";

export const runtime = "nodejs";

const studentRoles = ["trainee"] as const;
const enrollmentKinds = ["course_enrollment", "classroom_registration"];
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function asDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function publicStudent(user: Record<string, unknown>, sessions: Record<string, unknown>[], registrations: Record<string, unknown>[]) {
  const userId = String(user.userId || "");
  const latestSession = sessions
    .filter((session) => session.status === "active")
    .sort((a, b) => (asDate(b.lastSeenAt)?.getTime() || 0) - (asDate(a.lastSeenAt)?.getTime() || 0))[0];
  const lastSeenAt = asDate(latestSession?.lastSeenAt);
  const courseMap = new Map<string, { id: string; title: string }>();
  for (const registration of registrations) {
    const courseId = typeof registration.courseId === "string" ? registration.courseId : "";
    if (!courseId) continue;
    const definition = courses.find((course) => course.id === courseId);
    const title = typeof registration.courseTitle === "string" && registration.courseTitle.trim()
      ? registration.courseTitle.trim()
      : definition?.title || courseId;
    courseMap.set(courseId, { id: courseId, title });
  }
  return {
    userId,
    name: String(user.name || ""),
    email: String(user.email || ""),
    status: String(user.status || "active"),
    createdAt: asDate(user.createdAt)?.toISOString() || null,
    lastLoginAt: asDate(user.lastLoginAt)?.toISOString() || null,
    lastSeenAt: lastSeenAt?.toISOString() || null,
    isOnline: Boolean(lastSeenAt && Date.now() - lastSeenAt.getTime() <= ONLINE_WINDOW_MS),
    courses: [...courseMap.values()],
    courseCount: courseMap.size,
  };
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح." }, { status: 403 });

  try {
    const db = await getClinicalDatabase();
    const users = await db.collection("platform_users").find(
      { role: { $in: [...studentRoles] } },
      { projection: { _id: 0, userId: 1, name: 1, email: 1, status: 1, createdAt: 1, lastLoginAt: 1 } },
    ).sort({ createdAt: -1 }).limit(1000).toArray();

    const userIds = users.map((user) => String(user.userId || "")).filter(Boolean);
    const emails = users.map((user) => String(user.email || "").toLowerCase()).filter(Boolean);
    const [sessions, registrations] = await Promise.all([
      userIds.length
        ? db.collection("platform_sessions").find(
            { userId: { $in: userIds }, status: "active", expiresAt: { $gt: new Date() } },
            { projection: { _id: 0, userId: 1, status: 1, lastSeenAt: 1 } },
          ).toArray()
        : Promise.resolve([]),
      emails.length
        ? db.collection("platform_requests").find(
            { email: { $in: emails }, kind: { $in: enrollmentKinds } },
            { projection: { _id: 0, email: 1, courseId: 1, courseTitle: 1, kind: 1, createdAt: 1 } },
          ).sort({ createdAt: -1 }).toArray()
        : Promise.resolve([]),
    ]);

    const sessionsByUser = new Map<string, Record<string, unknown>[]>();
    for (const session of sessions) {
      const key = String(session.userId || "");
      sessionsByUser.set(key, [...(sessionsByUser.get(key) || []), session]);
    }
    const registrationsByEmail = new Map<string, Record<string, unknown>[]>();
    for (const registration of registrations) {
      const key = String(registration.email || "").toLowerCase();
      registrationsByEmail.set(key, [...(registrationsByEmail.get(key) || []), registration]);
    }

    const students = users.map((user) => publicStudent(
      user,
      sessionsByUser.get(String(user.userId || "")) || [],
      registrationsByEmail.get(String(user.email || "").toLowerCase()) || [],
    ));
    const onlineCount = students.filter((student) => student.isOnline && student.status === "active").length;
    const blockedCount = students.filter((student) => student.status !== "active").length;

    return NextResponse.json({
      students,
      summary: {
        total: students.length,
        online: onlineCount,
        offline: students.length - onlineCount - blockedCount,
        blocked: blockedCount,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to list students", error);
    return NextResponse.json({ error: "تعذر تحميل الطلاب." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات غير مكتملة." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const userId = typeof data.userId === "string" ? data.userId.trim().slice(0, 80) : "";
  const status = data.status === "disabled" || data.status === "active" ? data.status : "";
  if (!userId || !status) return NextResponse.json({ error: "معرّف الطالب أو الحالة غير صالح." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    const target = await users.findOne({ userId, role: "trainee" });
    if (!target) return NextResponse.json({ error: "الطالب غير موجود." }, { status: 404 });
    await users.updateOne({ userId, role: "trainee" }, { $set: { status, updatedAt: new Date(), updatedBy: actor.userId } });
    if (status === "disabled") {
      await db.collection("platform_sessions").updateMany(
        { userId, status: "active" },
        { $set: { status: "revoked", closedAt: new Date(), closedReason: "student_blocked" } },
      );
    }
    await db.collection("platform_audit_logs").insertOne({
      action: status === "disabled" ? "student_blocked" : "student_unblocked",
      actorUserId: actor.userId,
      targetUserId: userId,
      createdAt: new Date(),
    }).catch((error) => console.warn("Unable to write student status audit event", error));
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error("Unable to update student status", error);
    return NextResponse.json({ error: "تعذر تحديث حالة الطالب." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }
  const userId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).userId === "string"
    ? String((body as Record<string, unknown>).userId).trim().slice(0, 80)
    : "";
  if (!userId) return NextResponse.json({ error: "معرّف الطالب غير صالح." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const users = db.collection("platform_users");
    const target = await users.findOne({ userId, role: "trainee" }, { projection: { _id: 0, userId: 1 } });
    if (!target) return NextResponse.json({ error: "الطالب غير موجود." }, { status: 404 });

    await Promise.all([
      users.deleteOne({ userId, role: "trainee" }),
      db.collection("platform_sessions").deleteMany({ userId }),
      db.collection("platform_course_progress").deleteMany({ userId }),
      db.collection("platform_learning_activities").deleteMany({ "trainee.userId": userId }),
      db.collection("platform_assessment_attempts").deleteMany({ userId }),
    ]);
    await db.collection("platform_audit_logs").insertOne({
      action: "student_account_deleted",
      actorUserId: actor.userId,
      targetUserId: userId,
      createdAt: new Date(),
    }).catch((error) => console.warn("Unable to write student deletion audit event", error));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to delete student", error);
    return NextResponse.json({ error: "تعذر حذف بيانات الطالب." }, { status: 503 });
  }
}
