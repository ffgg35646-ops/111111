import { randomUUID } from "node:crypto";
import { gateway } from "ai";
import { getClinicalDatabase } from "@/lib/mongodb";

type RecordValue = Record<string, unknown>;
function asRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}
function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function extractCost(gateway: RecordValue): number | null {
  const cost = gateway.cost;
  const direct = finiteNumber(cost);
  if (direct !== null) return direct;
  const details = asRecord(cost);
  return finiteNumber(details.total) ?? finiteNumber(details.totalCost) ?? finiteNumber(details.amount);
}

export async function recordPlatformAiUsage(input: {
  feature: string;
  actorUserId: string;
  actorRole: string;
  model: string;
  provider?: string;
  usage?: unknown;
  providerMetadata?: unknown;
  eventStatus?: "completed" | "session_created" | "failed";
  note?: string;
  referenceId?: string;
}) {
  const usage = asRecord(input.usage);
  const metadata = asRecord(input.providerMetadata);
  const gatewayMetadata = asRecord(metadata.gateway);
  const generationId = typeof gatewayMetadata.generationId === "string" ? gatewayMetadata.generationId.slice(0, 180) : "";
  let generation: RecordValue = {};
  if (generationId && input.provider !== "openai-realtime") {
    try {
      generation = await gateway.getGenerationInfo({ id: generationId }) as unknown as RecordValue;
    } catch (error) {
      console.warn("AI Gateway generation cost lookup is not available yet", error);
    }
  }
  const inputTokens = finiteNumber(usage.inputTokens ?? usage.promptTokens) ?? finiteNumber(generation.promptTokens);
  const outputTokens = finiteNumber(usage.outputTokens ?? usage.completionTokens) ?? finiteNumber(generation.completionTokens);
  const totalTokens = finiteNumber(usage.totalTokens) ?? (
    inputTokens !== null || outputTokens !== null ? (inputTokens || 0) + (outputTokens || 0) : null
  );
  const costUsd = extractCost(gatewayMetadata) ?? finiteNumber(generation.totalCost);
  const costStatus = costUsd !== null ? "reported" : generationId ? "pending" : "not_available";
  const provider = input.provider || (typeof generation.providerName === "string" ? generation.providerName : "vercel-ai-gateway");
  const model = typeof generation.model === "string" ? generation.model : input.model;

  try {
    const db = await getClinicalDatabase();
    await db.collection("platform_ai_usage").insertOne({
      usageId: randomUUID(),
      feature: input.feature.slice(0, 80),
      provider: provider.slice(0, 80),
      model: model.slice(0, 160),
      actorUserId: input.actorUserId.slice(0, 120),
      actorRole: input.actorRole.slice(0, 40),
      inputTokens, outputTokens, totalTokens,
      gatewayGenerationId: generationId || null,
      costUsd,
      currency: costUsd === null ? null : "USD",
      costStatus,
      eventStatus: input.eventStatus || "completed",
      note: input.note?.slice(0, 500) || null,
      referenceId: input.referenceId?.slice(0, 100) || null,
      occurredAt: new Date(),
    });
  } catch (error) {
    console.error("Unable to write platform AI usage record", error);
  }
}
