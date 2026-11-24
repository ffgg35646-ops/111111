"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, RefreshCw, ShieldAlert } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Payment={providerPaymentId:string;requestId:string;email:string;amount:number;currency:string;status:string;fee?:number;paymentMethod?:string;paidAt?:string;refundedAmount?:number;refundedAt?:string;createdAt:string};
export default function AdminInvoicesPage(){
 const [items,setItems]=useState<Payment[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setError("");const r=await fetch("/api/platform/payments",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل السجل المالي.");setItems(d.payments||[])}
 useEffect(()=>{let active=true;fetch("/api/platform/payments",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.payments||[])}).catch(e=>{if(active)setError(e instanceof Error?e.message:"تعذر تحميل السجل المالي.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 const paid=items.filter(x=>["paid","captured"].includes(x.status));
 return <PlatformLayout title="الفواتير والسجل المالي" description="عرض عمليات الدفع المؤكدة والاستردادات المرجعية من مزود الدفع. هذه الشاشة لا تصدر فاتورة ضريبية أو إلكترونية.">
  <div className="portal-callout"><ShieldAlert size={15}/> إصدار الفواتير الإلكترونية والضريبية غير مفعّل. المعروض هنا سجل معاملات الدفع فقط، ولا يُعد فاتورة نظامية ولا يحتوي على رقم فاتورة ضريبية معتمد.</div>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}><Link className="portal-button secondary" href="/platform-admin/payments">فتح سجل المدفوعات والاسترداد</Link></div>
  <div className="portal-section-title"><div><h2><FileText size={17}/> معاملات الدفع المؤكدة</h2><p>{paid.length} عملية مؤكدة من أصل {items.length} عملية مسجلة</p></div><button className="portal-button secondary" onClick={()=>void load()}><RefreshCw size={14}/> تحديث</button></div>
  {error&&<p role="alert" style={{color:"#a44",fontSize:11}}>{error}</p>}
  {loading?<div className="portal-empty">جارٍ تحميل السجل المالي...</div>:<div style={{display:"grid",gap:9}}>
   {items.map(item=><article className="portal-card" key={item.providerPaymentId}>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><strong>{(Number(item.amount||0)/100).toFixed(2)} {item.currency||"SAR"}</strong><span className="portal-chip">{item.status}</span></div>
    <p>{item.email} · {item.paymentMethod||"وسيلة دفع غير محددة"}</p><small>رقم عملية مزود الدفع: {item.providerPaymentId}</small><small>رقم الطلب: {item.requestId}</small><small>تاريخ الدفع: {item.paidAt?new Date(item.paidAt).toLocaleString("ar-EG"):"—"}</small>
    {Number(item.refundedAmount)>0&&<small>المبلغ المسترد: {(Number(item.refundedAmount)/100).toFixed(2)} {item.currency}</small>}
   </article>)}
   {!items.length&&<div className="portal-empty">لا توجد عمليات مالية مسجلة.</div>}
  </div>}
 </PlatformLayout>
}
