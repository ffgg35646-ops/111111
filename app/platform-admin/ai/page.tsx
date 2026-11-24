"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, Brain, Coins, FileQuestion, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type UsageRow = {
  usageId: string; feature: string; provider: string; model: string; actorRole: string;
  inputTokens: number | null; outputTokens: number | null; totalTokens: number | null;
  costUsd: number | null; currency: string | null; costStatus: string; eventStatus: string;
  note: string | null; occurredAt: string; referenceId: string | null;
};
type UsageData = {
  totals: { totalCalls: number; inputTokens: number; outputTokens: number; reportedSpendUsd: number; reportedCostCalls: number; pendingCostCalls: number; unavailableCostCalls: number };
  pendingQuizDrafts: number; inactiveAiScenarios: number; rows: UsageRow[];
};

const featureLabels: Record<string, string> = {
  knowledge_assistant: "البحث الذكي", learner_explanation: "شرح المحتوى",
  quiz_draft_generation: "إنشاء أسئلة", scenario_draft_generation: "إنشاء سيناريو",
  clinical_chat: "محادثة المحاكاة", simulation_performance_review: "تحليل أداء المحاكاة",
  realtime_voice_session: "بدء جلسة صوت حي",
};
const roleLabels: Record<string, string> = {
  admin: "مدير النظام", platform_manager: "مدير المنصة", supervisor: "المشرف",
  trainer: "المدرب", trainee: "المتدرب", consultant: "مقدم الاستشارة",
  content_manager: "مسؤول المحتوى", quality_manager: "مسؤول الجودة",
};
const dateLabel = (value: string) => value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function AdminAiPage() {
  const router = useRouter();
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/platform/admin/ai-usage", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل سجل الاستخدام.");
      setData(payload as UsageData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل سجل الاستخدام.");
    } finally { setLoading(false); }
  }
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      const session = await response.json();
      if (!response.ok || !session.authenticated || !["admin", "platform_manager"].includes(session.user?.role)) {
        router.replace("/login?next=/platform-admin/ai");
        return;
      }
      if (session.user?.mustChangePassword) { router.replace("/account/change-password"); return; }
      void load();
    }).catch(() => router.replace("/login?next=/platform-admin/ai"));
  }, [router]);

  const totals = data?.totals;
  return <PlatformLayout title="إدارة الذكاء الاصطناعي" eyebrow="ETZAN · AI OPERATIONS" description="متابعة استهلاك النماذج، مراجعة التكلفة المبلغ عنها، وإدارة نقاط التكامل والتطوير.">
    <div className="portal-callout" style={{ marginBottom: 16 }}><ShieldCheck size={17}/> مفاتيح الربط تبقى في بيئة الخادم ولا تُعرض في لوحة الإدارة. لا يتم إنشاء مفاتيح أو شراء رصيد أو تفعيل تكامل مدفوع تلقائياً.</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      <article className="portal-card"><Activity size={20}/><small>طلبات الذكاء الاصطناعي المسجلة</small><h2>{totals?.totalCalls?.toLocaleString("ar-EG") ?? "—"}</h2></article>
      <article className="portal-card"><Brain size={20}/><small>إجمالي الرموز المسجلة</small><h2>{totals ? (totals.inputTokens + totals.outputTokens).toLocaleString("ar-EG") : "—"}</h2></article>
      <article className="portal-card"><Coins size={20}/><small>التكلفة التي أبلغ عنها المزوّد (USD)</small><h2>{totals ? totals.reportedSpendUsd.toFixed(6) : "—"}</h2><small>لا تشمل العمليات التي لم يُرجع المزوّد تكلفتها.</small></article>
      <article className="portal-card"><FileQuestion size={20}/><small>مسودات اختبارات بانتظار الاعتماد</small><h2>{data?.pendingQuizDrafts ?? "—"}</h2></article>
    </div>

    <section className="portal-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>حالة مكونات الذكاء الاصطناعي</h2><small>الموديل النصي يختار من CLINICAL_AI_MODEL عبر Vercel AI Gateway.</small></div>
        <button type="button" className="portal-button secondary" onClick={load} disabled={loading}><RefreshCw size={15}/> تحديث السجل</button>
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <div><strong>المساعد والشرح وإنشاء المحتوى:</strong> يعتمد على AI Gateway ومفتاح الخادم AI_GATEWAY_API_KEY أو مصادقة Vercel OIDC.</div>
        <div><strong>الصوت الحي:</strong> مسار منفصل يحتاج OPENAI_API_KEY وإعدادات CLINICAL_REALTIME_MODEL وCLINICAL_REALTIME_VOICE. يسجل النظام بدء الجلسة، لكن لا يسجل تكلفتها الفعلية بعد؛ تظهر تكلفة الاستخدام من لوحة مزود الصوت.</div>
        <div><strong>المحاكاة وتقييم الأداء:</strong> يستخدمان نموذج CLINICAL_AI_MODEL نفسه، مع بقاء مراجعة المدرب/المشرف مستقلة عن التقييم الآلي.</div>
      </div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 16 }}>
        <Link href="/assistant" className="portal-button"><Sparkles size={15}/> تجربة مساعد اتزان</Link>
        <Link href="/simulation/manage" className="portal-button secondary">إدارة السيناريوهات</Link>
        <Link href="/platform-admin/activities" className="portal-button secondary">مراجعة تقارير المحاكاة</Link>
      </div>
    </section>

    <section className="portal-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>سجل الاستخدام والتكلفة</h2>
      <p style={{ fontSize: 13 }}>حالة «مبلّغ عنها» تعني أن بيانات التكلفة وصلت من بوابة الذكاء الاصطناعي. «قيد التحقق» تعني وجود معرّف توليد دون قيمة تكلفة بعد. «غير متاحة» تعني أن المزوّد لم يرسل تكلفة لهذه العملية؛ لا يتم تقديرها أو اختلاقها.</p>
      {error && <div className="portal-callout" role="alert">{error}</div>}
      {loading && <div>جارٍ تحميل السجل...</div>}
      {!loading && data && <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr>{["التاريخ","الخدمة","المزوّد / النموذج","الدور","الرموز","التكلفة USD","حالة التكلفة"].map((label) => <th key={label} style={{ textAlign: "right", padding: 9, borderBottom: "1px solid var(--portal-border, #e5eaed)" }}>{label}</th>)}</tr></thead>
          <tbody>
            {data.rows.map((row) => <tr key={row.usageId}>
              <td style={{ padding: 9, borderBottom: "1px solid var(--portal-border, #e5eaed)" }}>{dateLabel(row.occurredAt)}</td>
              <td style={{ padding: 9, borderBottom: "1px solid var(--portal-border, #e5eaed)" }}>{featureLabels[row.feature] || row.feature}</td>
              <td style={{ padding: 9, borderBottom: "1px solid var(--portal-border, #e5eaed)" }}><small>{row.provider}</small><br/>{row.model}</td>
              <td style={{ padding: 9, borderBottom: "1px solid var(--portal-border, #e5eaed)" }}>{roleLabels[row.actorRole] || row.actorRole}</td>
              <td style={{ padding: 9, borderBottom: "1px solid var(--portal-border, #e5eaed)" }}>{row.totalTokens?.toLocaleString("ar-EG") ?? "—"}</td>
              <td style={{ padding: 9, borderBottom: "1px solid var(--portal-border, #e5eaed)" }}>{row.costUsd === null ? "—" : row.costUsd.toFixed(6)}</td>
              <td style={{ padding: 9, borderBottom: "1px solid var(--portal-border, #e5eaed)" }}>{row.costStatus === "reported" ? "مبلّغ عنها" : row.costStatus === "pending" ? "قيد التحقق" : "غير متاحة"}</td>
            </tr>)}
            {!data.rows.length && <tr><td colSpan={7} style={{ padding: 16, textAlign: "center" }}>لا توجد عمليات مسجلة حتى الآن.</td></tr>}
          </tbody>
        </table>
      </div>}
    </section>
    <section className="portal-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>بوابات التطوير المستقبلية</h2>
      <p>المحاكاة تعتمد على تعريفات سيناريو ومعايير تقييم محفوظة في MongoDB وواجهات مستقلة للصوت والنص والتقارير. يمكن إضافة موفّر AI جديد أو مكوّن XR جديد عبر طبقة ربط وإضافة نوع بيانات/قياس جديد، دون استبدال حسابات المنصة والأكاديمية والتقارير. لكن اعتماد محرك أو نظارة جديدة يتطلب تطوير المحوّل واختباره على الأجهزة المستهدفة.</p>
      <small>عدد السيناريوهات المولدة آلياً وغير المفعّلة: {data?.inactiveAiScenarios ?? "—"}</small>
    </section>
  </PlatformLayout>;
}
