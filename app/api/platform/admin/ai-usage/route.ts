import { NextRequest, NextResponse } from "next/server";
import { gateway } from "ai";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "عرض تكاليف واستهلاك الذكاء الاصطناعي متاح للإدارة فقط." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const usageCollection = db.collection("platform_ai_usage");
    if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL === "1") {
      const pendingCosts = await usageCollection.find(
        { costStatus: "pending", gatewayGenerationId: { $type: "string" } },
        { projection: { _id: 0, usageId: 1, gatewayGenerationId: 1 } },
      ).limit(25).toArray();
      await Promise.all(pendingCosts.map(async (entry) => {
        try {
          const generation = await gateway.getGenerationInfo({ id: String(entry.gatewayGenerationId) });
          if (typeof generation.totalCost === "number" && Number.isFinite(generation.totalCost) && generation.totalCost >= 0) {
            await usageCollection.updateOne(
              { usageId: entry.usageId, costStatus: "pending" },
              { $set: { costUsd: generation.totalCost, currency: "USD", costStatus: "reported", costCheckedAt: new Date(), provider: generation.providerName, model: generation.model } },
            );
          }
        } catch (error) {
          console.warn("AI Gateway cost reconciliation pending", entry.usageId, error);
        }
      }));
    }
    const [rows, usageTotals, pendingQuizDrafts, inactiveAiScenarios] = await Promise.all([
      usageCollection.find({}, { projection: {
        _id: 0, usageId: 1, feature: 1, provider: 1, model: 1, actorRole: 1,
        inputTokens: 1, outputTokens: 1, totalTokens: 1, costUsd: 1, currency: 1,
        costStatus: 1, eventStatus: 1, note: 1, occurredAt: 1, referenceId: 1,
        costSource: 1, costEvidenceRef: 1, costReconciledAt: 1,
      } }).sort({ occurredAt: -1 }).limit(100).toArray(),
      usageCollection.aggregate([{
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          inputTokens: { $sum: { $ifNull: ["$inputTokens", 0] } },
          outputTokens: { $sum: { $ifNull: ["$outputTokens", 0] } },
          reportedSpendUsd: { $sum: { $cond: [{ $eq: ["$costStatus", "reported"] }, { $ifNull: ["$costUsd", 0] }, 0] } },
          reportedCostCalls: { $sum: { $cond: [{ $eq: ["$costStatus", "reported"] }, 1, 0] } },
          pendingCostCalls: { $sum: { $cond: [{ $eq: ["$costStatus", "pending"] }, 1, 0] } },
          unavailableCostCalls: { $sum: { $cond: [{ $eq: ["$costStatus", "not_available"] }, 1, 0] } },
        },
      }]).toArray(),
      db.collection("platform_ai_quiz_drafts").countDocuments({ status: "pending_review" }),
      db.collection("platform_simulation_scenarios").countDocuments({ generatedByAi: true, status: "inactive" }),
    ]);
    const totals = usageTotals[0] || {
      totalCalls: 0, inputTokens: 0, outputTokens: 0,
      reportedSpendUsd: 0, reportedCostCalls: 0, pendingCostCalls: 0, unavailableCostCalls: 0,
    };
    return NextResponse.json({ totals, pendingQuizDrafts, inactiveAiScenarios, rows, config: { gatewayConfigured: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL === "1"), textModel: process.env.CLINICAL_AI_MODEL || "openai/gpt-6-astra", realtimeConfigured: Boolean(process.env.OPENAI_API_KEY), realtimeModel: process.env.CLINICAL_REALTIME_MODEL || "gpt-realtime-2.1" }, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("AI usage dashboard failed", error);
    return NextResponse.json({ error: "تعذر تحميل سجل استخدام الذكاء الاصطناعي." }, { status: 503 });
  }
}


export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  }
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "تسوية تكاليف الذكاء الاصطناعي متاحة للإدارة فقط." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات التسوية غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "أدخل بيانات التكلفة ومرجع كشف المزوّد." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const usageId = typeof data.usageId === "string" ? data.usageId.trim().slice(0, 80) : "";
  const costUsd = typeof data.costUsd === "number" ? data.costUsd : Number(data.costUsd);
  const evidenceRef = typeof data.evidenceRef === "string" ? data.evidenceRef.trim().slice(0, 180) : "";
  if (!usageId || !Number.isFinite(costUsd) || costUsd < 0 || costUsd > 1000000 || evidenceRef.length < 4) {
    return NextResponse.json({ error: "أدخل تكلفة USD صالحة ومرجعاً واضحاً لكشف الاستخدام أو الفاتورة." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const now = new Date();
    const updated = await db.collection("platform_ai_usage").updateOne(
      {
        usageId,
        provider: "openai-realtime",
        eventStatus: "session_created",
        costStatus: { $in: ["not_available", "pending"] },
      },
      {
        $set: {
          costUsd,
          currency: "USD",
          costStatus: "reported",
          costSource: "manual-provider-reconciliation",
          costEvidenceRef: evidenceRef,
          costReconciledAt: now,
          costReconciledBy: actor.userId,
        },
      },
    );
    if (!updated.modifiedCount) {
      return NextResponse.json({ error: "لم يتم العثور على جلسة صوت غير مسوّاة بهذا المعرّف؛ ربما تمت تسويتها سابقاً." }, { status: 409 });
    }
    await db.collection("platform_audit_logs").insertOne({
      action: "ai_usage_cost_reconciled_manually",
      actorUserId: actor.userId,
      usageId,
      costUsd,
      currency: "USD",
      evidenceRef,
      createdAt: now,
    });
    return NextResponse.json({ success: true, usageId, costUsd, currency: "USD", costSource: "manual-provider-reconciliation" });
  } catch (error) {
    console.error("Manual AI usage cost reconciliation failed", error);
    return NextResponse.json({ error: "تعذرت تسوية تكلفة الجلسة الصوتية." }, { status: 503 });
  }
}
