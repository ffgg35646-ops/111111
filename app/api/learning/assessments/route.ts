import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

const ANSWER_KEY = [1, 0, 2, 1];
const TITLE = "اختبار أساسيات المقاييس والتقدير المهني";

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["trainee"]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول بحساب متدرب لعرض نتائج الاختبارات." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const attempts = await db.collection("platform_assessment_attempts").find(
      { userId: actor.userId },
      { projection: { _id: 0, attemptId: 1, title: 1, score: 1, total: 1, percentage: 1, createdAt: 1 } },
    ).sort({ createdAt: -1 }).limit(30).toArray();
    return NextResponse.json({ attempts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Assessment attempts GET", error);
    return NextResponse.json({ error: "تعذر تحميل نتائج الاختبارات." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["trainee"]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول بحساب متدرب لحفظ نتيجة الاختبار." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "إجابات الاختبار غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "إجابات الاختبار مطلوبة." }, { status: 400 });
  const answers = (body as Record<string, unknown>).answers;
  if (!Array.isArray(answers) || answers.length !== ANSWER_KEY.length || answers.some((value) => !Number.isInteger(value) || Number(value) < 0 || Number(value) > 2)) {
    return NextResponse.json({ error: "أجب عن جميع أسئلة الاختبار قبل حفظ النتيجة." }, { status: 400 });
  }
  const score = ANSWER_KEY.reduce((sum, answer, index) => sum + (answers[index] === answer ? 1 : 0), 0);
  const now = new Date();
  const attempt = {
    attemptId: randomUUID(),
    userId: actor.userId,
    title: TITLE,
    quizId: "professional-assessment-basics-v1",
    answers,
    score,
    total: ANSWER_KEY.length,
    percentage: Math.round((score / ANSWER_KEY.length) * 100),
    createdAt: now,
  };
  try {
    const db = await getClinicalDatabase();
    await db.collection("platform_assessment_attempts").insertOne(attempt);
    return NextResponse.json({
      success: true,
      attempt: {
        attemptId: attempt.attemptId,
        title: attempt.title,
        score: attempt.score,
        total: attempt.total,
        percentage: attempt.percentage,
        createdAt: attempt.createdAt,
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Assessment attempt save failed", error);
    return NextResponse.json({ error: "تعذر حفظ نتيجة الاختبار." }, { status: 503 });
  }
}
