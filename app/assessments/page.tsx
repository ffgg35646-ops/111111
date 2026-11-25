"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, ClipboardList, FileCheck2, Info, Scale, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type ScaleItem = { itemId:string; prompt:string; required:boolean; options:{label:string;value:number}[] };
type Measure = {
  scaleId:string; title:string; category:string; domain:string; targetGroups:string[];
  description:string; administrationInstructions:string; scoringInstructions:string;
  licenseStatus:string; licenseReference:string; digitalAdministrationAllowed:boolean;
  items:ScaleItem[]; status:string; trainingOnly?:boolean;
};
type Result = {resultId:string;scaleId:string;scaleTitle:string;subjectCode:string;totalScore:number;scoreLabel?:string;interpretationNote?:string;createdAt:string};
type QuizAttempt = {attemptId:string;title:string;score:number;total:number;percentage:number;createdAt:string};

const quiz=[
 {question:"ما الفرق بين أداة التحري والتشخيص؟",choices:["التحري يحدد تشخيصاً نهائياً","التحري قد يشير إلى الحاجة لتقييم أعمق، ولا يثبت التشخيص","لا يوجد فرق"],answer:1,why:"التحري خطوة أولية، ويحتاج تفسيره إلى السياق وإحالة مناسبة عند اللزوم."},
 {question:"ما الذي ينبغي التأكد منه قبل استخدام مقياس منشور؟",choices:["الصدق والثبات والفئة العمرية والترخيص والمعايير","عدد صفحات الكتيب فقط","سهولة جمع الدرجة"],answer:0,why:"اختيار الأداة يتطلب التحقق من الخصائص السيكومترية والترخيص وملاءمة اللغة والسياق."},
 {question:"هل يجوز استخدام درجة معيارية دون دليل الأداة؟",choices:["نعم في كل الحالات","فقط إذا كانت الدرجة مرتفعة","لا، يجب الرجوع إلى دليل التطبيق والتصحيح والتفسير"],answer:2,why:"لا تفسر الدرجة بمعزل عن دليل الأداة والمعايير وظروف التطبيق."},
 {question:"ما الممارسة المهنية الصحيحة عند وجود مؤشرات غير واضحة؟",choices:["تأكيد تشخيص من الملاحظة وحدها","جمع معلومات متعددة والتشاور أو الإحالة إلى مختص مخول","تجاهل المعلومات المخالفة"],answer:1,why:"يجب دمج مصادر متعددة واحترام حدود الدور المهني."},
];

const categoryLabels:Record<string,string>={psychological:"نفسي",social:"اجتماعي",behavioral:"سلوكي",developmental:"نمائي",mixed:"متعدد المجالات"};
const licenseLabels:Record<string,string>={original:"محتوى أصلي",public_domain:"ملك عام",licensed:"مرخص",permission_pending:"بانتظار الإذن",restricted:"مقيد الحقوق"};

export default function AssessmentsPage() {
  const [scales,setScales]=useState<Measure[]>([]);
  const [selected,setSelected]=useState("");
  const [category,setCategory]=useState("all");
  const [population,setPopulation]=useState("all");
  const [answers,setAnswers]=useState<Record<string,number>>({});
  const [subjectCode,setSubjectCode]=useState("");
  const [privacyConfirmed,setPrivacyConfirmed]=useState(false);
  const [result,setResult]=useState<Result|null>(null);
  const [results,setResults]=useState<Result[]>([]);
  const [quizAnswers,setQuizAnswers]=useState<Record<number,number>>({});
  const [attempts,setAttempts]=useState<QuizAttempt[]>([]);
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [quizSaving,setQuizSaving]=useState(false);

  const active=scales.find(scale=>scale.scaleId===selected)||null;
  const populations=useMemo(()=>[...new Set(scales.flatMap(scale=>scale.targetGroups||[]))].sort((a,b)=>a.localeCompare(b,"ar")),[scales]);
  const visible=scales.filter(scale=>(category==="all"||scale.category===category)&&(population==="all"||scale.targetGroups.includes(population)));

  useEffect(()=>{
    let live=true;
    Promise.all([
      fetch("/api/platform/assessment-scales",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل المقاييس.");return d;}),
      fetch("/api/platform/assessment-results",{cache:"no-store"}).then(async r=>{if(!r.ok)return {results:[]};return r.json();}),
      fetch("/api/learning/assessments",{cache:"no-store"}).then(async r=>{if(!r.ok)return {attempts:[]};return r.json();}),
    ]).then(([s,r,q])=>{
      if(!live)return;
      const list=Array.isArray(s.scales)?s.scales:[];setScales(list);
      if(list.length)setSelected(list[0].scaleId);
      setResults(Array.isArray(r.results)?r.results:[]);
      setAttempts(Array.isArray(q.attempts)?q.attempts:[]);
    }).catch(cause=>{if(live)setError(cause instanceof Error?cause.message:"تعذر تحميل مكتبة المقاييس.");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[]);

  function chooseScale(id:string){setSelected(id);setAnswers({});setSubjectCode("");setPrivacyConfirmed(false);setResult(null);setError("");setMessage("");}
  async function submitMeasure(){
    if(!active||saving)return;
    setSaving(true);setError("");setMessage("");
    try{
      const responses=Object.entries(answers).map(([itemId,value])=>({itemId,value}));
      const response=await fetch("/api/platform/assessment-results",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scaleId:active.scaleId,subjectCode,responses,privacyConfirmed})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر حفظ النتيجة. تحقق من صلاحية التطبيق.");
      setResult(data.result);setResults(current=>[data.result,...current]);
      setMessage("تم تصحيح الإجابات وحفظ النتيجة في سجلك.");
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذر حفظ النتيجة.");}
    finally{setSaving(false);}
  }

  async function saveQuizAttempt(){
    if(Object.keys(quizAnswers).length!==quiz.length||quizSaving)return;
    setQuizSaving(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/learning/assessments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers:quiz.map((_,index)=>quizAnswers[index])})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"تعذر حفظ نتيجة الاختبار.");
      setAttempts(current=>[data.attempt,...current]);setMessage("تم حفظ نتيجة الاختبار التعليمي.");
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذر حفظ نتيجة الاختبار.");}
    finally{setQuizSaving(false);}
  }
  const quizScore=quiz.reduce((sum,item,index)=>sum+(quizAnswers[index]===item.answer?1:0),0);

  return <PlatformLayout title="مكتبة المقاييس والاختبارات" description="استعرض الأدوات النفسية والاجتماعية بحسب الفئة والمجال، واطلع على تعليمات التطبيق والتصحيح، واستخدم النماذج الرقمية المصرح بها فقط.">
    <div className="portal-callout"><Info size={16}/> المقاييس المنشورة ليست كلها متاحة للتطبيق الرقمي. يعرض النظام حالة الحقوق، ولا يتيح البنود الإلكترونية إلا بعد توثيق الإذن بالتطبيق والتخزين الرقمي. الأدوات التدريبية الأصلية لا تنتج تشخيصاً أو درجات معيارية.</div>
    <div className="portal-section-title" style={{marginTop:20}}><div><h2>مكتبة المقاييس</h2><p>{scales.length} أدوات منشورة ومتاحة حسب صلاحيات الحساب</p></div><Scale size={20}/></div>
    <div className="portal-card" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:13}}>
      <label style={{display:"grid",gap:6,fontSize:11,color:"#637781"}}>التصنيف
        <select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">جميع التصنيفات</option>{Object.entries(categoryLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
      </label>
      <label style={{display:"grid",gap:6,fontSize:11,color:"#637781"}}>الفئة المستهدفة
        <select value={population} onChange={e=>setPopulation(e.target.value)}><option value="all">جميع الفئات</option>{populations.map(item=><option key={item} value={item}>{item}</option>)}</select>
      </label>
    </div>
    {loading?<div className="portal-empty">جارٍ تحميل المكتبة...</div>:visible.length?<div className="portal-grid">{visible.map(scale=><button key={scale.scaleId} className={"portal-card scale-card"+(selected===scale.scaleId?" active":"")} onClick={()=>chooseScale(scale.scaleId)} style={{textAlign:"right",border:selected===scale.scaleId?"1px solid #26988d":"1px solid #e5ecee"}}>
      <span className="scale-symbol"><Scale size={18}/></span><h3>{scale.title}</h3><p>{scale.description}</p>
      <small>{categoryLabels[scale.category]||scale.category} · {scale.domain}</small>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}><span className="portal-chip">{licenseLabels[scale.licenseStatus]||scale.licenseStatus}</span><span className="portal-chip">{scale.digitalAdministrationAllowed?"تطبيق إلكتروني متاح":"تعليمات / تطبيق غير رقمي"}</span></div>
    </button>)}</div>:<div className="portal-empty">لا توجد أدوات منشورة تطابق التصفية.</div>}
    {active&&<section className="portal-card" style={{marginTop:18}}>
      <div className="portal-section-title"><div><span className="portal-chip">{categoryLabels[active.category]||active.category}</span><h2>{active.title}</h2><p>{active.description}</p></div><ClipboardList size={21}/></div>
      <div className="portal-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
        <article style={{background:"#f7f9fa",padding:13,borderRadius:10}}><strong>الفئات المستهدفة</strong><p>{active.targetGroups.join("، ")}</p></article>
        <article style={{background:"#f7f9fa",padding:13,borderRadius:10}}><strong>حالة الحقوق</strong><p>{licenseLabels[active.licenseStatus]||active.licenseStatus}</p><small>{active.licenseReference||"لم يذكر مرجع ترخيص"}</small></article>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12,marginTop:13}}>
        <article><h3>تعليمات التطبيق</h3><p style={{whiteSpace:"pre-wrap",lineHeight:1.9}}>{active.administrationInstructions}</p></article>
        <article><h3>التصحيح والتفسير</h3><p style={{whiteSpace:"pre-wrap",lineHeight:1.9}}>{active.scoringInstructions}</p></article>
      </div>
      {active.trainingOnly&&<div className="portal-callout" style={{marginTop:12}}><ShieldCheck size={15}/> أداة تدريبية أصلية وغير مقننة. لا تستخدمها لتشخيص الأفراد أو إصدار درجة معيارية.</div>}
      {active.digitalAdministrationAllowed&&active.items.length>0?<div style={{marginTop:18,borderTop:"1px solid #e7edef",paddingTop:16}}>
        <div className="portal-section-title"><div><h3>النموذج الإلكتروني المصرح به</h3><p>{active.items.length} بنود · يتم التصحيح على الخادم</p></div></div>
        <label style={{display:"grid",gap:6,maxWidth:360,fontSize:11}}>رمز المستفيد غير التعريفي<input value={subjectCode} onChange={e=>setSubjectCode(e.target.value)} maxLength={60} placeholder="مثال: ETZ-CASE-001"/></label>
        <div style={{display:"grid",gap:12,marginTop:14}}>{active.items.map((item,index)=><article key={item.itemId} style={{padding:12,border:"1px solid #e7edef",borderRadius:10}}>
          <strong>{index+1}. {item.prompt}</strong>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:10}}>{item.options.map(option=><label key={option.value} style={{display:"flex",gap:6,alignItems:"center",fontSize:12}}><input type="radio" name={item.itemId} checked={answers[item.itemId]===option.value} onChange={()=>setAnswers(current=>({...current,[item.itemId]:option.value}))}/>{option.label}</label>)}</div>
        </article>)}</div>
        <label style={{display:"flex",alignItems:"flex-start",gap:8,marginTop:14,fontSize:11}}><input type="checkbox" checked={privacyConfirmed} onChange={e=>setPrivacyConfirmed(e.target.checked)}/> أؤكد استخدام رمز غير تعريفي، والحصول على الموافقات اللازمة، وعدم إدخال الاسم أو رقم الهوية أو بيانات تعريفية مباشرة.</label>
        <button className="portal-button" style={{marginTop:12}} disabled={saving||!subjectCode.trim()||!privacyConfirmed||active.items.some(item=>item.required&&answers[item.itemId]===undefined)} onClick={()=>void submitMeasure()}>{saving?"جارٍ التصحيح والحفظ...":"إرسال الإجابات وحفظ النتيجة"}</button>
      </div>:<div className="portal-callout" style={{marginTop:16}}>التطبيق الإلكتروني غير مفعّل لهذه الأداة. راجع الدليل الورقي أو مزود الترخيص وفق حقوق الاستخدام المسجلة.</div>}
      {result&&<div className="portal-card" style={{marginTop:14,border:"1px solid #9acfc6"}}><strong><CheckCircle2 size={16} style={{verticalAlign:"middle"}}/> تم حفظ النتيجة</strong><h2>{result.totalScore} {result.scoreLabel? "· "+result.scoreLabel:""}</h2><p>{result.interpretationNote||"لا توجد نطاقات تفسير مسجلة لهذه الأداة."}</p><small>رمز المستفيد: {result.subjectCode}</small></div>}
    </section>}
    {error&&<p role="alert" style={{color:"#a33",fontSize:12,marginTop:12}}>{error}</p>}
    {message&&<p role="status" style={{color:"#18745e",fontSize:12,marginTop:12}}>{message}</p>}
    <section className="portal-card" style={{marginTop:18}}>
      <div className="portal-section-title"><div><h2><FileCheck2 size={18} style={{verticalAlign:"middle"}}/> نتائجي المحفوظة</h2><p>لا يعرض هذا السجل إلا النتائج التي قمت بإدخالها</p></div><span className="portal-chip">{results.length} نتائج</span></div>
      {results.length?results.slice(0,20).map(item=><article key={item.resultId} style={{padding:"10px 0",borderBottom:"1px solid #e8eeee",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{item.scaleTitle}</strong><p style={{margin:"4px 0",fontSize:11,color:"#82939b"}}>الرمز {item.subjectCode} · {new Date(item.createdAt).toLocaleString("ar-SA")}</p></div><strong>{item.totalScore} {item.scoreLabel||""}</strong></article>):<div className="portal-empty">لا توجد نتائج مقاييس مسجلة في حسابك.</div>}
    </section>
    <section className="portal-card" style={{marginTop:18}}>
      <div className="portal-section-title"><div><h2>اختبار المعرفة المهنية</h2><p>اختبار تعليمي قصير حول اختيار المقاييس وحدود التفسير</p></div><BookOpenCheck size={20}/></div>
      {quiz.map((item,index)=><article className="scale-question" key={item.question}><strong>{index+1}. {item.question}</strong><div>{item.choices.map((choice,choiceIndex)=><button key={choice} className={quizAnswers[index]===choiceIndex?"selected":""} onClick={()=>setQuizAnswers(current=>({...current,[index]:choiceIndex}))}>{choice}</button>)}</div>{quizAnswers[index]!==undefined&&<p className={quizAnswers[index]===item.answer?"correct":"incorrect"}>{quizAnswers[index]===item.answer?"إجابة صحيحة. ":"راجع المفهوم. "}{item.why}</p>}</article>)}
      {Object.keys(quizAnswers).length===quiz.length&&<div className="quiz-result"><CheckCircle2 size={18}/> نتيجتك التعليمية: {quizScore} من {quiz.length}<button className="portal-button" disabled={quizSaving} onClick={()=>void saveQuizAttempt()}>{quizSaving?"جارٍ الحفظ...":"حفظ نتيجتي"}</button></div>}
      {attempts.slice(0,8).map(attempt=><small key={attempt.attemptId} style={{display:"block",color:"#82939b",padding:"5px 0"}}>{attempt.score}/{attempt.total} · {attempt.percentage}% · {new Date(attempt.createdAt).toLocaleDateString("ar-SA")}</small>)}
    </section>
  </PlatformLayout>;
}
