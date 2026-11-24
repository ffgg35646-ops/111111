"use client";
import {useEffect,useState} from "react";
import {PlatformLayout} from "@/components/platform-layout";
type Coupon={code:string;type:"percent"|"fixed";value:number;appliesTo:string;minimumAmount?:number;maxUses?:number|null;usedCount:number;expiresAt?:string;active:boolean};
export default function CouponsPage(){
 const [items,setItems]=useState<Coupon[]>([]),[code,setCode]=useState(""),[type,setType]=useState<"percent"|"fixed">("percent"),[value,setValue]=useState("10"),[appliesTo,setAppliesTo]=useState("all"),[minimum,setMinimum]=useState("0"),[maxUses,setMaxUses]=useState(""),[expires,setExpires]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(){const r=await fetch("/api/platform/commerce/coupons",{cache:"no-store"}),d=await r.json();if(!r.ok)throw new Error(d.error);setItems(d.coupons||[])}
 useEffect(()=>{let active=true;fetch("/api/platform/commerce/coupons",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.coupons||[])}).catch(e=>{if(active)setError(e.message||"تعذر تحميل الكوبونات")});return()=>{active=false}},[]);
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setNotice("");try{const r=await fetch("/api/platform/commerce/coupons",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,type,value:Number(value),appliesTo,minimumAmount:Number(minimum),maxUses:maxUses?Number(maxUses):null,expiresAt:expires||undefined,active:true})}),d=await r.json();if(!r.ok)throw new Error(d.error);setCode("");setNotice("تم إنشاء كود الخصم.");await load()}catch(e){setError(e instanceof Error?e.message:"تعذر إنشاء الكوبون")}finally{setBusy(false)}}
 async function toggle(c:Coupon){setBusy(true);setError("");try{const r=await fetch("/api/platform/commerce/coupons",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:c.code,active:!c.active})}),d=await r.json();if(!r.ok)throw new Error(d.error);await load()}catch(e){setError(e instanceof Error?e.message:"تعذر تحديث الكوبون")}finally{setBusy(false)}}
 return <PlatformLayout title="كوبونات الخصم" description="إنشاء أكواد خصم مع تحديد نطاق استخدامها وحدودها وتاريخ انتهائها.">
 <form className="portal-card" onSubmit={create} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:18}}>
 <label>رمز الكوبون<input required minLength={3} maxLength={40} value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,""))} placeholder="ETZAN10"/></label>
 <label>نوع الخصم<select value={type} onChange={e=>setType(e.target.value as "percent"|"fixed")}><option value="percent">نسبة مئوية %</option><option value="fixed">قيمة ثابتة SAR</option></select></label>
 <label>قيمة الخصم<input type="number" min="0.01" max={type==="percent"?100:1000000} step="0.01" required value={value} onChange={e=>setValue(e.target.value)}/></label>
 <label>ينطبق على<select value={appliesTo} onChange={e=>setAppliesTo(e.target.value)}><option value="all">كل المنتجات</option><option value="course">الدورات</option><option value="book">الكتب</option><option value="membership">العضويات</option></select></label>
 <label>الحد الأدنى للطلب (SAR)<input type="number" min="0" step="0.01" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
 <label>عدد الاستخدامات المسموح<input type="number" min="1" step="1" value={maxUses} onChange={e=>setMaxUses(e.target.value)} placeholder="غير محدود"/></label>
 <label>ينتهي في<input type="date" value={expires} onChange={e=>setExpires(e.target.value)}/></label>
 <div style={{display:"flex",alignItems:"end"}}><button className="portal-button" disabled={busy}>إنشاء الكوبون</button></div>
 </form>
 {error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}{notice&&<p role="status" className="portal-callout">{notice}</p>}
 <div style={{display:"grid",gap:10}}>{items.map(c=><article className="portal-card" key={c.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><strong>{c.code}</strong><p>{c.type==="percent"?c.value+"%":"SAR "+c.value} · {c.appliesTo==="all"?"كل المنتجات":c.appliesTo==="course"?"الدورات":c.appliesTo==="book"?"الكتب":"العضويات"}</p><small>الاستخدامات: {c.usedCount||0}{c.maxUses?"/"+c.maxUses:""} · الحد الأدنى: {c.minimumAmount||0} SAR · {c.expiresAt?"الانتهاء: "+new Date(c.expiresAt).toLocaleDateString("ar-SA"):"بدون تاريخ انتهاء"}</small></div><button className="portal-button secondary" disabled={busy} onClick={()=>void toggle(c)}>{c.active?"إيقاف الكوبون":"تفعيل الكوبون"}</button></article>)}</div>
 {!items.length&&<div className="portal-empty">لا توجد كوبونات. أنشئ أول كود خصم من النموذج أعلاه.</div>}
 </PlatformLayout>
}
