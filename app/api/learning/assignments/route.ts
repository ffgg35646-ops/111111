import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { isTrainerCourseOwner } from "@/lib/platform-trainer";
import { notifyPlatformUsers } from "@/lib/platform-notifications";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
async function hasCourseAccess(db: Awaited<ReturnType<typeof getClinicalDatabase>>, userId: string, email: string, courseId: string) {
  const enrollment = await db.collection("platform_requests").findOne({
    kind: { $in: ["course_enrollment", "classroom_registration"] },
    courseId, email: email.toLowerCase(), status: "approved", paymentStatus: "paid",
  }, { projection: { _id: 1 } });
  return Boolean(enrollment);
}
async function isStaffCourseOwner(db: Awaited<ReturnType<typeof getClinicalDatabase>>, role: string, courseId: string, userId: string) {
  if (role === "admin" || role === "platform_manager") return true;
  return role === "trainer" && await isTrainerCourseOwner(db, courseId, userId);
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["trainee", "trainer", "admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول لعرض واجبات الدورة." }, { status: 401 });
  const courseId = clean(request.nextUrl.searchParams.get("courseId"), 80);
  if (!courseId) return NextResponse.json({ error: "معرّف الدورة مطلوب." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const trainee = actor.role === "trainee";
    if (trainee) {
      if (!(await hasCourseAccess(db, actor.userId, actor.email, courseId))) {
        return NextResponse.json({ error: "يلزم اعتماد الالتحاق وسداد رسوم الدورة قبل عرض الواجبات." }, { status: 402 });
      }
    } else if (!(await isStaffCourseOwner(db, actor.role, courseId, actor.userId))) {
      return NextResponse.json({ error: "لا يمكنك إدارة واجبات دورة غير مسندة إلى حسابك." }, { status: 403 });
    }

    const assignmentFilter: Record<string, unknown> = { courseId };
    if (trainee) assignmentFilter.status = "published";
    const assignments = await db.collection("platform_course_assignments")
      .find(assignmentFilter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 }).limit(100).toArray();
    const assignmentIds = assignments.map((item) => String(item.assignmentId || "")).filter(Boolean);
    const submissions = assignmentIds.length ? await db.collection("platform_course_submissions")
      .find(trainee ? { courseId, userId: actor.userId, assignmentId: { $in: assignmentIds } } : { courseId, assignmentId: { $in: assignmentIds } }, { projection: { _id: 0 } })
      .sort({ submittedAt: -1 }).limit(1000).toArray() : [];

    if (trainee) {
      const byAssignment = new Map(submissions.map((item) => [String(item.assignmentId), item]));
      return NextResponse.json({
        assignments: assignments.map((item) => ({ ...item, submission: byAssignment.get(String(item.assignmentId)) || null })),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const userIds = [...new Set(submissions.map((item) => String(item.userId || "")).filter(Boolean))];
    const users = userIds.length ? await db.collection("platform_users").find(
      { userId: { $in: userIds } },
      { projection: { _id: 0, userId: 1, name: 1, email: 1 } },
    ).toArray() : [];
    const userMap = new Map(users.map((user) => [String(user.userId), user]));
    const submissionRows = submissions.map((item) => ({
      ...item,
      studentName: String(userMap.get(String(item.userId))?.name || "متدرب"),
      studentEmail: String(userMap.get(String(item.userId))?.email || ""),
    }));
    return NextResponse.json({ assignments, submissions: submissionRows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Course assignments GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل واجبات الدورة." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, ["trainee", "trainer"]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الطلب مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const action = clean(data.action, 30);
  const courseId = clean(data.courseId, 80);
  const db = await getClinicalDatabase();

  if (action === "create_assignment") {
    if (actor.role !== "trainer" || !(await isTrainerCourseOwner(db, courseId, actor.userId))) {
      return NextResponse.json({ error: "إنشاء الواجبات متاح للمدرب المسند إليه هذه الدورة فقط." }, { status: 403 });
    }
    const title = clean(data.title, 160);
    const description = clean(data.description, 3000);
    const dueAtInput = clean(data.dueAt, 50);
    const dueAt = dueAtInput ? new Date(dueAtInput) : null;
    if (title.length < 4 || description.length < 10) {
      return NextResponse.json({ error: "اكتب عنوان الواجب ووصفاً لا يقل عن 10 أحرف." }, { status: 400 });
    }
    if (dueAt && (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now())) {
      return NextResponse.json({ error: "موعد التسليم يجب أن يكون في المستقبل." }, { status: 400 });
    }
    try {
      const now = new Date();
      const assignment = {
        assignmentId: randomUUID(), courseId, title, description,
        status: "published", createdByUserId: actor.userId, createdByName: actor.name,
        createdAt: now, updatedAt: now, ...(dueAt ? { dueAt } : {}),
      };
      await db.collection("platform_course_assignments").insertOne(assignment);
      const registrations = await db.collection("platform_requests").find(
        { kind: { $in: ["course_enrollment", "classroom_registration"] }, courseId, status: "approved", paymentStatus: "paid" },
        { projection: { _id: 0, email: 1 } },
      ).toArray();
      const emails = [...new Set(registrations.map(row => String(row.email || "").toLowerCase()).filter(Boolean))];
      const students = emails.length ? await db.collection("platform_users").find(
        { email: { $in: emails }, role: "trainee", status: "active" },
        { projection: { _id: 0, userId: 1 } },
      ).toArray() : [];
      await notifyPlatformUsers(db, students.map(row => String(row.userId)), {
        title: "واجب جديد في دورتك",
        message: "نشر المدرب واجباً جديداً: " + title,
        href: "/academy/" + encodeURIComponent(courseId),
        type: "course_assignment",
        metadata: { courseId, assignmentId: assignment.assignmentId },
      });
      await db.collection("platform_audit_logs").insertOne({
        action: "course_assignment_created", actorUserId: actor.userId, courseId,
        assignmentId: assignment.assignmentId, title, createdAt: now,
      }).catch((error) => console.warn("Unable to write assignment audit event", error));
      return NextResponse.json({ success: true, assignment }, { status: 201 });
    } catch (error) {
      console.error("Course assignment create failed", error);
      return NextResponse.json({ error: "تعذر إنشاء الواجب." }, { status: 503 });
    }
  }

  if (action === "submit_assignment") {
    if (actor.role !== "trainee" || !(await hasCourseAccess(db, actor.userId, actor.email, courseId))) {
      return NextResponse.json({ error: "التحاقك بالدورة غير معتمد أو لم يتم سدادها." }, { status: 403 });
    }
    const assignmentId = clean(data.assignmentId, 60);
    const answer = clean(data.answer, 12000);
    if (!/^[0-9a-f-]{36}$/i.test(assignmentId) || answer.length < 5) {
      return NextResponse.json({ error: "اكتب إجابتك وتأكد من اختيار الواجب الصحيح." }, { status: 400 });
    }
    try {
      const assignment = await db.collection("platform_course_assignments").findOne({ assignmentId, courseId, status: "published" });
      if (!assignment) return NextResponse.json({ error: "الواجب غير موجود أو لم يعد متاحاً." }, { status: 404 });
      const dueAt = assignment.dueAt instanceof Date ? assignment.dueAt : assignment.dueAt ? new Date(String(assignment.dueAt)) : null;
      if (dueAt && dueAt.getTime() < Date.now()) return NextResponse.json({ error: "انتهى موعد تسليم هذا الواجب." }, { status: 409 });
      const now = new Date();
      const submissions = db.collection("platform_course_submissions");
      await submissions.createIndex({ assignmentId: 1, userId: 1 }, { unique: true });
      const existing = await submissions.findOne({ assignmentId, userId: actor.userId }, { projection: { _id: 0, submissionId: 1, gradedAt: 1 } });
      if (existing?.gradedAt) return NextResponse.json({ error: "تم تصحيح هذا الواجب بالفعل ولا يمكن تعديل التسليم بعد التصحيح." }, { status: 409 });
      const submissionId = String(existing?.submissionId || randomUUID());
      await submissions.updateOne(
        { assignmentId, userId: actor.userId },
        { $set: {
          submissionId, assignmentId, courseId, userId: actor.userId,
          studentName: actor.name, answer, status: "submitted", submittedAt: now,
          updatedAt: now,
        }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      await notifyPlatformUsers(db, [String(assignment.createdByUserId || "")], {
        title: "تسليم واجب جديد",
        message: actor.name + " سلّم الواجب: " + String(assignment.title || ""),
        href: "/trainer",
        type: "course_assignment_submission",
        metadata: { courseId, assignmentId, submissionId },
      });
      return NextResponse.json({ success: true, submissionId, submittedAt: now });
    } catch (error) {
      console.error("Course assignment submit failed", error);
      return NextResponse.json({ error: "تعذر تسليم الواجب." }, { status: 503 });
    }
  }

  return NextResponse.json({ error: "الإجراء المطلوب غير معروف." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, ["trainer", "admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "هذه العملية متاحة للمدرب أو الإدارة." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات التصحيح غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات التصحيح مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const submissionId = clean(data.submissionId, 60);
  const score = Number(data.score);
  const feedback = clean(data.feedback, 2000);
  if (!/^[0-9a-f-]{36}$/i.test(submissionId) || !Number.isInteger(score) || score < 0 || score > 100 || feedback.length < 2) {
    return NextResponse.json({ error: "أدخل درجة من 0 إلى 100 وملاحظات تصحيح واضحة." }, { status: 400 });
  }
  try {
    const db = await getClinicalDatabase();
    const submission = await db.collection("platform_course_submissions").findOne({ submissionId });
    if (!submission) return NextResponse.json({ error: "التسليم غير موجود." }, { status: 404 });
    if (!(await isStaffCourseOwner(db, actor.role, String(submission.courseId || ""), actor.userId))) {
      return NextResponse.json({ error: "لا يمكنك تصحيح واجبات دورة غير مسندة إليك." }, { status: 403 });
    }
    const now = new Date();
    await db.collection("platform_course_submissions").updateOne(
      { submissionId },
      { $set: { score, feedback, status: "graded", gradedAt: now, gradedByUserId: actor.userId, gradedByName: actor.name, updatedAt: now } },
    );
    await notifyPlatformUsers(db, [String(submission.userId || "")], {
      title: "تم تصحيح واجبك",
      message: "حصلت على " + score + " من 100 في الواجب. افتح الدورة لمراجعة ملاحظات المدرب.",
      href: "/academy/" + encodeURIComponent(String(submission.courseId || "")),
      type: "course_assignment_graded",
      metadata: { courseId: submission.courseId, assignmentId: submission.assignmentId, submissionId },
    });
    return NextResponse.json({ success: true, submissionId, score, gradedAt: now });
  } catch (error) {
    console.error("Course assignment grade failed", error);
    return NextResponse.json({ error: "تعذر حفظ تصحيح الواجب." }, { status: 503 });
  }
}
