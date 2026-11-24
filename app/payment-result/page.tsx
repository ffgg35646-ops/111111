"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {PlatformLayout} from "@/components/platform-layout";
type Download={bookId:string;title:string};
export default function PaymentResultPage(){
 const [state,setState]=useState("checking"),[message,setMessage]=useState("جارٍ التحقق من العملية لدى مزود الدفع..."),[downloads,setDownloads]=useState<Download[]>([]);
 useEffect(()=>{
  const q=new URLSearchParams(window.location.search),id=q.get("id")||"",requestId=q.get("requestId")||"";
  if(!id||!requestId){Promise.resolve().then(()=>{setState("error");setMessage("بيانات العودة من بوابة الدفع غير مكتملة.")});return}
  let active=true;
  fetch("/api/payments/moyasar/verify?"+new URLSearchParams({id,requestId}),{cache:"no-store"}).then(async r=>{
   const d=await r.json();if(!r.ok)throw new Error(d.error);if(!active)return;
   if(d.paid){setState("paid");setMessage("تم تأكيد الدفع واعتماد الطلب بنجاح.");if(d.kind==="book_order"&&Array.isArray(d.items))setDownloads(d.items.filter((item:Record<string,unknown>)=>item.productType==="digital"&&typeof item.bookId==="string").map((item:Record<string,unknown>)=>({bookId:String(item.bookId),title:String(item.title||"تنزيل الكتاب")})));}
   else{setState("pending");setMessage(d.message||"لم يؤكد مزود الدفع نجاح العملية بعد. لا تعاود الدفع قبل تحديث الحالة.")}
  }).catch(e=>{if(active){setState("error");setMessage(e.message||"تعذر التحقق من الدفع.")}});
  return()=>{active=false};
 },[]);
 return <PlatformLayout title="نتيجة الدفع" description="التحقق من حالة عملية الدفع عبر الخادم.">
  <section className="portal-card"><strong>{state==="paid"?"تم الدفع":state==="checking"?"جارٍ التحقق":"لم يكتمل التأكيد"}</strong><p>{message}</p>
   {state==="paid"&&downloads.length>0&&<div style={{display:"grid",gap:10,marginTop:16}}><h2 style={{fontSize:15}}>كتبك الإلكترونية</h2>{downloads.map(item=><a key={item.bookId} className="portal-button" href={"/api/books/download?"+new URLSearchParams({requestId:new URLSearchParams(window.location.search).get("requestId")||"",bookId:item.bookId})} style={{textDecoration:"none",width:"fit-content"}}>تنزيل: {item.title}</a>)}</div>}
   {state==="paid"&&downloads.length===0&&<p>إذا كان طلبك يتضمن كتاباً ورقياً، فسيتم استكمال ترتيبات التسليم وفق بيانات الطلب.</p>}
   {state==="paid"&&<Link href="/dashboard">العودة إلى حسابك</Link>}
   {state!=="paid"&&<Link href="/pay-request">العودة إلى صفحة الدفع</Link>}
  </section>
 </PlatformLayout>;
}