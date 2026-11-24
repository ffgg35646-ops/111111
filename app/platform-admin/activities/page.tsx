"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, LoaderCircle, LogOut, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

const reviewFields = [
  { key: "communication", label: "التواصل وبناء العلاقة" },
  { key: "activeListening", label: "الإنصات وجمع المعلومات" },
  { key: "evidenceReasoning", label: "الاستدلال وربط الفرضيات بالأدلة" },
  { key: "assessmentSelection", label: "اختيار المقياس وحدود استخدامه" },
  { key: "strengthsBasedPractice", label: "مراعاة نقاط القوة ووجهة نظر الحالة" },
  { key: "planningAndReferral", label: "خطة الدعم والإحالة والمتابعة" },
  { key: "professionalBoundaries", label: "السلامة وحدود الاختصاص والخصوصية" },
] as const;

type ReviewDraft = { scores: Record<string, string>; feedbackNotes: string };
type Activity = {
  activityId: string; caseId: string; caseTitle: string; score: number; completedAt: string;
  trainee?: { name?: string; email?: string; role?: string };
  clinicalFormulation: {
    presentingConcern: string; historyAndContext: string; observations: string; strengths: string;
    hypotheses: string; missingInformation: string; nextSteps: string; selectedScaleTitle: string; reviewStatus: string;
  };
  conversationTurns: { role: "user" | "assistant"; content: string }[];
  simulationMode?: string;
  aiReview?: { summary: string; strengths: string[]; improvements: string[]; safetyObservations: string[]; nextPractice: string; rubricScores?: { key: string; label: string; score: number; evidence: string }[]; rubricWeightedScore?: number } | null;
  rubricSnapshot?: { rubricId: string; title: string; criteria: { key: string; label: string; weight: number; maxScore: number }[]; version?: number };
  aiReviewStatus?: string;
  experienceMode: string;
  vrHeadTrackingSamples?: number;
  vrHandMetrics?: { samples: number; pinchInteractions: number };
  supervisorReview?: { scores: Record<string, number>; overallScore: number; weightedScore?: number; feedbackNotes: string; reviewedAt: string };
};

function emptyDraft(): ReviewDraft {
  return { scores: Object.fromEntries(reviewFields.map((field) => [field.key, ""])), feedbackNotes: "" };
}

export default function SimulationActivityReviewPage() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  const loadActivities = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/activities", { cache: "no-store" });
      const result = await response.json();
      if (response.status === 401 || response.status === 403) {
        router.replace("/login?next=/platform-admin/activities");
        return;
      }
      if (!response.ok) throw new Error(result.error || "تعذر تحميل تقارير المحاكاة.");
      const rows: Activity[] = Array.isArray(result.activities) ? result.activities : [];
      setActivities(rows); setAuthenticated(true);
      setDrafts((current) => {
        const next = { ...current };
        for (const activity of rows) {
          if (activity.supervisorReview && !next[activity.activityId]) {
            next[activity.activityId] = {
              scores: Object.fromEntries(getReviewFields(activity).map((field) => [field.key, String(activity.supervisorReview?.scores?.[field.key] ?? "")])),
              feedbackNotes: activity.supervisorReview.feedbackNotes || "",
            };
          }
        }
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل تقارير المحاكاة.");
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!active) return;
      if (!response.ok) { router.replace("/login?next=/platform-admin/activities"); return; }
      if (result.user?.mustChangePassword) { router.replace("/account/change-password"); return; }
      if (!["admin", "platform_manager", "supervisor", "trainer", "quality_manager"].includes(result.user?.role)) { router.replace("/"); return; }
      void loadActivities();
    }).catch(() => { if (active) router.replace("/login?next=/platform-admin/activities"); });
    return () => { active = false; };
  }, [loadActivities, router]);

  const updateDraft = (activityId: string, update: Partial<ReviewDraft>) => {
    setDrafts((current) => ({ ...current, [activityId]: { ...emptyDraft(), ...current[activityId], ...update } }));
  };

  const saveReview = async (activity: Activity) => {
    const fields = getReviewFields(activity);\n    const draft = drafts[activity.activityId] || emptyDraft(activity);
    setSavingId(activity.activityId); setError(""); setNotice("");
    try {
      const scores = Object.fromEntries(fields.map((field) => [field.key, Number(draft.scores[field.key])]));
      const response = await fetch("/api/platform/activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: activity.activityId, scores, feedbackNotes: draft.feedbackNotes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر حفظ مراجعة المشرف.");
      setNotice("تم حفظ مراجعة المشرف وربطها بتقرير دراسة الحالة.");
      await loadActivities();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ مراجعة المشرف.");
    } finally { setSavingId(""); }
  };

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login"); router.refresh();
  }

  return (
    <PlatformLayout title="مراجعة تقارير المحاكاة السريرية" description="افتح دراسة الحالة والحوار الذي أجراه المتدرب، ثم قيّم الأداء وفق محاور موحدة واحفظ التغذية الراجعة في سجل الجلسة.">
      <div className="portal-callout"><ShieldCheck size={16} /> لا تعرض هذه الصفحة إلا سجلات التدريب الخيالية. الدرجات تقدير إشرافي تعليمي وليست تشخيصاً أو ترخيصاً مهنياً.</div>
      <section className="portal-card" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <strong>{authenticated ? "جلسة مراجعة بصلاحية المشرف أو مدير المنصة أو مسؤول الجودة" : "جارٍ التحقق من الصلاحية..."}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="portal-button secondary" disabled={loading || !authenticated} onClick={() => void loadActivities()}>{loading ? <LoaderCircle size={15} /> : <RefreshCw size={15} />} تحديث التقارير</button>
          <button className="portal-button secondary" onClick={() => void logout()}><LogOut size={15} /> تسجيل الخروج</button>
        </div>
      </section>
      {error && <div className="portal-callout" role="alert">{error}</div>}
      {notice && <div className="portal-callout"><ClipboardCheck size={15} /> {notice}</div>}
      {activities.length > 0 && <div className="portal-section-title"><div><h2>جلسات المحاكاة المحفوظة</h2><p>يعرض النظام آخر {activities.length} جلسة مسجلة.</p></div></div>}
      {activities.map((activity) => {
        const draft = drafts[activity.activityId] || emptyDraft();
        const reviewed = activity.supervisorReview;
        return (
          <article className="portal-card" key={activity.activityId} style={{ marginBottom: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div><span className="portal-chip">{activity.clinicalFormulation?.selectedScaleTitle || "لم يحدد مقياساً"}</span><h3 style={{ margin: "9px 0 4px" }}>{activity.caseTitle}</h3><small style={{ color: "#7b8c91" }}>{activity.trainee?.name ? activity.trainee.name + " · " : ""}{new Date(activity.completedAt).toLocaleString("ar-EG")} · {activity.experienceMode === "webxr-immersive-vr" ? "VR غامر" : "غرفة ثلاثية الأبعاد"}</small></div>
              <div style={{ textAlign: "left" }}><strong style={{ color: "#177f75", fontSize: 22 }}>{activity.score}/100</strong><small style={{ display: "block", color: "#8a999c" }}>درجة خطوات الحالة</small><b style={{ color: reviewed ? "#237d61" : "#9a7842", fontSize: 10 }}>{reviewed ? "تمت مراجعة المشرف" : "بانتظار مراجعة المشرف"}</b></div>
            </div>
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", color: "#287b72", fontWeight: 700, fontSize: 12 }}>عرض دراسة الحالة المكتوبة</summary>
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {[
                  ["المشكلة أو الاحتياج", activity.clinicalFormulation?.presentingConcern],
                  ["التاريخ والسياق", activity.clinicalFormulation?.historyAndContext],
                  ["الملاحظات", activity.clinicalFormulation?.observations],
                  ["نقاط القوة", activity.clinicalFormulation?.strengths],
                  ["الفرضيات التعليمية", activity.clinicalFormulation?.hypotheses],
                  ["المعلومات الناقصة", activity.clinicalFormulation?.missingInformation],
                  ["الخطوات التالية والإحالة", activity.clinicalFormulation?.nextSteps],
                ].map(([label, value]) => <div key={String(label)}><b style={{ fontSize: 10, color: "#49666c" }}>{label}</b><p style={{ margin: "4px 0 0", fontSize: 11, color: "#71848a", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{value || "—"}</p></div>)}
              </div>
            </details>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", color: "#287b72", fontWeight: 700, fontSize: 12 }}>عرض الحوار مع الشخصية الافتراضية ({activity.conversationTurns?.length || 0} رسالة)</summary>
              <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
                {(activity.conversationTurns || []).map((turn, index) => <p key={index} style={{ margin: 0, padding: 9, borderRadius: 7, background: turn.role === "user" ? "#f0f7f5" : "#f7f8f9", fontSize: 10, color: "#60777c", lineHeight: 1.8 }}><b>{turn.role === "user" ? "المتدرب" : "الشخصية"}: </b>{turn.content}</p>)}
              </div>
            </details>
            <section style={{ marginTop: 14, padding: 13, borderRadius: 10, background: "#f5f8f7" }}>
              <strong style={{ fontSize: 12, color: "#276f68" }}>مراجعة الذكاء الاصطناعي المساعدة</strong>
              {activity.aiReview ? <><p style={{ fontSize: 11, lineHeight: 1.9 }}>{activity.aiReview.summary}</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>{[["نقاط القوة",activity.aiReview.strengths],["جوانب التحسين",activity.aiReview.improvements],["ملاحظات السلامة",activity.aiReview.safetyObservations]].map(([label,items])=><div key={String(label)}><b style={{ fontSize: 10 }}>{label}</b><ul style={{ paddingRight: 18, fontSize: 10, lineHeight: 1.8 }}>{(items as string[]).map((item,index)=><li key={index}>{item}</li>)}</ul></div>)}</div><p style={{ fontSize: 10 }}>التدريب التالي المقترح: {activity.aiReview.nextPractice}</p>{activity.aiReview.rubricScores?.length ? <div style={{ marginTop: 10, borderTop: "1px solid #e4ece9", paddingTop: 9 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b style={{ fontSize: 10 }}>نتائج محاور المعيار: {activity.rubricSnapshot?.title || "المعيار المهني العام"}</b><b style={{ fontSize: 10, color: "#167b6d" }}>النتيجة الموزونة: {activity.aiReview.rubricWeightedScore ?? "—"}/100</b></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginTop: 8 }}>{activity.aiReview.rubricScores.map((item) => <div key={item.key} style={{ background: "#fff", borderRadius: 7, padding: 8 }}><b style={{ fontSize: 10 }}>{item.label} · {item.score}/5</b><p style={{ fontSize: 9, margin: "4px 0 0", lineHeight: 1.7 }}>{item.evidence}</p></div>)}</div></div> : null}</> : <p style={{ fontSize: 10 }}>لم يتوفر تحليل آلي لهذه الجلسة ({activity.aiReviewStatus||"غير مسجل"}). يمكن للمشرف مراجعة الحوار يدوياً.</p>}
              <small style={{ color: "#82918f", fontSize: 9 }}>تحليل تعليمي آلي مساعد، وليس تشخيصاً أو حكماً مهنياً نهائياً.</small>
            </section>
            <section style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid #edf1f1" }}>
              <strong style={{ fontSize: 12, color: "#46666a" }}>تقييم المدرب (0 إلى 5 لكل محور وفق المعيار المختار)</strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 10 }}>
                {getReviewFields(activity).map((field) => <label key={field.key} style={{ display: "grid", gap: 5, fontSize: 10, color: "#60777c" }}>{field.label}<select value={draft.scores[field.key] || ""} onChange={(event) => updateDraft(activity, { scores: { ...draft.scores, [field.key]: event.target.value } })} style={{ padding: 9, border: "1px solid #dce5e9", borderRadius: 7, background: "#fff" }}><option value="">اختر الدرجة</option>{[0,1,2,3,4,5].map((score) => <option key={score} value={score}>{score} / 5</option>)}</select></label>)}
              </div>
              <label style={{ display: "grid", gap: 6, marginTop: 11, fontSize: 10, color: "#60777c" }}>ملاحظات المشرف ونقاط التحسين<textarea value={draft.feedbackNotes} onChange={(event) => updateDraft(activity, { feedbackNotes: event.target.value })} rows={3} maxLength={2000} placeholder="اذكر ما أُنجز جيداً، وما يحتاج إلى تطوير، وسؤالاً تدريبياً للمتدرب." style={{ padding: 10, border: "1px solid #dce5e9", borderRadius: 7, lineHeight: 1.8 }} /></label>
              {reviewed && <p style={{ color: "#60817a", fontSize: 10 }}>آخر متوسط إشرافي: {reviewed.overallScore}/5 · {reviewed.weightedScore ?? "—"}/100 موزون · {new Date(reviewed.reviewedAt).toLocaleString("ar-EG")}</p>}
              <button className="portal-button" onClick={() => void saveReview(activity)} disabled={savingId === activity.activityId || getReviewFields(activity).some((field) => !draft.scores[field.key]) || draft.feedbackNotes.trim().length < 10} style={{ marginTop: 10 }}>
                {savingId === activity.activityId ? <LoaderCircle size={15} /> : <Save size={15} />} حفظ مراجعة المشرف
              </button>
              <small style={{ display: "block", color: "#87969a", fontSize: 9, marginTop: 7 }}>يُحفظ التقييم كمراجعة تعليمية مرتبطة بالجلسة، مع إبقاء الدرجة الآلية لخطوات الحالة منفصلة.</small>
            </section>
          </article>
        );
      })}
      {!loading && authenticated && activities.length === 0 && <div className="portal-card"><p>لا توجد جلسات محاكاة محفوظة بعد.</p></div>}
    </PlatformLayout>
  );
}
