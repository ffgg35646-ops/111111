"use client";
import {useEffect,useRef,useState} from "react";
import Script from "next/script";
import {PlatformLayout} from "@/components/platform-layout";

declare global {
 interface Window {
  Moyasar?: { init:(options:Record<string,unknown>)=>void };
 }
}
type Intent={id:string;clientSecret:string;amount:number;currency:string;description:string;publishableApiKey:string;callbackUrl:string;saveCard?:boolean};
type MoyasarCompletedPayment={id?:string;source?:{token?:string}};
const applePayValidationUrl=process.env.NEXT_PUBLIC_MOYASAR_APPLE_PAY_VALIDATE_MERCHANT_URL||"";

export default function PayRequestPage(){
 const [requestId,setRequestId]=useState(""),[email,setEmail]=useState(""),[intent,setIntent]=useState<Intent|null>(null),[scriptReady,setScriptReady]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[tokenNotice,setTokenNotice]=useState("");
 const initialized=useRef("");
 useEffect(()=>{const q=new URLSearchParams(window.location.search);Promise.resolve().then(()=>{setRequestId(q.get("requestId")||"");setEmail(q.get("email")||"")})},[]);
 useEffect(()=>{
  if(!intent||!scriptReady||!window.Moyasar||initialized.current===intent.id)return;
  const node=document.querySelector(".mysr-form");if(!node)return;
  node.innerHTML="";
  const options:Record<string,unknown>={
   element:".mysr-form",
   amount:intent.amount,
   currency:intent.currency,
   description:intent.description,
   publishable_api_key:intent.publishableApiKey,
   callback_url:intent.callbackUrl,
   methods:applePayValidationUrl?["creditcard","applepay"]:["creditcard"],
   supported_networks:["mada","visa","mastercard","amex","unionpay"],
   use_payment_intent:true,
   payment_intent:{id:intent.id,client_secret:intent.clientSecret},
   credit_card:{save_card:intent.saveCard===true},
   on_completed:async(payment:MoyasarCompletedPayment)=>{
    if(intent.saveCard&&payment.id&&payment.source?.token){
     try{
      const response=await fetch("/api/payments/moyasar/save-token",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({requestId,paymentId:payment.id,token:payment.source.token})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"تعذر حفظ بطاقة التجديد.");
      setTokenNotice("تم حفظ وسيلة الدفع للتجديد بعد تفعيل موافقة الاشتراك.");
     }catch(cause){setTokenNotice(cause instanceof Error?cause.message:"تعذر حفظ البطاقة؛ سيبقى التجديد يدويًا.");}
    }
   },
  };
  if(applePayValidationUrl){
   options.apple_pay={country:"SA",label:"ETZAN | اتزان",validate_merchant_url:applePayValidationUrl,save_card:intent.saveCard===true};
  }
  window.Moyasar.init(options);
  initialized.current=intent.id;
 },[intent,scriptReady,requestId]);
 async function prepare(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setLoading(true);setError("");setTokenNotice("");setIntent(null);initialized.current="";
  try{
   const r=await fetch("/api/payments/moyasar/intent",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({requestId,email})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تجهيز الدفع.");
   setIntent(d);
  }catch(cause){setError(cause instanceof Error?cause.message:"تعذر تجهيز الدفع");}
  finally{setLoading(false);}
 }
 return <PlatformLayout title="الدفع الآمن" description="دفع إلكتروني بالريال السعودي عبر Moyasar.">
  <Script src="https://cdn.moyasar.com/mpf/2.3.0/moyasar.js" strategy="afterInteractive" onLoad={()=>setScriptReady(true)}/>
  <link rel="stylesheet" href="https://cdn.moyasar.com/mpf/2.3.0/moyasar.css"/>
  <div className="portal-callout">بيانات البطاقة تُدخل في نموذج Moyasar الآمن ولا تحفظ منصة اتزان رقم البطاقة أو رمز الأمان. يدعم النموذج مدى وVisa وMastercard وAmerican Express؛ ويظهر Apple Pay عند تفعيل التاجر والتحقق من النطاق وإعداد رابط التحقق.</div>
  <form className="portal-card" onSubmit={prepare} style={{display:"grid",gap:12,marginTop:14}}>
   <label>رقم الطلب<input required value={requestId} onChange={e=>setRequestId(e.target.value)} placeholder="UUID"/></label>
   <label>البريد الإلكتروني المستخدم في الطلب<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <button className="portal-button" disabled={loading||!requestId||!email}>{loading?"جارٍ تجهيز العملية...":"متابعة إلى الدفع"}</button>
  </form>
  {error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}
  {intent&&<section className="portal-card" style={{marginTop:14}}>
   <h2>إجمالي المبلغ: {(intent.amount/100).toFixed(2)} SAR</h2>
   {intent.saveCard&&<p>هذا اشتراك دوري. ستُستخدم وسيلة الدفع المحفوظة فقط بعد موافقتك الصريحة، ويمكنك إيقاف التجديد من صفحة العضوية.</p>}
   <p style={{fontSize:11,color:"#71848a"}}>لا تفرض اتزان رسوم معالجة إضافية على صفحة الدفع. عمولة مزود الدفع تتبع عقد التاجر لدى Moyasar، وقد تُخصم من تسوية التاجر؛ وتُسجل في لوحة المدفوعات عند إرجاعها من المزود.</p>
   {tokenNotice&&<p role="status" style={{fontSize:11,color:"#8a6a37"}}>{tokenNotice}</p>}
   {scriptReady?<div className="mysr-form"/>:<p>جارٍ تحميل نموذج الدفع الآمن...</p>}
  </section>}
 </PlatformLayout>;
}