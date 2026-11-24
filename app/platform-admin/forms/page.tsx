"use client";

import { useEffect, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type FormRecord = {recordId:string;type:string;title:string;subjectCode?:string;ownerName?:string;ownerRole?:string;notes?:string;values?:Record<string,string>;createdAt:string;updatedAt:string;version:number};
const names:Record<string,string>={"case-study":"دراسة حالة","social-assessment":"تقدير اجتماعي","care-plan":"خطة رعاية","interview":"مقابلة مهنية","follow-up":"متابعة","referral":"إحالة","professional-assessment":"تقدير مهني"};
export default function AdminFormsPage(){
 const [items,setItems]=useState<FormRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setError("");const r=await fetch("/api/platform/forms",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل النماذج.");setItems(d.records||[])}
 useEffect(()=>{let active=true;fetch("/api/platform/forms",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.records||[])}).catch(e=>{if(active)setError(e instanceof Error?e.message:"تعذر تحميل النماذج.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <PlatformLayout title="المقاييس والنماذج المهنية" description="متابعة سجلات النماذج المهنية المحفوظة داخل المنصة، مع فصل النماذج التدريبية عن أدوات القياس المرخصة.">
  <div className="portal-callout">هذه الصفحة تعرض سجلات النماذج التي حفظها المستخدمون. أدوات القياس النفسية المحمية بحقوق نشر أو ترخيص لا يمكن تعديلها أو نشرها قبل اعتماد حقوق الإدارة الرقمية والتصحيح.</div>
  <div className="portal-section-title"><div><h2><FileText size={17}/> سجلات النماذج</h2><p>{items.length} سجل ظاهر · أحدث 100 سجل</p></div><button className="portal-button secondary" onClick={()=>void load()}><RefreshCw size={14}/> تحديث</button></div>
  {error&&<p role="alert" style={{color:"#a44",fontSize:11}}>{error}</p>}
  {loading?<div className="portal-empty">جارٍ تحميل السجلات...</div>:items.length===0?<div className="portal-empty">لا توجد نماذج محفوظة حتى الآن.</div>:<div style={{display:"grid",gap:10}}>
   {items.map(item=><article className="portal-card" key={item.recordId}>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><span className="portal-chip">{names[item.type]||item.type}</span><h3>{item.title}</h3><p>{item.ownerName||"مستخدم"} · {item.ownerRole||"—"} · {item.subjectCode||"دون رمز حالة"}</p></div><small style={{color:"#8999a0"}}>{new Date(item.updatedAt||item.createdAt).toLocaleString("ar-EG")}</small></div>
    {item.notes&&<p style={{marginTop:8}}>{item.notes}</p>}
    <details style={{marginTop:10}}><summary style={{cursor:"pointer",fontSize:10,color:"#287b72"}}>عرض بيانات النموذج</summary><dl style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8,marginTop:10}}>{Object.entries(item.values||{}).map(([key,value])=><div key={key} style={{background:"#f7f9f9",borderRadius:8,padding:10}}><dt style={{fontSize:9,color:"#84949b"}}>{key}</dt><dd style={{margin:"5px 0 0",fontSize:10,color:"#526a74",whiteSpace:"pre-wrap"}}>{value||"—"}</dd></div>)}</dl></details>
   </article>)}
  </div>}
  <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:15}}><a className="portal-link-button secondary" href="/assessments">فتح مختبر المقاييس</a><a className="portal-link-button secondary" href="/tools">فتح مكتبة النماذج</a></div>
 </PlatformLayout>
}
