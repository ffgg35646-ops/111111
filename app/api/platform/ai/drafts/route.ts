import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { isTrainerCourseOwner } from "@/lib/platform-trainer";

export const runtime = "nodejs";
const sameOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
};

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager", "supervisor", "trainer"]);
  if (!actor) return NextResponse.json({ error: "عرض مسودات الاختبارات متاح للمدرب والمشرف والإدارة فقط." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    let courseFilter: Record<string, unknown> = {};
    if (actor.role === "trainer") {
      const assignments = await db.collection("platform_trainer_course_assignments")
        .find({ trainerId: actor.userId }, { projection: { _id: 0, courseId: 1 } }).toArray();
      const courseIds = assignments.map((item) => String(item.courseId));
      if (!courseIds.length) return NextResponse.json({ drafts: [] }, { headers: { "Cache-Control": "no-store" } });
      courseFilter = { courseId: { $in: courseIds } };
    }
    const drafts = await db.collection("platform_ai_quiz_drafts").find(
      { status: "pending_review", ...courseFilter },
      { projection: { _id: 0, draftId: 1, courseId: 1, courseTitle: 1, questions: 1, status: 1, createdBy: 1, createdByRole: 1, createdAt: 1 } },
    ).sort({ createdAt: -1 }).limit(60).toArray();
    return NextResponse.json({ drafts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("AI quiz drafts GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل مسودات الاختبارات." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, ["admin", "platform_manager", "supervisor", "trainer"]);
  if (!actor) return NextResponse.json({ error: "اعتماد مسودات الاختبارات متاح للمدرب والمشرف والإدارة فقط." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الاعتماد غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "اختر مسودة للاعتماد." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const draftId = typeof data.draftId === "string" ? data.draftId.trim().slice(0, 80) : "";
  const action = data.action === "approve_quiz" ? "approve_quiz" : data.action === "reject_quiz" ? "reject_quiz" : "";
  if (!draftId || !action) return NextResponse.json({ error: "الإجراء أو معرّف المسودة غير صالح." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const drafts = db.collection("platform_ai_quiz_drafts");
    const draft = await drafts.findOne({ draftId, status: "pending_review" });
    if (!draft) return NextResponse.json({ error: "المسودة غير موجودة أو سبق مراجعتها." }, { status: 404 });
    if (action === "reject_quiz") {
      await drafts.updateOne({ draftId, status: "pending_review" }, { $set: { status: "rejected", reviewedBy: actor.userId, reviewedAt: new Date() } });
      await db.collection("platform_audit_logs").insertOne({ action: "ai_quiz_draft_rejected", actorUserId: actor.userId, draftId, createdAt: new Date() });
      return NextResponse.json({ success: true, status: "rejected" });
    }

    const courseId = String(draft.courseId || "");
    const course = courses.find((item) => item.id === courseId);
    if (!course) return NextResponse.json({ error: "المقرر المرتبط بالمسودة لم يعد متاحاً." }, { status: 404 });
    if (actor.role === "trainer" && !(await isTrainerCourseOwner(db, courseId, actor.userId))) return NextResponse.json({ error: "لا يمكنك اعتماد اختبار دورة غير مسندة إلى حسابك." }, { status: 403 });
    const questions = Array.isArray(draft.questions) ? draft.questions : [];
    if (questions.length < 3 || questions.length > 12 || questions.some((question: unknown) => {
      if (!question || typeof question !== "object" || Array.isArray(question)) return true;
      const row = question as Record<string, unknown>;
      return typeof row.q !== "string" || !Array.isArray(row.options) || row.options.length < 3 ||
        !Number.isInteger(row.correct) || Number(row.correct) < 0 || Number(row.correct) >= row.options.length ||
        row.options.some((option) => typeof option !== "string" || !option.trim());
    })) return NextResponse.json({ error: "محتوى المسودة لا يجتاز التحقق النهائي." }, { status: 400 });

    const now = new Date();
    const reviewClaim = await drafts.updateOne(
      { draftId, status: "pending_review" },
      { $set: { status: "approving", reviewedBy: actor.userId, reviewedAt: now } },
    );
    if (!reviewClaim.modifiedCount) return NextResponse.json({ error: "تمت مراجعة المسودة بالفعل. حدّث الصفحة." }, { status: 409 });
    try {
      await db.collection("platform_course_quizzes").createIndex({ courseId: 1 }, { unique: true });
      await db.collection("platform_course_quizzes").updateOne(
        { courseId },
        { $set: { courseId, trainerId: actor.userId, questions, updatedAt: now, updatedBy: actor.userId }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      await drafts.updateOne({ draftId, status: "approving" }, { $set: { status: "approved", publishedAt: now } });
    } catch (error) {
      await drafts.updateOne({ draftId, status: "approving" }, { $set: { status: "pending_review" }, $unset: { reviewedBy: "", reviewedAt: "" } });
      throw error;
    }
    await db.collection("platform_audit_logs").insertOne({ action: "ai_quiz_draft_approved", actorUserId: actor.userId, draftId, courseId, questionCount: questions.length, createdAt: now });
    return NextResponse.json({ success: true, status: "approved", questionCount: questions.length, courseId });
  } catch (error) {
    console.error("AI quiz approval failed", error);
    return NextResponse.json({ error: "تعذر حفظ اعتماد الاختبار." }, { status: 503 });
  }
}
