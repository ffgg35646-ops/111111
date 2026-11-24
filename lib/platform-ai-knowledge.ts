import { createHash } from "node:crypto";
import { embed, embedMany, gateway } from "ai";
import { getClinicalDatabase } from "@/lib/mongodb";
import { courses, learningTracks, practiceScales, trainingCases } from "@/lib/platform-catalog";
import { recordPlatformAiUsage } from "@/lib/platform-ai";

export type PlatformKnowledgeSource = {
  type: string;
  title: string;
  href: string;
  text: string;
  score?: number;
};

type KnowledgeChunk = {
  sourceId: string;
  sourceType: string;
  sourceTitle: string;
  sourceHref: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
};

type KnowledgeActor = { userId: string; role: string };

const embeddingModelName = () => process.env.ETZAN_AI_EMBEDDING_MODEL || "openai/text-embedding-3-small";
const vectorIndexName = () => process.env.ETZAN_AI_VECTOR_INDEX_NAME || "etzan_ai_knowledge_vector";
const embeddingDimensions = () => {
  const value = Number(process.env.ETZAN_AI_EMBEDDING_DIMENSIONS || "1536");
  return Number.isInteger(value) && value > 0 && value <= 8192 ? value : 1536;
};
const gatewayConfigured = () => Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL === "1");

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeText(value: unknown, max = 16000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function makeChunks(source: Omit<KnowledgeChunk, "chunkIndex" | "content" | "contentHash">, text: string): KnowledgeChunk[] {
  const content = safeText(text);
  if (content.length < 30) return [];
  const size = 1500;
  const overlap = 180;
  const contentHash = digest(content);
  const chunks: KnowledgeChunk[] = [];
  let start = 0;
  while (start < content.length && chunks.length < 20) {
    const end = Math.min(content.length, start + size);
    const part = content.slice(start, end).trim();
    if (part.length >= 30) chunks.push({ ...source, chunkIndex: chunks.length, content: part, contentHash });
    if (end >= content.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export async function loadPublishedKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const db = await getClinicalDatabase();
  const [articles, books] = await Promise.all([
    db.collection("etzan_articles").find({ status: "published" }, {
      projection: { _id: 0, articleId: 1, title: 1, summary: 1, content: 1, category: 1 },
    }).sort({ updatedAt: -1, createdAt: -1 }).limit(120).toArray(),
    db.collection("etzan_books").find({ published: true }, {
      projection: { _id: 0, bookId: 1, title: 1, author: 1, description: 1, category: 1 },
    }).sort({ updatedAt: -1, createdAt: -1 }).limit(120).toArray(),
  ]);

  const sources: Array<{ sourceId: string; sourceType: string; sourceTitle: string; sourceHref: string; text: string }> = [
    ...articles.map((item) => ({
      sourceId: "article:" + String(item.articleId || digest(String(item.title || "article")).slice(0, 20)),
      sourceType: "مقال منشور",
      sourceTitle: safeText(item.title, 180) || "مقال علمي",
      sourceHref: "/articles",
      text: [item.category, item.summary, item.content].map((value) => safeText(value, 16000)).filter(Boolean).join("\n"),
    })),
    ...books.map((item) => ({
      sourceId: "book:" + String(item.bookId || digest(String(item.title || "book")).slice(0, 20)),
      sourceType: "كتاب منشور",
      sourceTitle: safeText(item.title, 180) || "كتاب",
      sourceHref: "/books",
      text: [item.author, item.category, item.description].map((value) => safeText(value, 6000)).filter(Boolean).join("\n"),
    })),
    ...learningTracks.map((item) => ({
      sourceId: "track:" + item.id,
      sourceType: "مسار مهني",
      sourceTitle: item.title,
      sourceHref: "/specialties",
      text: [item.summary, ...item.skills].join("\n"),
    })),
    ...courses.map((item) => ({
      sourceId: "course:" + item.id,
      sourceType: "مقرر تدريبي",
      sourceTitle: item.title,
      sourceHref: "/academy",
      text: [item.category, item.summary, ...item.outcomes, ...item.lessons].join("\n"),
    })),
    ...trainingCases.map((item) => ({
      sourceId: "case:" + item.id,
      sourceType: "حالة تدريبية منشورة",
      sourceTitle: item.title,
      sourceHref: "/cases",
      text: [item.track, item.briefing, ...item.learningGoals].join("\n"),
    })),
    ...practiceScales.map((item) => ({
      sourceId: "practice:" + item.id,
      sourceType: "أداة تدريبية",
      sourceTitle: item.title,
      sourceHref: "/assessments",
      text: [item.purpose, ...(Array.isArray(item.domains) ? item.domains : []), item.disclaimer].filter(Boolean).join("\n"),
    })),
  ];

  return sources.flatMap((source) => makeChunks(source, source.text));
}

export async function searchSemanticKnowledge(query: string, actor: KnowledgeActor): Promise<PlatformKnowledgeSource[] | null> {
  if (!gatewayConfigured() || process.env.ETZAN_AI_VECTOR_SEARCH_ENABLED !== "true") return null;
  try {
    const db = await getClinicalDatabase();
    const state = await db.collection("platform_ai_knowledge_index_state").findOne({ indexKey: "published-content" });
    const activeRunId = typeof state?.activeRunId === "string" ? state.activeRunId : "";
    if (!activeRunId) return null;

    const result = await embed({
      model: gateway.embeddingModel(embeddingModelName()),
      value: query.slice(0, 1200),
      maxRetries: 1,
    });
    if (result.embedding.length !== embeddingDimensions()) throw new Error("أبعاد نموذج التضمين لا تطابق إعدادات فهرس Atlas.");
    await recordPlatformAiUsage({
      feature: "knowledge_query_embedding",
      actorUserId: actor.userId,
      actorRole: actor.role,
      provider: "vercel-ai-gateway",
      model: embeddingModelName(),
      usage: { inputTokens: result.usage.tokens, totalTokens: result.usage.tokens },
      providerMetadata: result.providerMetadata,
    });

    const rows = await db.collection("platform_ai_knowledge_chunks").aggregate<Record<string, unknown>>([
      {
        $vectorSearch: {
          index: vectorIndexName(),
          path: "embedding",
          queryVector: result.embedding,
          numCandidates: 120,
          limit: 24,
          filter: { visibility: "published", indexRunId: activeRunId },
        },
      },
      {
        $project: {
          _id: 0,
          sourceId: 1,
          sourceType: 1,
          sourceTitle: 1,
          sourceHref: 1,
          content: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ]).toArray();

    const grouped = new Map<string, PlatformKnowledgeSource>();
    for (const row of rows) {
      const sourceId = String(row.sourceId || "");
      const content = safeText(row.content, 6000);
      if (!sourceId || !content) continue;
      const current = grouped.get(sourceId);
      if (current) {
        if (current.text.length < 6000) current.text = (current.text + "\n" + content).slice(0, 6000);
        current.score = Math.max(current.score || 0, Number(row.score) || 0);
      } else {
        grouped.set(sourceId, {
          type: safeText(row.sourceType, 100),
          title: safeText(row.sourceTitle, 180),
          href: safeText(row.sourceHref, 200) || "/assistant",
          text: content,
          score: Number(row.score) || 0,
        });
      }
    }
    return [...grouped.values()].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6);
  } catch (error) {
    console.warn("ETZAN semantic retrieval unavailable; falling back to keyword search", error);
    return null;
  }
}

export async function indexKnowledgeBatch(input: {
  jobId: string;
  offset: number;
  batchSize: number;
  actor: KnowledgeActor;
}) {
  if (!gatewayConfigured()) throw new Error("خدمة AI Gateway غير مهيأة على الخادم.");
  const chunks = await loadPublishedKnowledgeChunks();
  const batch = chunks.slice(input.offset, input.offset + input.batchSize);
  if (!batch.length) return { processedChunks: 0, nextOffset: input.offset, totalChunks: chunks.length, done: input.offset >= chunks.length };

  const model = embeddingModelName();
  const result = await embedMany({
    model: gateway.embeddingModel(model),
    values: batch.map((chunk) => chunk.content),
    maxRetries: 1,
  });
  if (result.embeddings.length !== batch.length) throw new Error("لم يرجع مزود التضمين متجهًا لكل مقطع محتوى.");
  if (result.embeddings.some((embedding) => embedding.length !== embeddingDimensions())) throw new Error("أبعاد نموذج التضمين لا تطابق إعدادات الفهرس. راجع ETZAN_AI_EMBEDDING_DIMENSIONS وفهرس Atlas.");

  const db = await getClinicalDatabase();
  const operations = batch.map((chunk, index) => {
    const chunkId = digest(input.jobId + "|" + chunk.sourceId + "|" + chunk.chunkIndex + "|" + chunk.contentHash);
    return {
      updateOne: {
        filter: { chunkId },
        update: {
          $set: {
            chunkId,
            indexRunId: input.jobId,
            visibility: "published",
            sourceId: chunk.sourceId,
            sourceType: chunk.sourceType,
            sourceTitle: chunk.sourceTitle,
            sourceHref: chunk.sourceHref,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            contentHash: chunk.contentHash,
            embedding: result.embeddings[index],
            embeddingModel: model,
            indexedAt: new Date(),
          },
        },
        upsert: true,
      },
    };
  });
  await db.collection("platform_ai_knowledge_chunks").bulkWrite(operations, { ordered: false });

  await recordPlatformAiUsage({
    feature: "knowledge_index_embedding",
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    provider: "vercel-ai-gateway",
    model,
    usage: { inputTokens: result.usage.tokens, totalTokens: result.usage.tokens },
    providerMetadata: result.providerMetadata,
    referenceId: input.jobId,
    note: "دفعة فهرسة دلالية للمحتوى المنشور",
  });

  return {
    processedChunks: batch.length,
    nextOffset: input.offset + batch.length,
    totalChunks: chunks.length,
    done: input.offset + batch.length >= chunks.length,
  };
}

export function getKnowledgeIndexConfig() {
  return {
    gatewayConfigured: gatewayConfigured(),
    vectorSearchEnabled: process.env.ETZAN_AI_VECTOR_SEARCH_ENABLED === "true",
    embeddingModel: embeddingModelName(),
    embeddingDimensions: embeddingDimensions(),
    vectorIndexName: vectorIndexName(),
    collectionName: "platform_ai_knowledge_chunks",
  };
}
