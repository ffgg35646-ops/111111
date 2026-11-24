import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { getKnowledgeIndexConfig, indexKnowledgeBatch, loadPublishedKnowledgeChunks } from "@/lib/platform-ai-knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

const managers = ["admin", "platform_manager"] as const;
const sameOrigin = (request: NextRequest) => {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
};

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...managers]);
  if (!actor) return NextResponse.json({ error: "إدارة فهرس المعرفة متاحة لإدارة المنصة فقط." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const [indexState, recentJob] = await Promise.all([
      db.collection("platform_ai_knowledge_index_state").findOne(
        { indexKey: "published-content" },
        { projection: { _id: 0 } },
      ),
      db.collection("platform_ai_knowledge_index_jobs").findOne(
        {},
        { sort: { createdAt: -1 }, projection: { _id: 0, jobId: 1, status: 1, totalChunks: 1, nextOffset: 1, createdAt: 1, completedAt: 1 } },
      ),
    ]);
    const activeRunId = typeof indexState?.activeRunId === "string" ? indexState.activeRunId : "";
    const indexedChunks = activeRunId
      ? await db.collection("platform_ai_knowledge_chunks").countDocuments({ indexRunId: activeRunId, visibility: "published" })
      : 0;
    return NextResponse.json({
      config: getKnowledgeIndexConfig(),
      indexState: indexState ? { ...indexState, indexedChunks } : { activeRunId: null, indexedChunks: 0 },
      recentJob,
      limits: { sourceArticles: 120, sourceBooks: 120, batchSize: 32 },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ETZAN knowledge index status failed", error);
    return NextResponse.json({ error: "تعذر قراءة حالة فهرس المعرفة." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...managers]);
  if (!actor) return NextResponse.json({ error: "إعادة فهرسة المعرفة متاحة لإدارة المنصة فقط." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات الفهرسة غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "حدد إجراء الفهرسة." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const action = data.action === "start" ? "start" : data.action === "continue" ? "continue" : "";
  if (!action) return NextResponse.json({ error: "إجراء الفهرسة غير معروف." }, { status: 400 });
  if (!getKnowledgeIndexConfig().gatewayConfigured) {
    return NextResponse.json({ error: "أضف اتصال AI Gateway إلى بيئة الخادم قبل إنشاء التضمينات." }, { status: 503 });
  }

  try {
    const db = await getClinicalDatabase();
    const jobs = db.collection("platform_ai_knowledge_index_jobs");

    if (action === "start") {
      const chunks = await loadPublishedKnowledgeChunks();
      if (!chunks.length) return NextResponse.json({ error: "لا توجد مقالات أو كتب أو مقررات منشورة قابلة للفهرسة." }, { status: 400 });
      const jobId = randomUUID();
      await jobs.insertOne({
        jobId,
        status: "running",
        createdBy: actor.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalChunks: chunks.length,
        sourceCount: new Set(chunks.map((chunk) => chunk.sourceId)).size,
        nextOffset: 0,
      });
      return NextResponse.json({
        success: true,
        jobId,
        offset: 0,
        totalChunks: chunks.length,
        sourceCount: new Set(chunks.map((chunk) => chunk.sourceId)).size,
        batchSize: 32,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const jobId = typeof data.jobId === "string" ? data.jobId.slice(0, 80) : "";
    const offset = Number(data.offset);
    if (!jobId || !Number.isInteger(offset) || offset < 0) {
      return NextResponse.json({ error: "معرّف مهمة الفهرسة أو موضع المتابعة غير صالح." }, { status: 400 });
    }
    const job = await jobs.findOne({ jobId, status: "running" });
    if (!job) return NextResponse.json({ error: "مهمة الفهرسة غير موجودة أو اكتملت بالفعل." }, { status: 404 });
    if (Number(job.nextOffset || 0) !== offset) {
      return NextResponse.json({ error: "تغير موضع مهمة الفهرسة. حدّث الحالة ثم تابع من الموضع الحالي.", nextOffset: job.nextOffset }, { status: 409 });
    }

    const result = await indexKnowledgeBatch({
      jobId,
      offset,
      batchSize: 32,
      actor: { userId: actor.userId, role: actor.role },
    });
    if (result.totalChunks !== Number(job.totalChunks)) {
      await jobs.updateOne({ jobId, status: "running" }, { $set: { status: "stale", updatedAt: new Date() } });
      return NextResponse.json({ error: "تغير المحتوى المنشور أثناء الفهرسة. ابدأ عملية فهرسة جديدة لضمان اتساق النتائج." }, { status: 409 });
    }

    const updated = await jobs.updateOne(
      { jobId, status: "running", nextOffset: offset },
      { $set: { nextOffset: result.nextOffset, updatedAt: new Date() } },
    );
    if (!updated.modifiedCount) return NextResponse.json({ error: "تمت معالجة هذه الدفعة من طلب آخر. حدّث الحالة للمتابعة." }, { status: 409 });

    if (result.done) {
      const now = new Date();
      await db.collection("platform_ai_knowledge_index_state").updateOne(
        { indexKey: "published-content" },
        { $set: {
          activeRunId: jobId,
          sourceCount: Number(job.sourceCount || 0),
          chunkCount: result.totalChunks,
          embeddingModel: getKnowledgeIndexConfig().embeddingModel,
          indexedAt: now,
          indexedBy: actor.userId,
        } },
        { upsert: true },
      );
      await db.collection("platform_ai_knowledge_chunks").deleteMany({ indexRunId: { $ne: jobId } });
      await jobs.updateOne({ jobId }, { $set: { status: "completed", completedAt: now, updatedAt: now } });
      await db.collection("platform_audit_logs").insertOne({
        action: "ai_knowledge_index_completed",
        actorUserId: actor.userId,
        jobId,
        sourceCount: Number(job.sourceCount || 0),
        chunkCount: result.totalChunks,
        createdAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      jobId,
      processedChunks: result.processedChunks,
      nextOffset: result.nextOffset,
      totalChunks: result.totalChunks,
      done: result.done,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("ETZAN knowledge indexing failed", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message.slice(0, 400) : "تعذر إنشاء الفهرس الدلالي.",
    }, { status: 503 });
  }
}
