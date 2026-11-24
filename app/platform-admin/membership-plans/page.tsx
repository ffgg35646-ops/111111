"use client";
import {useEffect,useState} from "react";
import {PlatformLayout} from "@/components/platform-layout";
type Plan={planId:string;name:string;description:string;monthlyPrice:number;annualPrice:number;active?:boolean;features:string[]};
export default function MembershipPlanAdminPage(){
 const [items,setItems]=useState<Plan[]>([]),[drafts,setDrafts]=useState<Record<string,{name:string;description:string;monthlyPrice:string;annualPrice:string;active:boolean}>>({}),[busy,setBusy]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(){const r=await fetch("/api/platform/commerce/plans?manage=1",{cache:"no-store"}),d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل الباقات");setItems(d.plans||[]);setDrafts(Object.fromEntries((d.plans||[]).map((p:Plan)=>[p.planId,{name:p.name,description:p.description,monthlyPrice:p.monthlyPrice?String(p.monthlyPrice):"",annualPrice:p.annualPrice?String(p.annualPrice):"",active:p.active===true}])))}
 useEffect(()=>{let active=true;fetch("/api/platform/commerce/plans?manage=1",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active){setItems(d.plans||[]);setDrafts(Object.fromEntries((d.plans||[]).map((p:Plan)=>[p.planId,{name:p.name,description:p.description,monthlyPrice:p.monthlyPrice?String(p.monthlyPrice):"",annualPrice:p.annualPrice?String(p.annualPrice):"",active:p.active===true}])))}}).catch(e=>{if(active)setError(e.message||"تعذر تحميل الباقات")});return()=>{active=false}},[]);
 async function save(p:Plan){const d=drafts[p.planId];setBusy(p.planId);setError("");setNotice("");try{const r=await fetch("/api/platform/commerce/plans",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...d,planId:p.planId,monthlyPrice:Number(d.monthlyPrice),annualPrice:Number(d.annualPrice)})}),data=await r.json();if(!r.ok)throw new Error(data.error);setNotice("تم حفظ "+d.name);await load()}catch(e){setError(e instanceof Error?e.message:"تعذر حفظ الباقة")}finally{setBusy("")}}
 return <PlatformLayout title="إدارة الباقات المهنية" description="اضبط الأسعار الشهرية والسنوية ومزايا كل باقة قبل إتاحتها للشراء.">
 <div className="portal-callout">لا توجد أسعار افتراضية مفروضة على العملاء. لن تظهر الباقة في صفحة الاشتراك حتى تضبط الإدارة سعريها وتفعّلها.</div>
 {error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}{notice&&<p role="status" className="portal-callout">{notice}</p>}
 <div style={{display:"grid",gap:14,marginTop:14}}>{items.map(p=>{const d=drafts[p.planId]||{name:p.name,description:p.description,monthlyPrice:"",annualPrice:"",active:false};return <article className="portal-card" key={p.planId} style={{display:"grid",gap:10}}>
 <strong>{p.name}</strong>
 <label>اسم الباقة<input value={d.name} onChange={e=>setDrafts(v=>({...v,[p.planId]:{...d,name:e.target.value}}))}/></label>
 <label>الوصف<textarea rows={2} value={d.description} onChange={e=>setDrafts(v=>({...v,[p.planId]:{...d,description:e.target.value}}))}/></label>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>
 <label>سعر الشهر (SAR)<input type="number" min="1" step="0.01" value={d.monthlyPrice} onChange={e=>setDrafts(v=>({...v,[p.planId]:{...d,monthlyPrice:e.target.value}}))}/></label>
 <label>سعر السنة (SAR)<input type="number" min="1" step="0.01" value={d.annualPrice} onChange={e=>setDrafts(v=>({...v,[p.planId]:{...d,annualPrice:e.target.value}}))}/></label>
 </div>
 <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={d.active} onChange={e=>setDrafts(v=>({...v,[p.planId]:{...d,active:e.target.checked}}))}/> تفعيل الباقة للبيع</label>
 <div><small>المزايا الحالية: {p.features.join(" · ")}</small></div>
 <button className="portal-button" disabled={busy===p.planId||!d.monthlyPrice||!d.annualPrice} onClick={()=>void save(p)}>{busy===p.planId?"جارٍ الحفظ":"حفظ الباقة"}</button>
 </article>})}</div>
 </PlatformLayout>
}
