"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, CheckCircle2, ClipboardList, Info, Scale, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { practiceScales } from "@/lib/platform-catalog";

const quiz=[
 {question:"ما الفرق بين أداة التحري والتشخيص؟",choices:["التحري يحدد تشخيصاً نهائياً","التحري قد يشير إلى الحاجة لتقييم أعمق، ولا يثبت التشخيص","لا يوجد فرق"],answer:1,why:"التحري خطوة أولية، ويحتاج تفسيره إلى السياق وإحالة مناسبة عند اللزوم."},
 {question:"ما الذي ينبغي التأكد منه قبل استخدام مقياس منشور؟",choices:["الصدق والثبات والفئة العمرية والترخيص والمعايير","عدد صفحات الكتيب فقط","سهولة جمع الدرجة"],answer:0,why:"اختيار الأداة يتطلب التحقق من الخصائص السيكومترية والترخيص وملاءمة اللغة والسياق."},
 {question:"هل يجوز استخدام درجة معيارية دون دليل الأداة؟",choices:["نعم في كل الحالات","فقط إذا كانت الدرجة مرتفعة","لا، يجب الرجوع إلى دليل التطبيق والتصحيح والتفسير"],answer:2,why:"لا تفسر الدرجة بمعزل عن دليل الأداة والمعايير وظروف التطبيق."},
 {question:"ما الممارسة المهنية الصحيحة عند وجود مؤشرات غير واضحة؟",choices:["تأكيد تشخيص من الملاحظة وحدها","جمع معلومات متعددة والتشاور أو الإحالة إلى مختص مخول","تجاهل المعلومات المخالفة"],answer:1,why:"يجب دمج مصادر متعددة واحترام حدود الدور المهني."},
];

type Attempt = { attemptId: string; title: string; score: number; total: number; percentage: number; createdAt: string };

export default function AssessmentsPage(){
  const [selected,setSelected]=useState(practiceScales[0].id);
  const [ratings,setRatings]=useState<Record<string,string>>({});
  const [answers,setAnswers]=useState<Record<number,number>>({});
  const [attempts,setAttempts]=useState<Attempt[]>([]);
  const [saving,setSaving]=useState(false);
  const [saveMessage,setSaveMessage]=useState("");
  const [saveError,setSaveError]=useState("");
  const active=practiceScales.find(item=>item.id===selected)!;
  const answered=Object.keys(answers).length;
  const score=quiz.reduce((sum,item,index)=>sum+(answers[index]===item.answer?1:0),0);

  useEffect(()=>{
    let activeRequest=true;
    fetch("/api/learning/assessments",{cache:"no-store"}).then(async response=>{
      if(!response.ok)return;
      const data=await response.json();
      if(activeRequest)setAttempts(data.attempts||[]);
    }).catch(()=>{});
    return()=>{activeRequest=false};
  },[]);

  async function saveAttempt(){
    if(answered!==quiz.length||saving)return;
    setSaving(true);setSaveError("");setSaveMessage("");
    try{
      const response=await fetch("/api/learning/assessments",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({answers:quiz.map((_,index)=>answers[index])}),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر حفظ النتيجة. سجّل الدخول بحساب متدرب.");
      setAttempts(current=>[data.attempt,...current.filter(item=>item.attemptId!==data.attempt.attemptId)]);
      setSaveMessage("تم حفظ نتيجتك في سجل الاختبارات بلوحة المتدرب.");
    }catch(error){setSaveError(error instanceof Error?error.message:"تعذر حفظ النتيجة.");}
    finally{setSaving(false);}
  }

  return <PlatformLayout title="مختبر دراسة الحالة والمقاييس" description="تعلم كيفية اختيار أدوات التقييم وقراءة خصائصها وتوثيق الملاحظات وصياغة الفرضيات التعليمية مع احترام حدود الاختصاص.">
    <div className="portal-callout"><Info size={16}/> النماذج الموجودة هنا مواد تدريبية أصلية وغير مقننة. لا تنتج تشخيصاً أو درجات معيارية، ولا تستبدل المقاييس المرخصة أو التقييم الذي يجريه مختص مؤهل.</div>
    <div className="portal-section-title"><div><h2>مكتبة النماذج التدريبية</h2><p>اختر نموذجاً لاستعراض المجالات التي يغطيها</p></div></div>
    <div className="portal-grid">
      {practiceScales.map(item=><button className={selected===item.id?"portal-card scale-card active":"portal-card scale-card"} key={item.id} onClick={()=>{setSelected(item.id);setRatings({});}}>
        <span className="scale-symbol"><Scale size={18}/></span><h3>{item.title}</h3><p>{item.purpose}</p><small>{item.domains.length} مجالات ملاحظة</small>
      </button>)}
    </div>
    <section className="portal-card scale-workspace">
      <div className="portal-section-title"><div><h2>{active.title}</h2><p>{active.purpose}</p></div><ClipboardList size={20}/></div>
      <div className="scale-domains">{active.domains.map(domain=><label key={domain}><span>{domain}</span><select value={ratings[domain]||""} onChange={event=>setRatings(current=>({...current,[domain]:event.target.value}))}><option value="">اختر وصفاً تدريبياً</option><option value="لم يتم الاستكشاف بعد">لم يتم الاستكشاف بعد</option><option value="ظهر مثال وظيفي داعم">ظهر مثال وظيفي داعم</option><option value="يحتاج إلى دعم أو تيسير">يحتاج إلى دعم أو تيسير</option><option value="تحتاج معلومات إضافية">تحتاج معلومات إضافية</option></select></label>)}</div>
      <div className="portal-callout scale-warning"><ShieldCheck size={15}/>{active.disclaimer}</div>
      <p className="scale-progress-note">تم استكمال {Object.keys(ratings).length} من {active.domains.length} مجالات المراجعة التدريبية. لا يتم جمع هذه الأوصاف كدرجة تشخيصية.</p>
    </section>
    <section className="portal-card scale-quiz">
      <div className="portal-section-title"><div><h2>اختبار فهم المقاييس والتقدير المهني</h2><p>أجب عن الأسئلة لقياس فهمك للمبادئ الأساسية</p></div><BookOpenCheck size={20}/></div>
      {quiz.map((item,index)=><article className="scale-question" key={item.question}>
        <strong>{index+1}. {item.question}</strong>
        <div>{item.choices.map((choice,choiceIndex)=><button key={choice} className={answers[index]===choiceIndex?"selected":""} onClick={()=>setAnswers(current=>({...current,[index]:choiceIndex}))}>{choice}</button>)}</div>
        {answers[index]!==undefined&&<p className={answers[index]===item.answer?"correct":"incorrect"}>{answers[index]===item.answer?"إجابة صحيحة. ":"راجع المفهوم. "}{item.why}</p>}
      </article>)}
      {answered===quiz.length&&<div className="quiz-result"><CheckCircle2 size={18}/> نتيجتك التعليمية: {score} من {quiz.length}<button className="portal-button" disabled={saving||Boolean(saveMessage)} onClick={()=>void saveAttempt()}>{saving?"جارٍ حفظ النتيجة...":saveMessage?"تم حفظ النتيجة":"حفظ نتيجتي"}</button></div>}
      {saveMessage&&<p role="status" style={{color:"#18745e"}}>{saveMessage}</p>}
      {saveError&&<p role="alert" style={{color:"#a33"}}>{saveError}</p>}
    </section>
    {attempts.length>0&&<section className="portal-card" style={{marginTop:18}}>
      <div className="portal-section-title"><div><h2>سجل محاولاتك</h2><p>{attempts.length} محاولات محفوظة</p></div></div>
      {attempts.slice(0,8).map(attempt=><div key={attempt.attemptId} style={{padding:"10px 0",borderBottom:"1px solid #edf1f3"}}><strong>{attempt.score} من {attempt.total} · {attempt.percentage}%</strong><p style={{margin:"4px 0",fontSize:12,color:"#758493"}}>{new Date(attempt.createdAt).toLocaleString("ar-EG")}</p></div>)}
    </section>}
  </PlatformLayout>;
}
