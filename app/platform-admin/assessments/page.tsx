"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, ClipboardCheck, FilePlus2, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Band = { min:number; max:number; label:string; meaning:string };
type Scale = {
  scaleId:string; title:string; category:string; domain:string; targetGroups:string[];
  description:string; administrationInstructions:string; scoringInstructions:string;
  licenseStatus:string; rightsHolder:string; licenseReference:string;
  digitalAdministrationAllowed:boolean; items:Array<{itemId:string;prompt:string;required:boolean;options:Array<{label:string;value:number}>}>;
  scoring:{method:string;bands:Band[]}; status:string; trainingOnly?:boolean;
};
const categories = [
  ["psychological","نفسي"],["social","اجتماعي"],["behavioral","سلوكي"],
  ["developmental","نمائي"],["mixed","متعدد المجالات"],
] as const;
const licenseNames:Record<string,string> = {
  original:"محتوى أصلي",public_domain:"ملك عام",licensed:"مرخص",permission_pending:"بانتظار الإذن",restricted:"مقيد الحقوق",
};
const empty:Omit<Scale,"scaleId"|"items"|"scoring"|"trainingOnly"> & {scaleId:string;items:Scale["items"];scoring:Scale["scoring"]} = {
  scaleId:"",title:"",category:"psychological",domain:"",targetGroups:[],description:"",
  administrationInstructions:"",scoringInstructions:"",licenseStatus:"permission_pending",
  rightsHolder:"",licenseReference:"",digitalAdministrationAllowed:false,items:[],scoring:{method:"sum",bands:[]},status:"draft",
};
const defaultOptions = "0=أبداً\n1=نادراً\n2=أحياناً\n3=غالباً\n4=دائماً";

export default function PlatformAdminAssessmentsPage() {
  const [scales,setScales]=useState<Scale[]>([]);
  const [reports,setReports]=useState<{scaleId:string;title:string;count:number;averageScore:number;latestAt:string}[]>([]);
  const [form,setForm]=useState({...empty});
  const [groupsText,setGroupsText]=useState("");
  const [itemsText,setItemsText]=useState("");
  const [optionsText,setOptionsText]=useState(defaultOptions);
  const [bandsText,setBandsText]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load() {
    setLoading(true);setError("");
    try {
      const [s,r]=await Promise.all([
        fetch("/api/platform/assessment-scales",{cache:"no-store"}),
        fetch("/api/platform/assessment-results?report=1",{cache:"no-store"}),
      ]);
      const sd=await s.json(),rd=await r.json();
      if(!s.ok)throw new Error(sd.error||"تعذر تحميل مكتبة المقاييس.");
      setScales(Array.isArray(sd.scales)?sd.scales:[]);
      if(r.ok)setReports(Array.isArray(rd.summary)?rd.summary:[]);
    } catch(cause) {setError(cause instanceof Error?cause.message:"تعذر تحميل البيانات.");}
    finally {setLoading(false);}
  }

  useEffect(()=>{let active=true;Promise.all([
    fetch("/api/platform/assessment-scales",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}),
    fetch("/api/platform/assessment-results?report=1",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)return {summary:[]};return data;})
  ]).then(([s,r])=>{if(active){setScales(s.scales||[]);setReports(r.summary||[]);}}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"تعذر تحميل البيانات.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);

  const selected=useMemo(()=>scales.find(item=>item.scaleId===form.scaleId),[scales,form.scaleId]);
  function reset() {
    setForm({...empty});setGroupsText("");setItemsText("");setOptionsText(defaultOptions);setBandsText("");setError("");setNotice("");
  }
  function choose(scale:Scale) {
    setForm({...scale,targetGroups:[...scale.targetGroups],items:[...scale.items],scoring:{...scale.scoring,bands:[...(scale.scoring?.bands||[])]}});
    setGroupsText(scale.targetGroups.join("، "));
    setItemsText((scale.items||[]).map(item=>item.prompt).join("\n"));
    setOptionsText((scale.items?.[0]?.options||[]).map(item=>item.value+"="+item.label).join("\n")||defaultOptions);
    setBandsText((scale.scoring?.bands||[]).map(band=>[band.min,band.max,band.label,band.meaning].join("|")).join("\n"));
    setError("");setNotice("");
  }
  function makeOptions() {
    return optionsText.split("\n").map(line=>line.trim()).filter(Boolean).map(line=>{
      const split=line.indexOf("=");
      return split<1?null:{value:Number(line.slice(0,split).trim()),label:line.slice(split+1).trim()};
    }).filter((item):item is {value:number;label:string}=>Boolean(item&&Number.isFinite(item.value)&&item.label));
  }
  async function save() {
    setSaving(true);setError("");setNotice("");
    const prompts=itemsText.split("\n").map(line=>line.trim()).filter(Boolean);
    const options=makeOptions();
    const items=form.digitalAdministrationAllowed?prompts.map(prompt=>({prompt,required:true,options} )):[];
    const bands=bandsText.split("\n").map(line=>line.trim()).filter(Boolean).map(line=>{
      const [min,max,label,...meaning]=line.split("|");
      return {min:Number(min),max:Number(max),label:(label||"").trim(),meaning:meaning.join("|").trim()};
    });
    const payload={...form,targetGroups:groupsText.split(/[,،]/).map(item=>item.trim()).filter(Boolean),items,scoring:{method:form.scoring.method,bands}};
    if(form.digitalAdministrationAllowed&&(!items.length||options.length<2)){setSaving(false);setError("أدخل بنداً واحداً على الأقل وخيارين رقميين على الأقل قبل تفعيل التطبيق الإلكتروني.");return;}
    try {
      const response=await fetch("/api/platform/assessment-scales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر حفظ المقياس. تحقق من الترخيص.");
      setNotice("تم حفظ بيانات المقياس وحالة حقوقه.");
      await load();
      if(data.scale)choose(data.scale as Scale);
    } catch(cause) {setError(cause instanceof Error?cause.message:"تعذر حفظ المقياس.");}
    finally {setSaving(false);}
  }
  async function archive() {
    if(!form.scaleId)return;
    setSaving(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/platform/assessment-scales?id="+encodeURIComponent(form.scaleId),{method:"DELETE"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر أرشفة المقياس.");
      setNotice("تمت أرشفة المقياس وتعطيل التطبيق الإلكتروني له.");
      reset();await load();
    } catch(cause) {setError(cause instanceof Error?cause.message:"تعذر أرشفة المقياس.");}
    finally {setSaving(false);}
  }

  return <PlatformLayout title="إدارة مكتبة المقاييس والاختبارات" description="تعريف الأدوات النفسية والاجتماعية، وتوثيق الحقوق والتعليمات وآلية التصحيح، ومراجعة تقارير الاستخدام والنتائج.">
    <div className="portal-callout"><ShieldCheck size={16}/> لا ترفع أو تنسخ بنود مقياس منشور إلى المنصة إلا بعد توثيق إذن يشمل النسخ الرقمي والتطبيق والتصحيح. لا يُفعّل النموذج الإلكتروني للمقاييس المقيدة أو التي لم يُحسم ترخيصها.</div>
    <div className="portal-grid" style={{marginTop:16,alignItems:"start"}}>
      <section className="portal-card" style={{minWidth:0}}>
        <div className="portal-section-title"><div><h2>مكتبة المقاييس</h2><p>{scales.length} تعريفات محفوظة</p></div><button className="portal-button secondary" onClick={()=>void load()}><RefreshCw size={14}/> تحديث</button></div>
        <button className="portal-button" onClick={reset}><FilePlus2 size={14}/> إضافة مقياس</button>
        <div style={{display:"grid",gap:8,marginTop:12}}>
          {loading?<div className="portal-empty">جارٍ تحميل المقاييس...</div>:scales.map(scale=><button key={scale.scaleId} className="portal-card" onClick={()=>choose(scale)} style={{textAlign:"right",padding:12,border:form.scaleId===scale.scaleId?"1px solid #26988d":"1px solid #e5ecee"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><strong>{scale.title}</strong><span className="portal-chip">{scale.status==="published"?"منشور":scale.status==="archived"?"مؤرشف":"مسودة"}</span></div>
            <small style={{display:"block",color:"#84939a",marginTop:5}}>{categories.find(item=>item[0]===scale.category)?.[1]||scale.category} · {licenseNames[scale.licenseStatus]||scale.licenseStatus} · {scale.digitalAdministrationAllowed?"إلكتروني مسموح":"بدون تطبيق إلكتروني"}</small>
          </button>)}
        </div>
      </section>
      <section className="portal-card" style={{minWidth:0}}>
        <div className="portal-section-title"><div><h2>{form.scaleId?"تحرير بيانات المقياس":"تعريف مقياس جديد"}</h2><p>يتم حفظ بيانات الحقوق مع كل أداة</p></div><ClipboardCheck size={20}/></div>
        <div style={{display:"grid",gap:10}}>
          <label className="portal-field">اسم المقياس / الأداة<input value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
            <label className="portal-field">الفئة<select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))}>{categories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
            <label className="portal-field">المجال<input value={form.domain} onChange={e=>setForm(v=>({...v,domain:e.target.value}))}/></label>
          </div>
          <label className="portal-field">الفئات المستهدفة (افصل بفاصلة)<input value={groupsText} onChange={e=>setGroupsText(e.target.value)} placeholder="الأطفال، اليافعون، البالغون"/></label>
          <label className="portal-field">وصف الأداة وغرض الاستخدام<textarea rows={2} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
          <label className="portal-field">تعليمات التطبيق<textarea rows={3} value={form.administrationInstructions} onChange={e=>setForm(v=>({...v,administrationInstructions:e.target.value}))}/></label>
          <label className="portal-field">تعليمات التصحيح والتفسير<textarea rows={3} value={form.scoringInstructions} onChange={e=>setForm(v=>({...v,scoringInstructions:e.target.value}))}/></label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
            <label className="portal-field">حالة الحقوق<select value={form.licenseStatus} onChange={e=>setForm(v=>({...v,licenseStatus:e.target.value}))}><option value="original">محتوى أصلي</option><option value="public_domain">ملك عام</option><option value="licensed">مرخص للاستخدام</option><option value="permission_pending">بانتظار الإذن</option><option value="restricted">مقيد الحقوق</option></select></label>
            <label className="portal-field">صاحب الحقوق<input value={form.rightsHolder} onChange={e=>setForm(v=>({...v,rightsHolder:e.target.value}))}/></label>
          </div>
          <label className="portal-field">مرجع الترخيص أو مستند الإذن<input value={form.licenseReference} onChange={e=>setForm(v=>({...v,licenseReference:e.target.value}))} placeholder="رقم اتفاقية / رابط / مرجع الإذن"/></label>
          <label><input type="checkbox" checked={form.digitalAdministrationAllowed} onChange={e=>setForm(v=>({...v,digitalAdministrationAllowed:e.target.checked}))}/> أملك إذناً صريحاً بالتطبيق الإلكتروني وتخزين الإجابات الرقمية</label>
          {form.digitalAdministrationAllowed&&<>
            <label className="portal-field">بنود النموذج الإلكتروني (سطر لكل بند)<textarea rows={5} value={itemsText} onChange={e=>setItemsText(e.target.value)} placeholder={"البند الأول\nالبند الثاني"}/></label>
            <label className="portal-field">خيارات الإجابة الرقمية (سطر: القيمة=التسمية)<textarea rows={5} value={optionsText} onChange={e=>setOptionsText(e.target.value)}/></label>
            <label className="portal-field">طريقة احتساب الدرجة<select value={form.scoring.method} onChange={e=>setForm(v=>({...v,scoring:{...v.scoring,method:e.target.value}}))}><option value="sum">مجموع الإجابات</option><option value="average">متوسط الإجابات</option></select></label>
            <label className="portal-field">نطاقات التفسير (سطر: الحد الأدنى | الحد الأعلى | التسمية | الوصف)<textarea rows={4} value={bandsText} onChange={e=>setBandsText(e.target.value)} placeholder={"0|10|منخفض|وصف وفق دليل الأداة"}/></label>
          </>}
          <label className="portal-field">حالة النشر<select value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value as Scale["status"]}))}><option value="draft">مسودة</option><option value="published">منشور</option></select></label>
          {selected?.trainingOnly&&<p className="portal-callout">أداة تدريبية أصلية وغير مقننة؛ لا تستخدم لتشخيص أو إصدار درجة معيارية.</p>}
          {error&&<p role="alert" style={{color:"#aa443d",fontSize:12}}>{error}</p>}{notice&&<p role="status" style={{color:"#218067",fontSize:12}}>{notice}</p>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="portal-button" disabled={saving} onClick={()=>void save()}><Save size={14}/>{saving?"جارٍ الحفظ...":"حفظ المقياس"}</button>{form.scaleId&&<button className="portal-button secondary" disabled={saving} onClick={()=>void archive()}><Archive size={14}/> أرشفة</button>}</div>
        </div>
      </section>
    </div>
    <section className="portal-card" style={{marginTop:18}}>
      <div className="portal-section-title"><div><h2>ملخص نتائج المقاييس</h2><p>يعرض عدد النتائج ومتوسط الدرجة لكل أداة، دون إظهار أسماء الأشخاص.</p></div></div>
      {reports.length?reports.map(report=><div key={report.scaleId} style={{padding:"10px 0",borderBottom:"1px solid #e8eeee",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><strong>{report.title}</strong><span>{report.count} نتائج · متوسط {report.averageScore} · آخر تطبيق {new Date(report.latestAt).toLocaleDateString("ar-SA")}</span></div>):<div className="portal-empty">لا توجد نتائج إلكترونية بعد.</div>}
    </section>
    <p style={{fontSize:11,color:"#84939a",marginTop:12}}>المتوسطات وصفية للمراجعة ولا تمثل معايير تشخيصية أو مقارنة معيارية ما لم ينص دليل الأداة المرخص على ذلك.</p>
  </PlatformLayout>;
}
