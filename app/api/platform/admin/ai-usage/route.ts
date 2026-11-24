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
    return NextResponse.json({ totals, pendingQuizDrafts, inactiveAiScenarios, rows, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("AI usage dashboard failed", error);
    return NextResponse.json({ error: "تعذر تحميل سجل استخدام الذكاء الاصطناعي." }, { status: 503 });
  }
}
