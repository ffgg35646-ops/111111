"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, FilePlus2, Save, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type StepChoice = { id: string; label: string; score: number; feedback: string };
type ScenarioStep = { id: string; title: string; focus: string; prompt: string; choices: StepChoice[] };
type Scenario = {
  scenarioId: string; id: string; title: string; track: string; ageGroup: string; setting: string;
  briefing: string; learningGoals: string[]; safetyNote: string; steps: ScenarioStep[];
  personaInstructions?: string; hiddenContext?: string; avatarModelUrl?: string; avatarLabel?: string;
  status: "active" | "inactive"; version?: number;
};
type Criterion = { key: string; label: string; description: string; weight: number; maxScore: number };
type Rubric = { rubricId: string; title: string; trackId: string; description: string; criteria: Criterion[]; status?: "active" | "inactive"; version?: number };

const starterSteps: ScenarioStep[] = [
  { id: "opening", title: "بناء العلاقة المهنية", focus: "الافتتاح والموافقة", prompt: "كيف تبدأ المقابلة وتوضح دورك وحدود السرية؟", choices: [
    { id: "open_good", label: "أعرّف بنفسي وأوضح الهدف والسرية وحدودها وأطلب الموافقة", score: 20, feedback: "افتتاح مهني يحترم حق المستفيد في المعرفة والموافقة." },
    { id: "open_fast", label: "أبدأ بالأسئلة التفصيلية دون تمهيد", score: 5, feedback: "ابدأ ببناء العلاقة وشرح إطار المقابلة." },
  ] },
  { id: "explore", title: "استكشاف المشكلة والسياق", focus: "الإنصات وجمع المعلومات", prompt: "ما السؤال المفتوح الذي يساعدك على فهم وجهة نظر الحالة؟", choices: [
    { id: "explore_good", label: "اطلب من الحالة وصف ما يقلقها وكيف يؤثر في حياتها", score: 20, feedback: "السؤال المفتوح يتيح رواية الحالة بلغتها." },
    { id: "explore_lead", label: "أقترح السبب وأطلب منها تأكيده", score: 3, feedback: "تجنب الأسئلة الموجهة والافتراضات المبكرة." },
  ] },
  { id: "plan", title: "تحديد الخطوات التالية", focus: "التخطيط والإحالة", prompt: "كيف تتفق مع الحالة على خطوة تالية آمنة وقابلة للمتابعة؟", choices: [
    { id: "plan_good", label: "ألخص ما فهمته وأتفق على خطوة محددة ومسؤولية متابعة", score: 20, feedback: "الخطة المشتركة تجعل التدخل واضحاً وقابلاً للمراجعة." },
    { id: "plan_rush", label: "أقرر الخطة منفرداً دون إشراك الحالة", score: 2, feedback: "أشرك الحالة واحترم تفضيلاتها وحدود اختصاصك." },
  ] },
];

const defaultCriteria: Criterion[] = [
  { key: "communication", label: "التواصل وبناء العلاقة", description: "الافتتاح المهني والاحترام والوضوح.", weight: 15, maxScore: 5 },
  { key: "activeListening", label: "الإنصات وجمع المعلومات", description: "الأسئلة المفتوحة والاستيضاح وتلخيص المعلومات.", weight: 20, maxScore: 5 },
  { key: "evidenceReasoning", label: "الاستدلال وربط الفرضيات بالأدلة", description: "الفصل بين الوقائع والملاحظات والفرضيات والبدائل.", weight: 20, maxScore: 5 },
  { key: "assessmentSelection", label: "اختيار الأداة وحدود استخدامها", description: "ملاءمة الأداة والغرض ومراعاة حدود القياس.", weight: 10, maxScore: 5 },
  { key: "strengthsBasedPractice", label: "مراعاة نقاط القوة ووجهة نظر الحالة", description: "النهج المرتكز على الشخص والموارد والتفضيلات.", weight: 10, maxScore: 5 },
  { key: "planningAndReferral", label: "خطة الدعم والإحالة والمتابعة", description: "خطوات قابلة للقياس وتحديد مسؤوليات المتابعة.", weight: 15, maxScore: 5 },
  { key: "professionalBoundaries", label: "السلامة وحدود الاختصاص والخصوصية", description: "الموافقة والسرية والسلامة والإحالة عند الحاجة.", weight: 10, maxScore: 5 },
];

const stepsJson = (steps: ScenarioStep[]) => JSON.stringify(steps, null, 2);
const criteriaJson = (criteria: Criterion[]) => JSON.stringify(criteria, null, 2);

export default function SimulationManagementPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [tab, setTab] = useState<"scenarios" | "rubrics">("scenarios");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [title, setTitle] = useState("");
  const [track, setTrack] = useState("الخدمة الاجتماعية");
  const [ageGroup, setAgeGroup] = useState("بالغ");
  const [setting, setSetting] = useState("مكتب الخدمة الاجتماعية");
  const [briefing, setBriefing] = useState("");
  const [goals, setGoals] = useState("بناء علاقة مهنية\nجمع معلومات دقيقة\nوضع خطة دعم");
  const [safetyNote, setSafetyNote] = useState("هذه حالة خيالية للتدريب فقط. لا تستخدم بيانات مستفيد حقيقي، وأحِل المخاطر العاجلة إلى المشرف المختص.");
  const [personaInstructions, setPersonaInstructions] = useState("تحدث بضمير المتكلم وبأسلوب طبيعي. لا تكشف المعلومات المخفية دفعة واحدة، وأجب بحسب السؤال دون اختراع تفاصيل.");
  const [hiddenContext, setHiddenContext] = useState("");
  const [avatarModelUrl, setAvatarModelUrl] = useState("");
  const [avatarLabel, setAvatarLabel] = useState("");
  const [stepsText, setStepsText] = useState(stepsJson(starterSteps));
  const [scenarioActive, setScenarioActive] = useState(true);
  const [rubricId, setRubricId] = useState("");
  const [rubricTitle, setRubricTitle] = useState("معيار مهني مخصص");
  const [trackId, setTrackId] = useState("all");
  const [rubricDescription, setRubricDescription] = useState("معيار تقييم مخصص لهذا المسار التدريبي.");
  const [criteriaText, setCriteriaText] = useState(criteriaJson(defaultCriteria));
  const [rubricActive, setRubricActive] = useState(true);

  const totalWeight = useMemo(() => {
    try { return (JSON.parse(criteriaText) as Criterion[]).reduce((sum, item) => sum + Number(item.weight || 0), 0); }
    catch { return 0; }
  }, [criteriaText]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/platform/simulation-config?manage=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل إعدادات المحاكاة.");
      setScenarios(Array.isArray(data.scenarios) ? data.scenarios : []);
      setRubrics(Array.isArray(data.rubrics) ? data.rubrics : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل إعدادات المحاكاة."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resetScenario = () => {
    setScenarioId(""); setTitle(""); setTrack("الخدمة الاجتماعية"); setAgeGroup("بالغ"); setSetting("مكتب الخدمة الاجتماعية");
    setBriefing(""); setGoals("بناء علاقة مهنية\nجمع معلومات دقيقة\nوضع خطة دعم"); setSafetyNote("هذه حالة خيالية للتدريب فقط. لا تستخدم بيانات مستفيد حقيقي، وأحِل المخاطر العاجلة إلى المشرف المختص.");
    setPersonaInstructions("تحدث بضمير المتكلم وبأسلوب طبيعي. لا تكشف المعلومات المخفية دفعة واحدة، وأجب بحسب السؤال دون اختراع تفاصيل.");
    setHiddenContext(""); setAvatarModelUrl(""); setAvatarLabel(""); setStepsText(stepsJson(starterSteps)); setScenarioActive(true);
  };

  const editScenario = (item: Scenario) => {
    setTab("scenarios"); setScenarioId(item.scenarioId); setTitle(item.title); setTrack(item.track); setAgeGroup(item.ageGroup); setSetting(item.setting);
    setBriefing(item.briefing); setGoals(item.learningGoals.join("\n")); setSafetyNote(item.safetyNote); setPersonaInstructions(item.personaInstructions || "");
    setHiddenContext(item.hiddenContext || ""); setAvatarModelUrl(item.avatarModelUrl || ""); setAvatarLabel(item.avatarLabel || "");
    setStepsText(stepsJson(item.steps)); setScenarioActive(item.status !== "inactive");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveScenario = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const steps = JSON.parse(stepsText);
      if (!Array.isArray(steps)) throw new Error("مراحل السيناريو يجب أن تكون مصفوفة JSON.");
      const response = await fetch("/api/platform/simulation-config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "scenario", scenarioId: scenarioId || undefined, title, track, ageGroup, setting, briefing,
          learningGoals: goals.split("\n").map((value) => value.trim()).filter(Boolean), safetyNote, personaInstructions, hiddenContext,
          avatarModelUrl, avatarLabel, steps, isActive: scenarioActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ السيناريو.");
      setNotice("تم حفظ السيناريو في قاعدة البيانات، وأصبح متاحاً في مختبر المحاكاة بحسب حالة التفعيل.");
      await load();
      setScenarioId(data.scenario?.scenarioId || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ السيناريو."); }
    finally { setSaving(false); }
  };

  const editRubric = (item: Rubric) => {
    if (item.rubricId === "default-clinical-rubric") {
      setRubricId(""); setRubricTitle(item.title + " — نسخة مخصصة");
    } else { setRubricId(item.rubricId); setRubricTitle(item.title); }
    setTrackId(item.trackId); setRubricDescription(item.description); setCriteriaText(criteriaJson(item.criteria)); setRubricActive(item.status !== "inactive");
    setTab("rubrics"); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveRubric = async () => {
    setSaving(true); setError(""); setNotice("");
    try {
      const criteria = JSON.parse(criteriaText);
      if (!Array.isArray(criteria)) throw new Error("محاور التقييم يجب أن تكون مصفوفة JSON.");
      const response = await fetch("/api/platform/simulation-config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "rubric", rubricId: rubricId || undefined, title: rubricTitle, trackId, description: rubricDescription, criteria, isActive: rubricActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ معيار التقييم.");
      setNotice("تم حفظ معيار التقييم بإصدار جديد.");
      await load(); setRubricId(data.rubric?.rubricId || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ معيار التقييم."); }
    finally { setSaving(false); }
  };

  return (
    <PlatformLayout title="إدارة المحاكاة الافتراضية" eyebrow="ETZAN · SIMULATION STUDIO" description="إنشاء الحالات الافتراضية وتحريرها، وإدارة الشخصيات ومعايير التقييم المهني.">
      <div className="portal-callout" style={{ marginBottom: 16 }}><ShieldCheck size={17} /> الصلاحيات محمية من الخادم. لا تظهر الحالات غير النشطة للمتدربين، وتُحفظ التعديلات بإصدارات متتابعة.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" className={tab === "scenarios" ? "portal-button" : "portal-button secondary"} onClick={() => setTab("scenarios")}><BookOpen size={16} /> السيناريوهات</button>
        <button type="button" className={tab === "rubrics" ? "portal-button" : "portal-button secondary"} onClick={() => setTab("rubrics")}><ClipboardList size={16} /> معايير التقييم</button>
      </div>
      {error && <div className="portal-callout" role="alert" style={{ marginBottom: 14 }}>{error}</div>}
      {notice && <div className="portal-callout" role="status" style={{ marginBottom: 14 }}><CheckCircle2 size={16} /> {notice}</div>}
      {loading ? <div className="portal-card">جارٍ تحميل إعدادات المحاكاة...</div> : tab === "scenarios" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "start" }}>
          <section className="portal-card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h2 style={{ margin: 0 }}>{scenarioId ? "تعديل سيناريو" : "إضافة سيناريو جديد"}</h2><button type="button" className="portal-button secondary" onClick={resetScenario}><FilePlus2 size={15} /> جديد</button></div>
            <div className="portal-form-grid">
              <label>عنوان الحالة<input value={title} onChange={e => setTitle(e.target.value)} maxLength={140} /></label>
              <label>المسار التدريبي<input value={track} onChange={e => setTrack(e.target.value)} maxLength={120} /></label>
              <label>الفئة العمرية<input value={ageGroup} onChange={e => setAgeGroup(e.target.value)} maxLength={80} /></label>
              <label>بيئة الحالة<input value={setting} onChange={e => setSetting(e.target.value)} maxLength={120} /></label>
            </div>
            <label>ملخص الحالة<textarea value={briefing} onChange={e => setBriefing(e.target.value)} rows={4} maxLength={5000} placeholder="اكتب وصفاً خيالياً متماسكاً للحالة والسياق..." /></label>
            <label>الأهداف التعليمية — هدف في كل سطر<textarea value={goals} onChange={e => setGoals(e.target.value)} rows={3} /></label>
            <label>تعليمات الشخصية الافتراضية<textarea value={personaInstructions} onChange={e => setPersonaInstructions(e.target.value)} rows={3} /></label>
            <label>السياق المخفي للشخصية — لا يظهر في واجهة المتدرب<textarea value={hiddenContext} onChange={e => setHiddenContext(e.target.value)} rows={3} placeholder="تفاصيل لا تكشفها الشخصية إلا عندما يطرح المتدرب أسئلة مناسبة..." /></label>
            <div className="portal-form-grid">
              <label>رابط موديل الشخصية GLB / HTTPS<input value={avatarModelUrl} onChange={e => setAvatarModelUrl(e.target.value)} placeholder="/avatars/persona.glb" /></label>
              <label>اسم الشخصية الظاهر<input value={avatarLabel} onChange={e => setAvatarLabel(e.target.value)} placeholder="المراجع الافتراضي" /></label>
            </div>
            <label>ملاحظة السلامة المهنية<textarea value={safetyNote} onChange={e => setSafetyNote(e.target.value)} rows={2} /></label>
            <label>مراحل السيناريو والاختيارات — JSON<textarea value={stepsText} onChange={e => setStepsText(e.target.value)} rows={16} dir="ltr" style={{ fontFamily: "monospace", fontSize: 12 }} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={scenarioActive} onChange={e => setScenarioActive(e.target.checked)} /> تفعيل السيناريو وإتاحته للمتدربين</label>
            <button type="button" className="portal-button" onClick={saveScenario} disabled={saving}><Save size={16} /> {saving ? "جارٍ الحفظ..." : "حفظ السيناريو"}</button>
          </section>
          <aside className="portal-card" style={{ display: "grid", gap: 10 }}>
            <h3 style={{ margin: 0 }}>السيناريوهات المحفوظة ({scenarios.length})</h3>
            {scenarios.map(item => <article key={item.scenarioId} style={{ border: "1px solid var(--portal-border, #e5eaed)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{item.title}</b><span className="portal-chip">{item.status === "active" ? "نشط" : "متوقف"}</span></div>
              <small>{item.track} · {item.ageGroup} · الإصدار {item.version || 1}</small>
              <button type="button" className="portal-button secondary" style={{ marginTop: 8 }} onClick={() => editScenario(item)}>تعديل السيناريو</button>
            </article>)}
            {!scenarios.length && <p>لم تتم إضافة سيناريوهات مخصصة بعد.</p>}
          </aside>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "start" }}>
          <section className="portal-card" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><h2 style={{ margin: 0 }}>{rubricId ? "تعديل معيار" : "إنشاء معيار مخصص"}</h2><button type="button" className="portal-button secondary" onClick={() => { setRubricId(""); setRubricTitle("معيار مهني مخصص"); setTrackId("all"); setRubricDescription(""); setCriteriaText(criteriaJson(defaultCriteria)); setRubricActive(true); }}>جديد</button></div>
            <label>اسم المعيار<input value={rubricTitle} onChange={e => setRubricTitle(e.target.value)} maxLength={140} /></label>
            <label>المسار المرتبط<select value={trackId} onChange={e => setTrackId(e.target.value)}><option value="all">جميع المسارات</option><option value="social-work">الخدمة الاجتماعية</option><option value="mental-health">علم النفس</option><option value="cbt">العلاج المعرفي السلوكي</option><option value="family-guidance">الإرشاد الأسري</option><option value="developmental">الاضطرابات النمائية</option><option value="autism">طيف التوحد</option><option value="psychometrics">التقييم والقياس</option><option value="clinical-practice">الممارسة الإكلينيكية</option><option value="professional-development">التطوير المهني</option></select></label>
            <label>وصف المعيار<textarea value={rubricDescription} onChange={e => setRubricDescription(e.target.value)} rows={2} /></label>
            <label>محاور التقييم وأوزانها — JSON<textarea value={criteriaText} onChange={e => setCriteriaText(e.target.value)} rows={17} dir="ltr" style={{ fontFamily: "monospace", fontSize: 12 }} /></label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>مجموع الأوزان: <b style={{ color: totalWeight === 100 ? "#15966a" : "#c77a20" }}>{totalWeight}%</b></span><label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={rubricActive} onChange={e => setRubricActive(e.target.checked)} /> نشط</label></div>
            <button type="button" className="portal-button" onClick={saveRubric} disabled={saving || totalWeight !== 100}><Save size={16} /> {saving ? "جارٍ الحفظ..." : "حفظ معيار التقييم"}</button>
          </section>
          <aside className="portal-card" style={{ display: "grid", gap: 10 }}>
            <h3 style={{ margin: 0 }}>المعايير المتاحة ({rubrics.length})</h3>
            {rubrics.map(item => <article key={item.rubricId} style={{ border: "1px solid var(--portal-border, #e5eaed)", borderRadius: 12, padding: 12 }}>
              <b>{item.title}</b><small style={{ display: "block" }}>{item.trackId === "all" ? "جميع المسارات" : item.trackId} · {item.criteria.length} محاور · الإصدار {item.version || 1}</small>
              <button type="button" className="portal-button secondary" style={{ marginTop: 8 }} onClick={() => editRubric(item)}>استخدام / نسخ للتعديل</button>
            </article>)}
          </aside>
        </div>
      )}
      <div style={{ marginTop: 18 }}><Link href="/simulation" className="portal-button secondary"><ArrowRight size={15} /> العودة إلى مختبر المحاكاة</Link></div>
    </PlatformLayout>
  );
}
