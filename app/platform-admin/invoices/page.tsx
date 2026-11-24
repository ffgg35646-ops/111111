"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {FileText,RefreshCw,ShieldAlert} from "lucide-react";
import {PlatformLayout} from "@/components/platform-layout";
type Invoice={invoiceId:string;invoiceNumber:string;requestId:string;customerName:string;customerEmail:string;currency:string;totalAmount:number;taxAmount:number;providerFee?:number|null;invoiceType:string;zatcaPhase2Integrated:boolean;issuedAt:string};
export default function AdminInvoicesPage(){
 const [items,setItems]=useState<Invoice[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setError("");const r=await fetch("/api/platform/invoices",{cache:"no-store"}),d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل الفواتير");setItems(d.invoices||[])}
 useEffect(()=>{let active=true;fetch("/api/platform/invoices",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.invoices||[])}).catch(e=>{if(active)setError(e.message||"تعذر تحميل الفواتير")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <PlatformLayout title="الفواتير الإلكترونية" description="عرض مستندات المبيعات الصادرة من عمليات الدفع المؤكدة، مع حالة بيانات الضريبة وتكامل الفوترة.">
 <div className="portal-callout"><ShieldAlert size={15}/> يتم إنشاء رقم مستند وبيانات QR عند توافر الرقم الضريبي وإعدادات البائع. تكامل المرحلة الثانية مع «فاتورة» غير مفعّل، ولذلك لا تُعرض هذه المستندات على أنها متوافقة بالكامل مع ZATCA Phase 2.</div>
 <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
  <Link className="portal-button secondary" href="/platform-admin/payments">سجل المدفوعات والاسترداد</Link>
  <Link className="portal-button secondary" href="/platform-admin/course-pricing">تسعير الدورات</Link>
  <Link className="portal-button secondary" href="/platform-admin/coupons">كوبونات الخصم</Link>
  <Link className="portal-button secondary" href="/platform-admin/membership-plans">باقات العضوية</Link>
 </div>
 <div className="portal-section-title"><div><h2><FileText size={17}/> المستندات المصدرة</h2><p>{items.length} مستند</p></div><button className="portal-button secondary" onClick={()=>void load()}><RefreshCw size={14}/> تحديث</button></div>
 {error&&<p role="alert" style={{color:"#a44",fontSize:11}}>{error}</p>}
 {loading?<div className="portal-empty">جارٍ تحميل الفواتير...</div>:<div style={{display:"grid",gap:9}}>
 {items.map(i=><article className="portal-card" key={i.invoiceId}>
  <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><strong>{i.invoiceNumber}</strong><span className="portal-chip">{i.invoiceType==="tax_invoice"?"مستند ضريبي – تكامل غير مكتمل":"مستند مبيعات"}</span></div>
  <p>{i.customerName} · {i.customerEmail}</p>
  <strong>{i.totalAmount.toFixed(2)} {i.currency}</strong>
  <small>الضريبة المسجلة: {i.taxAmount.toFixed(2)} {i.currency} · عمولة مزود الدفع على التاجر: {typeof i.providerFee==="number"?i.providerFee.toFixed(2)+" "+i.currency:"غير متاحة"}</small>
  <small>تاريخ الإصدار: {new Date(i.issuedAt).toLocaleString("ar-SA")}</small>
  <Link className="portal-link-button" href={"/invoices/"+i.invoiceId}>عرض وطباعة المستند</Link>
 </article>)}
 {!items.length&&<div className="portal-empty">لا توجد فواتير بعد. يصدر المستند بعد تأكيد عملية الدفع من مزود الدفع.</div>}
 </div>}
 </PlatformLayout>
}
