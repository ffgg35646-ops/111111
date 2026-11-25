import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole, type PlatformRole } from "@/lib/platform-auth";
import { recordSecurityEvent } from "@/lib/platform-security";

export const runtime = "nodejs";
const allowedRoles: PlatformRole[] = ["admin", "platform_manager", "supervisor", "trainer", "trainee", "consultant", "quality_manager"];
const reportRoles: PlatformRole[] = ["admin", "platform_manager", "supervisor", "quality_manager"];
const clean = (value: unknown, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, allowedRoles);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لعرض نتائج المقاييس." }, { status: 401 });
  const report = request.nextUrl.searchParams.get("report") === "1";
  if (report && !reportRoles.includes(actor.role)) return NextResponse.json({ error: "تقارير النتائج المجمعة متاحة للمشرفين والجودة والإدارة فقط." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const collection = db.collection("etzan_assessment_results");
    if (report) {
      const results = await collection.find({}, {
        projection: { _id: 0, resultId: 1, scaleId: 1, scaleTitle: 1, subjectCode: 1, totalScore: 1, scoreLabel: 1, createdAt: 1 },
      }).sort({ createdAt: -1 }).limit(300).toArray();
      const summary = new Map<string, { scaleId: string; title: string; count: number; total: number; latestAt: Date | string }>();
      for (const item of results) {
        const current = summary.get(String(item.scaleId)) || { scaleId: String(item.scaleId), title: String(item.scaleTitle), count: 0, total: 0, latestAt: item.createdAt };
        current.count += 1;
        current.total += Number(item.totalScore || 0);
        summary.set(current.scaleId, current);
      }
      return NextResponse.json({
        summary: [...summary.values()].map((item) => ({ scaleId: item.scaleId, title: item.title, count: item.count, averageScore: Math.round((item.total / item.count) * 100) / 100, latestAt: item.latestAt })),
        results,
        sampleSize: results.length,
        limited: results.length === 300,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const resultId = clean(request.nextUrl.searchParams.get("resultId"), 60);
    const query = resultId ? { resultId, ownerUserId: actor.userId } : { ownerUserId: actor.userId };
    const results = await collection.find(query, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(resultId ? 1 : 50).toArray();
    if (resultId && !results.length) return NextResponse.json({ error: "النتيجة غير موجودة أو لا تملك صلاحية عرضها." }, { status: 404 });
    return NextResponse.json(resultId ? { result: results[0] } : { results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Assessment results GET", error);
    return NextResponse.json({ error: "تعذر تحميل نتائج المقاييس." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["trainee", "trainer", "supervisor", "consultant"]);
  if (!actor) return NextResponse.json({ error: "لا تملك صلاحية تطبيق هذا المقياس." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات النتيجة غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أكمل بيانات التطبيق." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const scaleId = clean(data.scaleId, 60);
  const subjectCode = clean(data.subjectCode, 60);
  const privacyConfirmed = data.privacyConfirmed === true;
  const responsesRaw = Array.isArray(data.responses) ? data.responses : [];
  if (!scaleId || !/^[A-Za-z0-9_-]{2,60}$/.test(subjectCode) || !privacyConfirmed) {
    return NextResponse.json({ error: "أدخل رمزاً غير تعريفي وأكد الالتزام بالخصوصية قبل الحفظ." }, { status: 400 });
  }
  try {
    const db = await getClinicalDatabase();
    const scale = await db.collection("etzan_assessment_scales").findOne({ scaleId, status: "published", digitalAdministrationAllowed: true });
    if (!scale || !Array.isArray(scale.items) || !scale.items.length) return NextResponse.json({ error: "هذا المقياس غير متاح للتطبيق الإلكتروني وفق الترخيص المسجل." }, { status: 403 });
    const responses = [];
    for (const item of scale.items as Array<Record<string, unknown>>) {
      const responseItem = responsesRaw.find((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).itemId === item.itemId) as Record<string, unknown> | undefined;
      if (item.required !== false && !responseItem) return NextResponse.json({ error: "أجب عن جميع البنود المطلوبة." }, { status: 400 });
      if (!responseItem) continue;
      const option = Array.isArray(item.options) ? (item.options as Array<Record<string, unknown>>).find((choice) => Number(choice.value) === Number(responseItem.value)) : null;
      if (!option) return NextResponse.json({ error: "توجد إجابة لا تطابق خيارات المقياس المعتمد." }, { status: 400 });
      responses.push({ itemId: String(item.itemId), value: Number(option.value) });
    }
    if (responses.length !== responsesRaw.length) return NextResponse.json({ error: "تحتوي الإجابات على بنود غير تابعة لهذا المقياس." }, { status: 400 });
    const rawScores = responses.map((response) => {
      const item = (scale.items as Array<Record<string, unknown>>).find((candidate) => candidate.itemId === response.itemId)!;
      return response.value;
    });
    const method = (scale.scoring as Record<string, unknown> | undefined)?.method === "average" ? "average" : "sum";
    const totalScore = method === "average"
      ? Math.round((rawScores.reduce((sum, value) => sum + value, 0) / Math.max(1, rawScores.length)) * 100) / 100
      : rawScores.reduce((sum, value) => sum + value, 0);
    const bands = Array.isArray((scale.scoring as Record<string, unknown> | undefined)?.bands) ? (scale.scoring as Record<string, unknown>).bands as Array<Record<string, unknown>> : [];
    const band = bands.find((item) => totalScore >= Number(item.min) && totalScore <= Number(item.max));
    const now = new Date();
    const result = {
      resultId: randomUUID(), scaleId, scaleTitle: String(scale.title), ownerUserId: actor.userId,
      ownerRole: actor.role, subjectCode, responses, totalScore,
      scoreLabel: band ? String(band.label) : "",
      interpretationNote: band ? String(band.meaning || "") : "",
      scoringMethod: method, privacyConfirmed, createdAt: now,
    };
    await db.collection("etzan_assessment_results").insertOne(result);
    await recordSecurityEvent(db, { action: "assessment_result_submitted", actorUserId: actor.userId, targetId: scaleId, request, metadata: { resultId: result.resultId, responseCount: responses.length } });
    return NextResponse.json({
      success: true,
      result: { resultId: result.resultId, scaleTitle: result.scaleTitle, subjectCode, totalScore, scoreLabel: result.scoreLabel, interpretationNote: result.interpretationNote, createdAt: now },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Assessment result save", error);
    return NextResponse.json({ error: "تعذر التحقق من المقياس أو حفظ النتيجة." }, { status: 503 });
  }
}
