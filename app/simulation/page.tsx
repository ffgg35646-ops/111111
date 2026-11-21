"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardCheck, Info, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { getCaseById, trainingCases } from "@/lib/platform-catalog";
import "./simulation.css";

const ClinicalRoomStage = dynamic(() => import("@/components/clinical-room-stage"), {
  ssr: false,
  loading: () => <div className="simulation-stage-loading">جارٍ تجهيز الغرفة الافتراضية...</div>,
});

type RoomEvent = { type: string; label: string; occurredAt: string };

function SimulationWorkspace() {
  const params = useSearchParams();
  const [caseId, setCaseId] = useState(trainingCases[0].id);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("الشخصية الافتراضية");
  const [completed, setCompleted] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [roomEvents, setRoomEvents] = useState<RoomEvent[]>([
    { type: "room_entered", label: "بدء دخول القاعة الافتراضية", occurredAt: new Date().toISOString() },
  ]);
  const [immersiveMode, setImmersiveMode] = useState(false);

  useEffect(() => {
    const query = params.get("case");
    if (query && trainingCases.some((item) => item.id === query)) setCaseId(query);
  }, [params]);

  const activeCase = useMemo(() => getCaseById(caseId), [caseId]);
  const activeStep = activeCase.steps[stepIndex];
  const voicePersona = activeCase.ageGroup === "طفل" ? "child" : activeCase.ageGroup === "مراهق" ? "teen" : activeCase.track === "الخدمة الاجتماعية" ? "mother" : "father";
  const voiceScenario = "العنوان: " + activeCase.title +
    "\nنوع الحالة: " + activeCase.track +
    "\nالعمر/الفئة: " + activeCase.ageGroup +
    "\nمكان المقابلة: " + activeCase.setting +
    "\nملخص الحالة: " + activeCase.briefing +
    "\nأهداف التدريب: " + activeCase.learningGoals.join("، ") +
    "\nتعليمات الشخصية: أجب من منظور الشخصية فقط وبما يتناسب مع المعلومات الواردة في الملخص. لا تكشف كل التفاصيل دفعة واحدة. لا تخترع معلومات طبية أو اجتماعية غير مذكورة. لا تقدم تشخيصاً أو علاجاً.\n";
  const voiceHref = "/voice?persona=" + voicePersona + "&scenario=" + encodeURIComponent(voiceScenario);
  const answeredCount = activeCase.steps.filter((step) => Boolean(answers[step.id])).length;

  const recordRoomEvent = (type: string, label: string) => {
    setRoomEvents((current) => [
      ...current,
      { type, label: label.slice(0, 160), occurredAt: new Date().toISOString() },
    ].slice(-120));
  };

  const changeCase = (id: string) => {
    setCaseId(id);
    setStepIndex(0);
    setAnswers({});
    setFeedback("");
    setCompleted(false);
    setSavedScore(null);
    setError("");
    setRoomEvents([{ type: "room_entered", label: "بدء حالة تدريبية جديدة", occurredAt: new Date().toISOString() }]);
    window.history.replaceState(null, "", "/simulation?case=" + id);
  };

  const choose = (choiceId: string) => {
    const choice = activeStep.choices.find((item) => item.id === choiceId);
    setAnswers((current) => ({ ...current, [activeStep.id]: choiceId }));
    setFeedback(choice?.feedback ?? "");
    recordRoomEvent("assessment_choice_selected", activeStep.title + ": " + (choice?.label ?? choiceId));
  };

  const moveToStep = (index: number) => {
    const nextIndex = Math.max(0, Math.min(activeCase.steps.length - 1, index));
    setStepIndex(nextIndex);
    setFeedback(activeCase.steps[nextIndex].choices.find((choice) => choice.id === answers[activeCase.steps[nextIndex].id])?.feedback ?? "");
    recordRoomEvent("step_changed", "الانتقال إلى المرحلة: " + activeCase.steps[nextIndex].title);
  };

  const finish = async () => {
    if (answeredCount !== activeCase.steps.length || saving) return;
    setSaving(true);
    setError("");
    const completionEvent: RoomEvent = {
      type: "assessment_completed",
      label: "إنهاء التقييم داخل القاعة الافتراضية",
      occurredAt: new Date().toISOString(),
    };
    const finalRoomEvents = [...roomEvents, completionEvent].slice(-120);
    setRoomEvents(finalRoomEvents);

    try {
      const response = await fetch("/api/platform/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: activeCase.id,
          answers: activeCase.steps.map((step) => ({ stepId: step.id, choiceId: answers[step.id] })),
          roomEvents: finalRoomEvents,
          experienceMode: immersiveMode ? "webxr-immersive-vr" : "browser-3d-room",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر حفظ نتيجة التدريب.");
      setSavedScore(result.score);
      setCompleted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ نتيجة التدريب.");
    } finally {
      setSaving(false);
    }
  };

  const restart = () => {
    setStepIndex(0);
    setAnswers({});
    setFeedback("");
    setCompleted(false);
    setSavedScore(null);
    setError("");
    setRoomEvents((current) => [
      ...current,
      { type: "assessment_restarted", label: "إعادة المحاكاة", occurredAt: new Date().toISOString() },
    ].slice(-120));
  };

  return (
    <PlatformLayout
      title="قاعة المحاكاة ودراسة الحالة"
      eyebrow="IMMERSIVE VR CASE SIMULATION"
      description="ادخل القاعة الافتراضية، تفاعل مع الحالة، واتخذ قراراتك من لوحة التقييم الموجودة داخل المشهد ثلاثي الأبعاد."
    >
      <div className="simulation-toolbar">
        <label>اختر الحالة
          <select value={caseId} onChange={(event) => changeCase(event.target.value)}>
            {trainingCases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <div><span className="simulation-live-indicator" /> {immersiveMode ? "النظارة داخل جلسة VR غامرة" : "معاينة ثلاثية الأبعاد · لا يوجد مريض حقيقي"}</div>
      </div>

      <div className="simulation-layout">
        <section className="simulation-room-panel">
          <div className="simulation-panel-head">
            <div>
              <strong>غرفة المقابلة السريرية</strong>
              <small>اختر الإجابات وتقدم بين خطوات التقييم من اللوحة العائمة داخل القاعة باستخدام مؤشر النظارة أو وحدات التحكم</small>
            </div>
            <span className="room-ready-chip"><i /> الغرفة جاهزة</span>
          </div>
          <div className="simulation-stage-wrap">
            <ClinicalRoomStage
              onSelect={setSelectedTarget}
              onRoomEvent={recordRoomEvent}
              onImmersiveChange={setImmersiveMode}
              scenarioTitle={activeCase.title}
              step={{
                title: activeStep.title,
                focus: activeStep.focus,
                prompt: activeStep.prompt,
                choices: activeStep.choices.map((choice) => ({
                  id: choice.id,
                  label: choice.label,
                  score: choice.score,
                  feedback: choice.feedback,
                })),
              }}
              stepIndex={stepIndex}
              stepCount={activeCase.steps.length}
              selectedChoiceId={answers[activeStep.id] ?? null}
              completed={completed}
              score={savedScore}
              saving={saving}
              canFinish={answeredCount === activeCase.steps.length}
              onChoose={choose}
              onPrevious={() => moveToStep(stepIndex - 1)}
              onNext={() => moveToStep(stepIndex + 1)}
              onFinish={finish}
              onRestart={restart}
            />
          </div>
          <div className="simulation-scene-footer">
            <span>العنصر المحدد: <b>{selectedTarget}</b></span>
            <span>اسحب المشهد للتحريك · في النظارة استخدم الرأس والمؤشر أو وحدات التحكم</span>
          </div>
          <div className="simulation-case-brief">
            <div>
              <span className="portal-chip">{activeCase.track}</span>
              <h2>{activeCase.title}</h2>
              <p>{activeCase.briefing}</p>
            </div>
            <div className="case-brief-meta"><span>{activeCase.ageGroup}</span><span>{activeCase.setting}</span></div>
          </div>
        </section>

        <aside className="simulation-assessment-panel">
          {!completed ? (
            <>
              <div className="simulation-panel-head">
                <div><strong>ملخص التقييم المتزامن</strong><small>المرحلة {stepIndex + 1} من {activeCase.steps.length}</small></div>
                <b>{Math.round(answeredCount / activeCase.steps.length * 100)}%</b>
              </div>
              <div className="simulation-progress"><i style={{ width: (answeredCount / activeCase.steps.length * 100) + "%" }} /></div>
              <div className="simulation-step-list">
                {activeCase.steps.map((step, index) => (
                  <button key={step.id} className={index === stepIndex ? "active" : answers[step.id] ? "done" : ""} onClick={() => moveToStep(index)}>
                    <span>{answers[step.id] ? <CheckCircle2 size={15} /> : String(index + 1).padStart(2, "0")}</span>{step.title}
                  </button>
                ))}
              </div>
              <div className="simulation-current-task">
                <span>{activeStep.focus}</span>
                <h3>{activeStep.title}</h3>
                <p>{activeStep.prompt}</p>
              </div>
              <div className="simulation-choice-list">
                {activeStep.choices.map((choice) => (
                  <button key={choice.id} className={answers[activeStep.id] === choice.id ? "chosen" : ""} onClick={() => choose(choice.id)}>
                    <i />{choice.label}
                  </button>
                ))}
              </div>
              {feedback && <div className="simulation-feedback"><Sparkles size={15} /><p>{feedback}</p></div>}
              {error && <p className="simulation-error" role="alert">{error}</p>}
              <div className="simulation-step-actions">
                <button className="simulation-prev" onClick={() => moveToStep(stepIndex - 1)} disabled={stepIndex === 0}>السابق</button>
                {stepIndex < activeCase.steps.length - 1 ? (
                  <button className="simulation-next" onClick={() => moveToStep(stepIndex + 1)}>المرحلة التالية <ArrowRight size={14} /></button>
                ) : (
                  <button className="simulation-next" onClick={finish} disabled={saving || answeredCount !== activeCase.steps.length}>
                    {saving ? "جارٍ حساب وحفظ التقييم..." : <><ClipboardCheck size={15} /> إنهاء وتقييم الجلسة</>}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="simulation-result">
              <CheckCircle2 size={36} />
              <span>اكتملت المحاكاة</span>
              <strong>{savedScore}<small> / 100</small></strong>
              <p>{savedScore !== null && savedScore >= 80 ? "أداء تدريبي متقدم. راجع الملاحظات لتعزيز المهارات." : savedScore !== null && savedScore >= 60 ? "أداء جيد مع فرص لتحسين بعض خطوات الممارسة." : "راجع التغذية الراجعة وأعد المحاكاة لتعزيز المهارات."}</p>
              <div className="simulation-result-breakdown">
                {activeCase.steps.map((step) => {
                  const choice = step.choices.find((item) => item.id === answers[step.id]);
                  return <div key={step.id}><span>{step.title}</span><b>{choice?.score ?? 0}/20</b><small>{choice?.feedback}</small></div>;
                })}
              </div>
              <button className="simulation-next" onClick={restart}><RotateCcw size={15} /> إعادة المحاكاة</button>
            </div>
          )}
          <div className="simulation-safety-note"><ShieldCheck size={15} /><p>{activeCase.safetyNote}</p></div>
        </aside>
      </div>

      <div className="simulation-bottom-links">
        <Link href={voiceHref}>بدء مقابلة صوتية مع الحالة <ArrowRight size={14} /></Link>
        <Link href="/posture">تقييم لغة الجسد <ArrowRight size={14} /></Link>
        <Link href="/supervision">إشراف أكاديمي مباشر <ArrowRight size={14} /></Link>
        <Link href="/competencies">ملف الكفاءات المهنية <ArrowRight size={14} /></Link>
      </div>
      <div className="portal-callout simulation-disclaimer">
        <Info size={16} /> تقييم المحاكاة مخصص للتعلم ومراجعة القرارات. يعتمد على Rubric الحالة الذي أعده المختص، ولا يمثل تشخيصاً أو مقياساً نفسياً مقنناً. أحداث التفاعل المسجلة توثق استخدام عناصر القاعة ولا تثبت وحدها كفاءة سريرية.
      </div>
    </PlatformLayout>
  );
}

export default function SimulationPage() {
  return <Suspense fallback={<div className="simulation-stage-loading">تحميل القاعة...</div>}><SimulationWorkspace /></Suspense>;
}
