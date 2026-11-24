"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Database, LoaderCircle, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type IndexStatus = {
  config: {
    gatewayConfigured: boolean;
    vectorSearchEnabled: boolean;
    embeddingModel: string;
    vectorIndexName: string;
    collectionName: string;
    embeddingDimensions: number;
  };
  indexState: {
    activeRunId?: string | null;
    indexedAt?: string;
    sourceCount?: number;
    chunkCount?: number;
    indexedChunks?: number;
    embeddingModel?: string;
  };
  recentJob?: { status?: string; totalChunks?: number; nextOffset?: number; createdAt?: string } | null;
};

const indexDefinition = JSON.stringify({
  fields: [
    { type: "vector", path: "embedding", numDimensions: 1536, similarity: "cosine" },
    { type: "filter", path: "visibility" },
    { type: "filter", path: "indexRunId" },
  ],
}, null, 2);

export default function AiKnowledgeAdminPage() {
  const router = useRouter();
  const [data, setData] = useState<IndexStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/platform/admin/ai-knowledge", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل حالة الفهرس.");
      setData(payload as IndexStatus);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل حالة الفهرس.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const session = await response.json();
        if (!response.ok || !session.authenticated || !["admin", "platform_manager"].includes(session.user?.role)) {
          router.replace("/login?next=/platform-admin/ai-knowledge");
          return;
        }
        if (session.user?.mustChangePassword) {
          router.replace("/account/change-password");
          return;
        }
        if (active) await load();
      } catch {
        router.replace("/login?next=/platform-admin/ai-knowledge");
      }
    })();
    return () => { active = false; };
  }, [router, load]);

  async function sendIndexRequest(body: Record<string, unknown>) {
    const response = await fetch("/api/platform/admin/ai-knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "تعذرت متابعة الفهرسة.");
    return payload as { jobId: string; offset?: number; totalChunks: number; batchSize?: number; nextOffset?: number; processedChunks?: number; done?: boolean };
  }

  async function buildIndex() {
    setBusy(true);
    setError("");
    setNotice("");
    setProgress({ done: 0, total: 0 });
    try {
      const start = await sendIndexRequest({ action: "start" });
      const total = start.totalChunks;
      setProgress({ done: 0, total });
      let offset = 0;
      let rounds = 0;
      let finished = false;
      while (!finished && rounds < 100) {
        const batch = await sendIndexRequest({ action: "continue", jobId: start.jobId, offset });
        offset = Number(batch.nextOffset || 0);
        finished = Boolean(batch.done);
        rounds += 1;
        setProgress({ done: offset, total });
      }
      if (!finished) throw new Error("تجاوزت عملية الفهرسة الحد الآمن للدفعات. أعد المحاولة بعد مراجعة حالة الفهرس.");
      setNotice("اكتملت الفهرسة الدلالية للمحتوى المنشور. البحث سيستخدمها بعد تفعيل إعدادات Atlas وميزة البحث الدلالي.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء الفهرس الدلالي.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const indexState = data?.indexState;
  const indexedAt = indexState?.indexedAt ? new Date(indexState.indexedAt).toLocaleString("ar-EG") : "لم تتم الفهرسة بعد";
  const percent = progress.total ? Math.min(100, Math.round(progress.done / progress.total * 100)) : 0;

  return <PlatformLayout title="فهرس المعرفة الدلالي" eyebrow="ETZAN · AI KNOWLEDGE INDEX" description="إعداد البحث الذي يفهم معنى السؤال ويربطه بالمحتوى المنشور، مع استمرار البحث النصي كخطة بديلة.">
    <div className="portal-callout" style={{ marginBottom: 16 }}>
      <ShieldCheck size={17}/> تُفهرس المقالات والكتب المنشورة وبيانات المقررات والمسارات والحالات التدريبية العامة فقط. لا تُفهرس محادثات المستخدمين أو سجلاتهم الخاصة أو تعليمات الشخصيات المخفية.
    </div>

    <section className="portal-card" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>حالة الفهرسة</h2><small>يستخدم التضمين الدلالي عند توافر الفهرس وإعداداته؛ وإلا يعود المساعد للبحث النصي الحالي.</small></div>
        <button type="button" className="portal-button secondary" onClick={load} disabled={loading || busy}><RefreshCw size={15}/> تحديث الحالة</button>
      </div>
      {loading && <p>جارٍ قراءة الحالة...</p>}
      {data && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <article className="portal-card"><small>اتصال AI Gateway</small><h3>{data.config.gatewayConfigured ? "مهيأ" : "غير مهيأ"}</h3></article>
          <article className="portal-card"><small>البحث الدلالي</small><h3>{data.config.vectorSearchEnabled ? "مفعّل بالإعداد" : "متوقف بالإعداد"}</h3></article>
          <article className="portal-card"><small>المقاطع المفهرسة النشطة</small><h3>{Number(indexState?.indexedChunks || 0).toLocaleString("ar-EG")}</h3></article>
          <article className="portal-card"><small>المصادر في آخر فهرسة</small><h3>{Number(indexState?.sourceCount || 0).toLocaleString("ar-EG")}</h3></article>
        </div>
        <p style={{ margin: 0 }}><strong>النموذج:</strong> {data.config.embeddingModel} · <strong>الأبعاد:</strong> {data.config.embeddingDimensions} · <strong>آخر فهرسة:</strong> {indexedAt}</p>
      </>}
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button type="button" className="portal-button" onClick={buildIndex} disabled={busy || loading || !data?.config.gatewayConfigured}>
          {busy ? <LoaderCircle size={16}/> : <Sparkles size={16}/>} {busy ? "جارٍ بناء الفهرس..." : "إنشاء / تحديث فهرس المعرفة"}
        </button>
        <Link href="/platform-admin/ai" className="portal-button secondary"><ArrowRight size={15}/> العودة لإدارة الذكاء الاصطناعي</Link>
      </div>
      {busy && <div aria-live="polite">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><small>تقدم الفهرسة</small><strong>{progress.done.toLocaleString("ar-EG")} / {progress.total.toLocaleString("ar-EG")}</strong></div>
        <div style={{ height: 9, borderRadius: 20, background: "var(--portal-border, #e5eaed)", overflow: "hidden" }}><div style={{ width: percent + "%", height: "100%", background: "var(--portal-accent, #00a99d)", transition: "width .2s ease" }}/></div>
      </div>}
      {error && <div className="portal-callout" role="alert">{error}</div>}
      {notice && <div className="portal-callout" role="status"><CheckCircle2 size={16}/>{notice}</div>}
    </section>

    <section className="portal-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}><Database size={19} style={{ verticalAlign: "middle" }}/> إعداد MongoDB Atlas Vector Search</h2>
      <p>أنشئ فهرس Vector Search على مجموعة <code>platform_ai_knowledge_chunks</code> داخل قاعدة بيانات اتزان، وسمّه <code>{data?.config.vectorIndexName || "etzan_ai_knowledge_vector"}</code>.</p>
      <pre dir="ltr" style={{ whiteSpace: "pre-wrap", overflowX: "auto", padding: 14, borderRadius: 10, background: "var(--portal-soft, #f4f6f7)", fontSize: 12 }}>{indexDefinition}</pre>
      <p>التعريف أعلاه مطابق للنموذج الافتراضي ذي 1536 بُعدًا. عند تغيير نموذج التضمين، يجب ضبط <code>ETZAN_AI_EMBEDDING_DIMENSIONS</code> بما يطابق أبعاد النموذج ثم إعادة إنشاء فهرس Atlas وإعادة الفهرسة.</p>
      <p>بعد اكتمال إنشاء فهرس Atlas، أضف متغيري البيئة التاليين إلى بيئة الخادم:</p>
      <pre dir="ltr" style={{ whiteSpace: "pre-wrap", padding: 14, borderRadius: 10, background: "var(--portal-soft, #f4f6f7)", fontSize: 12 }}>ETZAN_AI_VECTOR_SEARCH_ENABLED=true{"\n"}ETZAN_AI_VECTOR_INDEX_NAME=etzan_ai_knowledge_vector</pre>
      <p style={{ marginBottom: 0, fontSize: 13, opacity: .8 }}>إنشاء الفهرس يرسل نصوص المحتوى المنشور إلى مزود التضمين المحدد عبر AI Gateway. راجع اتفاقية المعالجة وموقع البيانات وتكلفة التضمينات قبل التفعيل. لا يتم تنفيذ أي نشر أو تفعيل مدفوع تلقائيًا.</p>
    </section>
  </PlatformLayout>;
}
