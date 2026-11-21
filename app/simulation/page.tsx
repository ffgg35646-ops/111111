"use client";

import dynamic from "next/dynamic";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, ClipboardCheck, Info, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { getCaseById, trainingCases } from "@/lib/platform-catalog";
import "./simulation.css";

const ClinicalRoomStage=dynamic(()=>import("@/components/clinical-room-stage"),{ssr:false,loading:()=><div className="simulation-stage-loading">جارٍ تجهيز الغرفة الافتراضية...</div>});

function SimulationWorkspace(){
  const params=useSearchParams();
  const [caseId,setCaseId]=useState(()=>{
    const query=params.get("case");
    return query&&trainingCases.some(item=>item.id===query)?query:trainingCases[0].id;
  });
  const [stepIndex,setStepIndex]=useState(0);
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [feedback,setFeedback]=useState("");
  const [selectedTarget,setSelectedTarget]=useState("الشخصية الافتراضية");
  const [completed,setCompleted]=useState(false);
  const [savedScore,setSavedScore]=useState<number|null>(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const activeCase=useMemo(()=>getCaseById(caseId),[caseId]);
  const activeStep=activeCase.steps[stepIndex];
  const voicePersona=activeCase.ageGroup==="طفل"?"child":activeCase.ageGroup==="مراهق"?"teen":activeCase.track==="الخدمة الاجتماعية"?"mother":"father";
  const voiceScenario=`العنوان: ${activeCase.title}
نوع الحالة: ${activeCase.track}
العمر/الفئة: ${activeCase.ageGroup}
مكان المقابلة: ${activeCase.setting}
ملخص الحالة: ${activeCase.briefing}
أهداف التدريب: ${activeCase.learningGoals.join("، ")}
تعليمات الشخصية: أجب من منظور الشخصية فقط وبما يتناسب مع المعلومات الواردة في الملخص. لا تكشف كل التفاصيل دفعة واحدة. لا تخترع معلومات طبية أو اجتماعية غير مذكورة. لا تقدم تشخيصاً أو علاجاً.
`;
  const voiceHref=`/voice?persona=${voicePersona}&scenario=${encodeURIComponent(voiceScenario)}`;
  const answeredCount=activeCase.steps.filter(step=>Boolean(answers[step.id])).length;

  const changeCase=(id:string)=>{
    setCaseId(id);setStepIndex(0);setAnswers({});setFeedback("");setCompleted(false);setSavedScore(null);setError("");
    window.history.replaceState(null,"",`/simulation?case=${id}`);
  };
  const choose=(choiceId:string)=>{
    const choice=activeStep.choices.find(item=>item.id===choiceId);
    setAnswers(current=>({...current,[activeStep.id]:choiceId}));
    setFeedback(choice?.feedback??"");
  };
  const finish=async()=>{
    if(answeredCount!==activeCase.steps.length)return;
    setSaving(true);setError("");
    try{
      const response=await fetch("/api/platform/activities",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({caseId:activeCase.id,answers:activeCase.steps.map(step=>({stepId:step.id,choiceId:answers[step.id]}))}),
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"تعذر حفظ نتيجة التدريب.");
      setSavedScore(result.score);setCompleted(true);
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذر حفظ نتيجة التدريب.");}
    finally{setSaving(false);}
  };
  const restart=()=>{setStepIndex(0);setAnswers({});setFeedback("");setCompleted(false);setSavedScore(null);setError("");};

  return <PlatformLayout title="قاعة المحاكاة ودراسة الحالة" eyebrow="VIRTUAL CASE SIMULATION" description="ادخل بيئة مقابلة ثلاثية الأبعاد، تفاعل مع الحالة الافتراضية، واتخذ قرارات مهنية متدرجة ثم راجع تقييم أدائك.">
    <div className="simulation-toolbar">
      <label>اختر الحالة<select value={caseId} onChange={event=>changeCase(event.target.value)}>{trainingCases.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <div><span className="simulation-live-indicator"/> جلسة تدريبية افتراضية · لا يوجد مريض حقيقي</div>
    </div>
    <div className="simulation-layout">
      <section className="simulation-room-panel">
        <div className="simulation-panel-head"><div><strong>غرفة المقابلة السريرية</strong><small>يمكنك تدوير المشهد وتقريبه والنقر على الشخصية أو ملف الحالة</small></div><span className="room-ready-chip"><i/> الغرفة جاهزة</span></div>
        <div className="simulation-stage-wrap"><ClinicalRoomStage onSelect={setSelectedTarget}/></div>
        <div className="simulation-scene-footer"><span>العنصر المحدد: <b>{selectedTarget}</b></span><span>اسحب المشهد للتحريك · عجلة الماوس للتقريب</span></div>
        <div className="simulation-case-brief"><div><span className="portal-chip">{activeCase.track}</span><h2>{activeCase.title}</h2><p>{activeCase.briefing}</p></div><div className="case-brief-meta"><span>{activeCase.ageGroup}</span><span>{activeCase.setting}</span></div></div>
      </section>

      <aside className="simulation-assessment-panel">
        {!completed?<>
          <div className="simulation-panel-head"><div><strong>مسار التقييم المهني</strong><small>المرحلة {stepIndex+1} من {activeCase.steps.length}</small></div><b>{Math.round(answeredCount/activeCase.steps.length*100)}%</b></div>
          <div className="simulation-progress"><i style={{width:`${answeredCount/activeCase.steps.length*100}%`}}/></div>
          <div className="simulation-step-list">{activeCase.steps.map((step,index)=><button key={step.id} className={index===stepIndex?"active":answers[step.id]?"done":""} onClick={()=>{setStepIndex(index);setFeedback(step.choices.find(choice=>choice.id===answers[step.id])?.feedback??"");}}><span>{answers[step.id]?<CheckCircle2 size={15}/>:String(index+1).padStart(2,"0")}</span>{step.title}</button>)}</div>
          <div className="simulation-current-task"><span>{activeStep.focus}</span><h3>{activeStep.title}</h3><p>{activeStep.prompt}</p></div>
          <div className="simulation-choice-list">{activeStep.choices.map(choice=><button key={choice.id} className={answers[activeStep.id]===choice.id?"chosen":""} onClick={()=>choose(choice.id)}><i/>{choice.label}</button>)}</div>
          {feedback&&<div className="simulation-feedback"><Sparkles size={15}/><p>{feedback}</p></div>}
          {error&&<p className="simulation-error" role="alert">{error}</p>}
          <div className="simulation-step-actions">
            <button className="simulation-prev" onClick={()=>{setStepIndex(Math.max(0,stepIndex-1));setFeedback("");}} disabled={stepIndex===0}>السابق</button>
            {stepIndex<activeCase.steps.length-1?<button className="simulation-next" onClick={()=>{setStepIndex(stepIndex+1);setFeedback("");}}>المرحلة التالية <ArrowRight size={14}/></button>:<button className="simulation-next" onClick={finish} disabled={saving||answeredCount!==activeCase.steps.length}>{saving?"جارٍ حساب وحفظ التقييم...":<><ClipboardCheck size={15}/> إنهاء وتقييم الجلسة</>}</button>}
          </div>
        </>:<div className="simulation-result">
          <CheckCircle2 size={36}/><span>اكتملت المحاكاة</span><strong>{savedScore}<small> / 100</small></strong><p>{savedScore!==null&&savedScore>=80?"أداء تدريبي متقدم. راجع الملاحظات لتعزيز المهارات.":savedScore!==null&&savedScore>=60?"أداء جيد مع فرص لتحسين بعض خطوات الممارسة.":"راجع التغذية الراجعة وأعد المحاكاة لتعزيز المهارات."}</p>
          <div className="simulation-result-breakdown">{activeCase.steps.map(step=>{const choice=step.choices.find(item=>item.id===answers[step.id]);return <div key={step.id}><span>{step.title}</span><b>{choice?.score??0}/20</b><small>{choice?.feedback}</small></div>;})}</div>
          <button className="simulation-next" onClick={restart}><RotateCcw size={15}/> إعادة المحاكاة</button>
        </div>}
        <div className="simulation-safety-note"><ShieldCheck size={15}/><p>{activeCase.safetyNote}</p></div>
      </aside>
    </div>
    <div className="simulation-bottom-links"><Link href={voiceHref}>بدء مقابلة صوتية مع الحالة <ArrowRight size={14}/></Link><Link href="/posture">تقييم لغة الجسد <ArrowRight size={14}/></Link><Link href="/supervision">إشراف أكاديمي مباشر <ArrowRight size={14}/></Link><Link href="/competencies">ملف الكفاءات المهنية <ArrowRight size={14}/></Link></div>
    <div className="portal-callout simulation-disclaimer"><Info size={16}/> تقييم المحاكاة مخصص للتعلم ومراجعة القرارات. لا يعادل تقييماً سريرياً معتمداً أو تشخيصاً، ودرجاته لا تمثل مقياساً نفسياً مقنناً.</div>
  </PlatformLayout>;
}

export default function SimulationPage(){
  return <Suspense fallback={<div className="simulation-stage-loading">تحميل القاعة...</div>}><SimulationWorkspace/></Suspense>;
}
