import { randomUUID } from "node:crypto";
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
  const gateway = asRecord(metadata.gateway);
  const inputTokens = finiteNumber(usage.inputTokens ?? usage.promptTokens);
  const outputTokens = finiteNumber(usage.outputTokens ?? usage.completionTokens);
  const totalTokens = finiteNumber(usage.totalTokens) ?? (
    inputTokens !== null || outputTokens !== null ? (inputTokens || 0) + (outputTokens || 0) : null
  );
  const costUsd = extractCost(gateway);
  const generationId = typeof gateway.generationId === "string" ? gateway.generationId.slice(0, 180) : "";
  const costStatus = costUsd !== null ? "reported" : generationId ? "pending" : "not_available";

  try {
    const db = await getClinicalDatabase();
    await db.collection("platform_ai_usage").insertOne({
      usageId: randomUUID(),
      feature: input.feature.slice(0, 80),
      provider: (input.provider || "vercel-ai-gateway").slice(0, 80),
      model: input.model.slice(0, 160),
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
