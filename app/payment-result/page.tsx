"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {PlatformLayout} from "@/components/platform-layout";
type Download={bookId:string;title:string};
export default function PaymentResultPage(){
 const [state,setState]=useState("checking"),[message,setMessage]=useState("جارٍ التحقق من العملية لدى مزود الدفع..."),[downloads,setDownloads]=useState<Download[]>([]),[consultationJoinUrl,setConsultationJoinUrl]=useState(""),[invoiceId,setInvoiceId]=useState(""),[kind,setKind]=useState("");
 useEffect(()=>{
  const q=new URLSearchParams(window.location.search),id=q.get("id")||"",requestId=q.get("requestId")||"";
  if(!id||!requestId){Promise.resolve().then(()=>{setState("error");setMessage("بيانات العودة من بوابة الدفع غير مكتملة.")});return}
  let active=true;
  fetch("/api/payments/moyasar/verify?"+new URLSearchParams({id,requestId}),{cache:"no-store"}).then(async r=>{
   const d=await r.json();if(!r.ok)throw new Error(d.error);if(!active)return;
   if(d.paid){
    setState("paid");setMessage("تم تأكيد الدفع واعتماد الطلب بنجاح.");setKind(typeof d.kind==="string"?d.kind:"");setInvoiceId(typeof d.invoiceId==="string"?d.invoiceId:"");
    if(d.kind==="consultation"&&typeof d.zoomMeeting?.joinUrl==="string")setConsultationJoinUrl(d.zoomMeeting.joinUrl);
    if(d.kind==="book_order"&&Array.isArray(d.items))setDownloads(d.items.filter((item:Record<string,unknown>)=>item.productType==="digital"&&typeof item.bookId==="string").map((item:Record<string,unknown>)=>({bookId:String(item.bookId),title:String(item.title||"تنزيل الكتاب")})));
   }else{setState("pending");setMessage(d.message||"لم يؤكد مزود الدفع نجاح العملية بعد. لا تعاود الدفع قبل تحديث الحالة.")}
  }).catch(e=>{if(active){setState("error");setMessage(e.message||"تعذر التحقق من الدفع.")}});
  return()=>{active=false};
 },[]);
 return <PlatformLayout title="نتيجة الدفع" description="التحقق من حالة عملية الدفع عبر الخادم.">
  <section className="portal-card"><strong>{state==="paid"?"تم الدفع":state==="checking"?"جارٍ التحقق":"لم يكتمل التأكيد"}</strong><p>{message}</p>
   {state==="paid"&&invoiceId&&<div style={{marginTop:12}}><Link className="portal-button secondary" href={"/invoices/"+invoiceId}>عرض الفاتورة الإلكترونية</Link></div>}
   {state==="paid"&&kind==="membership"&&<div style={{display:"grid",gap:9,marginTop:16}}><p>تم تفعيل اشتراكك للفترة المدفوعة. يمكنك مراجعة حالة التجديد أو إيقافه من صفحة العضوية.</p><Link className="portal-button" href="/membership">إدارة عضويتي</Link></div>}
   {state==="paid"&&consultationJoinUrl&&<div style={{display:"grid",gap:10,marginTop:16}}><h2 style={{fontSize:15}}>موعدك المرئي عبر Zoom</h2><a href={consultationJoinUrl} target="_blank" rel="noreferrer" className="portal-button">الدخول إلى الاستشارة المرئية</a><Link href="/consultations">العودة إلى الاستشارات</Link></div>}
   {state==="paid"&&downloads.length>0&&<div style={{display:"grid",gap:10,marginTop:16}}><h2 style={{fontSize:15}}>كتبك الإلكترونية</h2>{downloads.map(item=><a key={item.bookId} className="portal-button" href={"/api/books/download?"+new URLSearchParams({requestId:new URLSearchParams(window.location.search).get("requestId")||"",bookId:item.bookId})} style={{textDecoration:"none",width:"fit-content"}}>تنزيل: {item.title}</a>)}</div>}
   {state==="paid"&&kind!=="membership"&&kind!=="book_order"&&<Link href="/dashboard">العودة إلى حسابك</Link>}
   {state!=="paid"&&<Link href="/pay-request">العودة إلى صفحة الدفع</Link>}
  </section>
 </PlatformLayout>;
}
