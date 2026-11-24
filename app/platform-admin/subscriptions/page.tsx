"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {PlatformLayout} from "@/components/platform-layout";
type Subscription={subscriptionId:string;userId:string;email:string;planName:string;billingPeriod:string;status:string;autoRenewEnabled:boolean;recurringStatus?:string;amount:number;currency:string;tokenLastFour?:string;nextBillingAt?:string;paidThrough?:string;renewalAttempts?:number;createdAt:string};
export default function AdminSubscriptionsPage(){
 const [items,setItems]=useState<Subscription[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setError("");const r=await fetch("/api/platform/subscriptions",{cache:"no-store"}),d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل الاشتراكات");setItems(d.subscriptions||[])}
 useEffect(()=>{let active=true;fetch("/api/platform/subscriptions",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.subscriptions||[])}).catch(e=>{if(active)setError(e.message||"تعذر تحميل الاشتراكات")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 const active=items.filter(i=>i.status==="active").length,renewing=items.filter(i=>i.autoRenewEnabled).length;
 return <PlatformLayout title="إدارة الاشتراكات والعضويات" description="متابعة الباقات النشطة، حالة التجديد، محاولات الخصم وسجل العضويات.">
 <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
  <Link className="portal-button secondary" href="/platform-admin/membership-plans">إعداد أسعار الباقات</Link>
  <Link className="portal-button secondary" href="/platform-admin/course-pricing">تسعير الدورات</Link>
  <Link className="portal-button secondary" href="/platform-admin/coupons">كوبونات الخصم</Link>
  <Link className="portal-button secondary" href="/platform-admin/invoices">الفواتير</Link>
  <Link className="portal-button secondary" href="/platform-admin/payments">المدفوعات والاستردادات</Link>
 </div>
 <div className="portal-grid">
  <article className="portal-card"><small>إجمالي الاشتراكات</small><h2>{items.length}</h2></article>
  <article className="portal-card"><small>عضويات نشطة</small><h2>{active}</h2></article>
  <article className="portal-card"><small>تجديد تلقائي مفعّل</small><h2>{renewing}</h2></article>
 </div>
 <div className="portal-callout" style={{marginTop:14}}>تعمل عملية التجديد المجدولة من مهمة الخادم عند تهيئة CRON_SECRET ومفاتيح Moyasar. تتم المحاولات الفاشلة بحد أقصى ثلاث محاولات ثم تُوقف تلقائيًا وتظهر للمراجعة.</div>
 {error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}
 <div className="portal-section-title"><div><h2>سجل الاشتراكات</h2><p>{items.length} سجل</p></div><button className="portal-button secondary" onClick={()=>void load()}>تحديث</button></div>
 {loading?<div className="portal-empty">جارٍ تحميل الاشتراكات...</div>:<div style={{display:"grid",gap:10}}>
 {items.map(s=><article className="portal-card" key={s.subscriptionId}>
  <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><strong>{s.planName}</strong><span className="portal-chip">{s.status}</span></div>
  <p>{s.email} · {s.billingPeriod==="annual"?"سنوي":"شهري"} · {(s.amount/100).toFixed(2)} {s.currency}</p>
  <small>التجديد التلقائي: {s.autoRenewEnabled?"مفعّل":"متوقف"} · الحالة: {s.recurringStatus||"—"}</small>
  {s.tokenLastFour&&<small>البطاقة: **** {s.tokenLastFour}</small>}
  {s.paidThrough&&<small>مدفوع حتى: {new Date(s.paidThrough).toLocaleString("ar-SA")}</small>}
  {s.nextBillingAt&&s.autoRenewEnabled&&<small>الخصم التالي: {new Date(s.nextBillingAt).toLocaleString("ar-SA")}</small>}
  {typeof s.renewalAttempts==="number"&&s.renewalAttempts>0&&<small>محاولات الخصم الفاشلة: {s.renewalAttempts}</small>}
 </article>)}
 {!items.length&&<div className="portal-empty">لا توجد اشتراكات مسجلة بعد.</div>}
 </div>}
 </PlatformLayout>
}
