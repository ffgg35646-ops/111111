"use client";
import {useEffect,useState} from "react";
import {useParams} from "next/navigation";
import Link from "next/link";
import {QRCodeSVG} from "qrcode.react";
import {PlatformLayout} from "@/components/platform-layout";
type Invoice={invoiceId:string;invoiceNumber:string;requestId:string;customerName:string;customerEmail:string;customerPhone?:string;sellerName:string;sellerVatNumber?:string;sellerAddress?:string;sellerCommercialRegistration?:string;currency:string;subtotalAmount:number;discountAmount:number;taxAmount:number;vatRateBps:number;totalAmount:number;providerFee?:number|null;paymentMethod?:string;lines:Array<{description:string;quantity:number;unitPrice:number;lineTotal:number}>;invoiceType:string;zatcaPhase2Integrated:boolean;qrCodeBase64?:string;issuedAt:string;paidAt:string};
export default function InvoicePage(){
 const params=useParams<{invoiceId:string}>(),id=Array.isArray(params.invoiceId)?params.invoiceId[0]:params.invoiceId;
 const [invoice,setInvoice]=useState<Invoice|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;fetch("/api/platform/invoices?id="+encodeURIComponent(id||""),{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل المستند");if(active)setInvoice(d.invoice)}).catch(e=>{if(active)setError(e.message||"تعذر تحميل المستند")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[id]);
 return <PlatformLayout title="مستند المبيعات" description="نسخة قابلة للطباعة من مستند العملية المدفوعة.">
 {loading?<div className="portal-empty">جارٍ تحميل المستند...</div>:error?<div className="portal-callout" role="alert">{error}</div>:invoice?<section className="portal-card" style={{maxWidth:850,margin:"0 auto",padding:28}}>
 <div style={{display:"flex",justifyContent:"space-between",gap:14,flexWrap:"wrap",alignItems:"flex-start"}}>
  <div><h1 style={{fontSize:24,margin:"0 0 6px"}}>{invoice.sellerName||"اتزان"}</h1><p style={{margin:0}}>من المعرفة إلى الممارسة</p></div>
  <div style={{textAlign:"left"}}><strong>{invoice.invoiceType==="tax_invoice"?"فاتورة ضريبية مبسطة":"إيصال / فاتورة مبيعات"}</strong><p>رقم المستند: {invoice.invoiceNumber}</p><p>تاريخ الإصدار: {new Date(invoice.issuedAt).toLocaleString("ar-SA")}</p></div>
 </div>
 <hr style={{margin:"22px 0",borderColor:"#dde5e7"}}/>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
  <div><strong>بيانات العميل</strong><p>{invoice.customerName}</p><p>{invoice.customerEmail}</p>{invoice.customerPhone&&<p>{invoice.customerPhone}</p>}</div>
  <div><strong>بيانات البائع</strong><p>{invoice.sellerName}</p>{invoice.sellerVatNumber&&<p>الرقم الضريبي: {invoice.sellerVatNumber}</p>}{invoice.sellerCommercialRegistration&&<p>السجل التجاري: {invoice.sellerCommercialRegistration}</p>}{invoice.sellerAddress&&<p>{invoice.sellerAddress}</p>}</div>
 </div>
 <div style={{overflowX:"auto",marginTop:18}}>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
  <thead><tr style={{background:"#f2f6f6",textAlign:"right"}}>{["الوصف","الكمية","سعر الوحدة","الإجمالي"].map(x=><th key={x} style={{padding:10}}>{x}</th>)}</tr></thead>
  <tbody>{invoice.lines.map((line,i)=><tr key={i} style={{borderBottom:"1px solid #edf0f0"}}><td style={{padding:10}}>{line.description}</td><td style={{padding:10}}>{line.quantity}</td><td style={{padding:10}}>{Number(line.unitPrice).toFixed(2)} {invoice.currency}</td><td style={{padding:10}}>{Number(line.lineTotal).toFixed(2)} {invoice.currency}</td></tr>)}</tbody>
 </table></div>
 <div style={{display:"grid",justifyContent:"end",gap:7,marginTop:18,fontSize:12}}>
  <div>الإجمالي قبل الخصم: {invoice.subtotalAmount.toFixed(2)} {invoice.currency}</div>
  {invoice.discountAmount>0&&<div>الخصم: −{invoice.discountAmount.toFixed(2)} {invoice.currency}</div>}
  {invoice.taxAmount>0&&<div>ضريبة القيمة المضافة ({(invoice.vatRateBps/100).toFixed(2)}%): {invoice.taxAmount.toFixed(2)} {invoice.currency}</div>}
  <strong style={{fontSize:18}}>الإجمالي المدفوع: {invoice.totalAmount.toFixed(2)} {invoice.currency}</strong>
 </div>
 <div style={{display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap",alignItems:"center",marginTop:24,paddingTop:18,borderTop:"1px solid #dde5e7"}}>
  <div><p>وسيلة الدفع: {invoice.paymentMethod||"Moyasar"}</p><p>رقم الطلب: {invoice.requestId}</p><p>تاريخ الدفع: {new Date(invoice.paidAt).toLocaleString("ar-SA")}</p></div>
  {invoice.qrCodeBase64&&<div style={{textAlign:"center"}}><QRCodeSVG value={invoice.qrCodeBase64} size={124} level="M"/><small style={{display:"block",marginTop:6}}>رمز بيانات الفاتورة</small></div>}
 </div>
 <div className="portal-callout" style={{marginTop:18}}>المستند الإلكتروني صادر من منصة اتزان. تكامل المرحلة الثانية مع منصة «فاتورة» التابعة لهيئة الزكاة والضريبة والجمارك غير مفعّل في هذا الإصدار؛ لا تعتبر هذه الصفحة إثباتًا لاكتمال متطلبات الفوترة الإلكترونية للمرحلة الثانية.</div>
 <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:16}}><button className="portal-button" onClick={()=>window.print()}>طباعة / حفظ PDF</button><Link className="portal-button secondary" href="/membership">العودة إلى العضويات</Link></div>
 </section>:null}
 </PlatformLayout>;
}
