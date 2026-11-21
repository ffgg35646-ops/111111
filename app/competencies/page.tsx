"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, ChartNoAxesCombined, ClipboardList, Download, Search, ShieldCheck } from "lucide-react";
import "./competencies.css";

type CompetencyScores = {
  communication:number;
  activeListening:number;
  clinicalAssessment:number;
  empathy:number;
  nonverbalCommunication:number;
  safetyAndProfessionalism:number;
};
type Report = {
  id:string;
  reportId:string;
  traineeCode:string;
  traineeName:string;
  scenarioTitle:string;
  overallScore:number;
  scores:CompetencyScores;
  feedbackNotes:string;
  telemetry:{type:string;label:string;value:number|string|boolean|null;unit?:string;source?:string;occurredAt:string}[];
  vrEvidence:{type:string;competency:string;label:string;averageScore:number;samples:number;scale:string}[];
  createdAt:string;
};

const competencies: {key:keyof CompetencyScores; label:string}[] = [
  {key:"communication",label:"التواصل السريري"},
  {key:"activeListening",label:"الإنصات وجمع المعلومات"},
  {key:"clinicalAssessment",label:"التقييم والاستدلال السريري"},
  {key:"empathy",label:"التعاطف واحترام المراجع"},
  {key:"nonverbalCommunication",label:"لغة الجسد والتواصل البصري"},
  {key:"safetyAndProfessionalism",label:"السلامة والسلوك المهني"},
];

export default function CompetenciesPage() {
  const [traineeCode,setTraineeCode] = useState("");
  const [reports,setReports] = useState<Report[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [searched,setSearched] = useState(false);

  const average = useMemo(()=>{
    if(!reports.length) return "—";
    return (reports.reduce((total,report)=>total+report.overallScore,0)/reports.length).toFixed(2);
  },[reports]);

  const competencyAverages = useMemo(()=>{
    if(!reports.length) return [];
    return competencies.map(item=>({
      ...item,
      score:(reports.reduce((total,report)=>total+(report.scores?.[item.key] || 0),0)/reports.length).toFixed(2),
    }));
  },[reports]);

  const search = async (event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setLoading(true);setError("");setSearched(false);
    try{
      const response=await fetch(`/api/competencies/reports?traineeCode=${encodeURIComponent(traineeCode.trim().toUpperCase())}`,{credentials:"same-origin",cache:"no-store"});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error || "تعذر تحميل ملف المتدرب.");
      setReports(result.reports || []);
      setSearched(true);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"تعذر قراءة ملف الكفاءات.");
      setReports([]);
    }finally{setLoading(false);}
  };

  return <main className="competencies-page" dir="rtl">
    <header className="competencies-topbar">
      <Link href="/" className="competencies-back"><ArrowRight size={17}/> العودة للوحة التحكم</Link>
      <span><ShieldCheck size={15}/> ملف الكفاءات المهنية</span>
    </header>
    <div className="competencies-content">
      <div className="competencies-heading"><div className="competencies-eyebrow"><ChartNoAxesCombined size={15}/> PROFESSIONAL COMPETENCY RECORD</div><h1>ملف أداء المتدرب والكفاءات السريرية</h1><p>سجل تراكمي لتقييمات الجلسات ومؤشرات VR وملاحظات المشرف الأكاديمي.</p></div>

      <form className="competency-search" onSubmit={search}>
        <label htmlFor="trainee-code">رمز ملف المتدرب</label>
        <div><input id="trainee-code" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]{3,40}" value={traineeCode} onChange={event=>setTraineeCode(event.target.value.toUpperCase())} placeholder="أدخل رمز المتدرب المستخدم في إنشاء الغرفة"/><button type="submit" disabled={loading}>{loading?"جارٍ البحث...":<><Search size={15}/> عرض الملف</>}</button></div>
        <small>لا يمكن عرض الملف إلا من المتصفح الذي أنشأ جلسة المشرف. ربط الملفات بحسابات المؤسسة يتطلب تكامل المصادقة المؤسسية.</small>
      </form>

      {error&&<div className="competency-error">{error}</div>}
      {searched&&reports.length===0&&<div className="competency-empty"><ClipboardList size={25}/><strong>لا توجد تقارير محفوظة لهذا الرمز</strong><p>أنشئ جلسة إشراف، وسجّل تقييم الكفاءات ثم احفظ التقرير ليظهر هنا.</p><Link href="/supervision">إنشاء غرفة إشراف <ArrowRight size={14}/></Link></div>}

      {reports.length>0&&<>
        <div className="competency-profile-head"><div><BadgeCheck size={19}/><div><strong>{reports[0].traineeName}</strong><small>رقم الملف: {reports[0].traineeCode} · {reports.length} تقرير محفوظ</small></div></div><button onClick={()=>window.print()}><Download size={15}/> طباعة / حفظ PDF</button></div>
        <section className="competency-summary-grid">
          <article className="competency-summary-card"><span>متوسط الأداء الكلي</span><strong>{average}<small> / 5</small></strong><p>متوسط تقارير الجلسات المعروضة</p></article>
          <article className="competency-summary-card"><span>عدد الجلسات المقيمة</span><strong>{reports.length}</strong><p>تقارير إشراف محفوظة</p></article>
          <article className="competency-summary-card"><span>مؤشرات VR المسجلة</span><strong>{reports.reduce((total,report)=>total+(report.telemetry?.length||0),0)}</strong><p>إشارات وأحداث واردة من المحرك</p></article>
        </section>
        <section className="competency-panel">
          <div className="competency-panel-head"><div><strong>ملخص الكفاءات المهنية</strong><small>متوسط كل محور عبر التقارير المعروضة</small></div></div>
          <div className="competency-bars">{competencyAverages.map(item=><div className="competency-bar-row" key={item.key}><span>{item.label}</span><div className="competency-bar-track"><i style={{width:`${Number(item.score)/5*100}%`}}/></div><b>{item.score}/5</b></div>)}</div>
        </section>
        <section className="competency-panel">
          <div className="competency-panel-head"><div><strong>سجل التقارير السريرية</strong><small>الأحدث أولاً</small></div></div>
          <div className="competency-report-list">{reports.map(report=><article className="competency-report" key={report.id}>
            <div className="competency-report-top"><div><strong>{report.scenarioTitle}</strong><small>{new Date(report.createdAt).toLocaleString("ar-EG")}</small></div><span>{Number(report.overallScore).toFixed(2)} / 5</span></div>
            <div className="competency-report-scores">{competencies.map(item=><div key={item.key}><small>{item.label}</small><b>{report.scores[item.key]}/5</b></div>)}</div>
            {report.feedbackNotes&&<p className="competency-feedback">{report.feedbackNotes}</p>}
            {report.vrEvidence?.length>0&&<div className="competency-vr-evidence"><strong>أدلة VR المجمعة تلقائياً</strong>{report.vrEvidence.map(item=><span key={item.type}>{item.label}: {item.averageScore}/5 · {item.samples} قياس</span>)}</div>}
            {report.telemetry?.length>0&&<div className="competency-telemetry"><strong>مخرجات VR ({report.telemetry.length})</strong>{report.telemetry.slice(0,5).map((event,index)=><span key={index}>{event.label}: {String(event.value ?? "—")} {event.unit||""}</span>)}</div>}
            <small className="competency-report-id">رقم التقرير: {report.reportId}</small>
          </article>)}</div>
        </section>
      </>}
      <footer className="competencies-footnote">التقرير دعم للتقييم الأكاديمي، ويجب مراجعته واعتماده من مشرف مختص قبل استخدامه في قرارات الاعتماد أو الترخيص المهني.</footer>
    </div>
  </main>;
}
