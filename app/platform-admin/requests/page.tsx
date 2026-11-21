"use client";

import { useCallback, useState } from "react";
import { Check, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type RequestRecord = {
  requestId: string; kind: string; name: string; email: string; phone?: string; status: string;
  courseTitle?: string; serviceId?: string; preferredAt?: string; requestNote?: string;
  durationMinutes?: number; attendees?: number; roomPurpose?: string;
  items?: { bookId: string; quantity: number }[]; deliveryRegion?: string; orderNote?: string;
  adminNote?: string; quotedAmount?: number; currency?: string; paymentStatus?: string;
  zoomMeeting?: { joinUrl?: string; startTime?: string }; createdAt?: string;
};

const serviceNames: Record<string,string> = {
  "social-consultation":"استشارة في الخدمة الاجتماعية",
  "professional-consultation":"استشارة مهنية للأخصائيين",
  "family-guidance":"إرشاد أسري وتوجيه الوالدين",
  "cbt-consultation":"جلسة CBT مع مختص",
};
const bookNames: Record<string,string> = {
  "book-social-case":"دليل دراسة الحالة في الخدمة الاجتماعية",
  "book-cbt-practice":"دفتر تطبيقات العلاج المعرفي السلوكي",
  "book-autism-support":"دليل التواصل والدعم للأسر",
  "book-developmental":"مدخل إلى التقدير النمائي والمهارات التكيفية",
  "book-scales":"مرشد قراءة المقاييس النفسية والنمائية",
};
const kindNames: Record<string,string> = {
  classroom_registration:"حجز فصل Zoom", consultation:"استشارة", room_rental:"تأجير قاعة Zoom",
  book_order:"طلب شراء كتاب", course_enrollment:"التحاق بدورة",
};

export default function PlatformRequestManagementPage() {
  const [key,setKey]=useState("");
  const [requests,setRequests]=useState<RequestRecord[]>([]);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [loaded,setLoaded]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const response=await fetch("/api/platform/requests/admin",{headers:{"x-platform-admin-key":key},cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر تحميل الطلبات.");
      setRequests(Array.isArray(data.requests)?data.requests:[]);setLoaded(true);
    } catch(cause){setError(cause instanceof Error?cause.message:"حدث خطأ غير متوقع.");}
    finally{setLoading(false);}
  },[key]);

  async function review(item:RequestRecord,action:"approve"|"reject") {
    if(action==="approve"&&item.kind==="book_order"&&!(Number(prices[item.requestId])>0)){setError("أدخل إجمالي سعر طلب الكتاب بالجنيه المصري أولاً.");return;}
    if(!window.confirm(action==="approve"?"تأكيد اعتماد الطلب؟ سيتم إنشاء اجتماع Zoom تلقائياً للطلبات التي تحتاج جلسة.":"تأكيد رفض الطلب؟"))return;
    setBusy(item.requestId);setError("");
    try{
      const response=await fetch("/api/platform/requests/admin",{method:"PATCH",headers:{"Content-Type":"application/json","x-platform-admin-key":key},body:JSON.stringify({requestId:item.requestId,action,adminNote:notes[item.requestId]||"",quotedAmount:prices[item.requestId]?Number(prices[item.requestId]):undefined})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر تحديث الطلب.");
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذر تحديث الطلب.");}
    finally{setBusy("");}
  }

  const pending=requests.filter(item=>item.status==="pending_review");
  return <PlatformLayout title="إدارة الطلبات والحجوزات" description="مراجعة طلبات الفصول والاستشارات والقاعات وطلبات شراء الكتب من لوحة موحدة.">
    <section className="portal-card" style={{marginBottom:18}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><ShieldCheck size={19}/><strong>دخول إدارة الطلبات</strong></div>
      <p style={{fontSize:12,color:"#71808d"}}>أدخل مفتاح PLATFORM_ADMIN_API_KEY. لا تحفظ الصفحة المفتاح في المتصفح أو قاعدة البيانات.</p>
      <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
        <input aria-label="مفتاح الإدارة" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="مفتاح الإدارة" style={{flex:"1 1 260px",minWidth:0,padding:11,border:"1px solid #dce5e9",borderRadius:8}}/>
        <button className="portal-button" disabled={loading||key.length<32} onClick={load}>{loading?<LoaderCircle size={15} className="spin"/>:<KeyRound size={15}/>} تحميل الطلبات</button>
        <button className="portal-button secondary" disabled={loading||!loaded} onClick={load}><RefreshCw size={15}/> تحديث</button>
      </div>
      {error&&<p role="alert" style={{color:"#b64b48",fontSize:12,marginTop:10}}>{error}</p>}
    </section>
    {loaded&&<div className="portal-section-title"><div><h2>طلبات قيد المراجعة ({pending.length})</h2><p>إجمالي الطلبات المعروضة: {requests.length}</p></div></div>}
    {loaded&&requests.length===0&&<div className="portal-card"><p>لا توجد طلبات حتى الآن.</p></div>}
    <div style={{display:"grid",gap:14}}>
      {requests.map(item=><article className="portal-card" key={item.requestId} style={{padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <div><span className="portal-chip">{kindNames[item.kind]||item.kind}</span><h3 style={{margin:"9px 0 4px"}}>{item.name}</h3><small style={{color:"#71808d"}}>{item.email}{item.phone?" · "+item.phone:""}</small></div>
          <strong style={{fontSize:12,color:item.status==="pending_review"?"#a36d2c":item.status==="approved"?"#287b61":"#b64b48"}}>{item.status==="pending_review"?"قيد المراجعة":item.status==="approved"?"تمت الموافقة":item.status==="rejected"?"مرفوض":"بانتظار الدفع"}</strong>
        </div>
        <div style={{display:"grid",gap:5,fontSize:12,color:"#536a75",marginTop:12}}>
          {item.courseTitle&&<div>الدورة: {item.courseTitle}</div>}
          {item.serviceId&&<div>الخدمة: {serviceNames[item.serviceId]||item.serviceId}</div>}
          {item.preferredAt&&<div>الموعد المطلوب: {new Date(item.preferredAt).toLocaleString("ar-EG")}</div>}
          {item.durationMinutes&&<div>المدة: {item.durationMinutes} دقيقة · الحضور: {item.attendees||"—"}</div>}
          {item.roomPurpose&&<div>الغرض: {item.roomPurpose}</div>}
          {item.items&&<div>الكتب: {item.items.map(row=>(bookNames[row.bookId]||row.bookId)+" × "+row.quantity).join("، ")}</div>}
          {item.deliveryRegion&&<div>منطقة التسليم: {item.deliveryRegion}</div>}
          {item.requestNote&&<div>ملاحظات: {item.requestNote}</div>}
          {item.orderNote&&<div>ملاحظة الطلب: {item.orderNote}</div>}
          {item.quotedAmount&&<div>الإجمالي: {item.quotedAmount} {item.currency||"EGP"} · حالة الدفع: {item.paymentStatus==="payment_due"?"بانتظار الدفع":item.paymentStatus||"غير محدد"}</div>}
          {item.zoomMeeting?.joinUrl&&<a href={item.zoomMeeting.joinUrl} target="_blank" rel="noreferrer">رابط اجتماع Zoom</a>}
        </div>
        {item.status==="pending_review"&&<div style={{display:"grid",gap:9,marginTop:14}}>
          {item.kind==="book_order"&&<label style={{fontSize:11,color:"#536a75"}}>إجمالي السعر بالجنيه المصري<input type="number" min="1" step="0.01" value={prices[item.requestId]||""} onChange={e=>setPrices(v=>({...v,[item.requestId]:e.target.value}))} style={{display:"block",width:"100%",padding:10,border:"1px solid #dce5e9",borderRadius:8,marginTop:5}}/></label>}
          <textarea rows={2} maxLength={1000} value={notes[item.requestId]||""} onChange={e=>setNotes(v=>({...v,[item.requestId]:e.target.value}))} placeholder="ملاحظة إدارية أو تعليمات للعميل..." style={{width:"100%",padding:10,border:"1px solid #dce5e9",borderRadius:8}}/>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="portal-button" disabled={busy===item.requestId} onClick={()=>review(item,"approve")}><Check size={15}/> اعتماد الطلب</button>
            <button className="portal-button secondary" disabled={busy===item.requestId} onClick={()=>review(item,"reject")}><X size={15}/> رفض الطلب</button>
            {busy===item.requestId&&<small>جارٍ تنفيذ الإجراء...</small>}
          </div>
          {item.kind==="book_order"&&<small style={{color:"#8a7a60"}}>اعتماد الطلب يسجل السعر ويجعله بانتظار الدفع؛ لا يوجد بوابة دفع مربوطة حالياً.</small>}
        </div>}
      </article>)}
    </div>
    <div className="portal-callout" style={{marginTop:18}}>إنشاء روابط Zoom يتطلب إعداد Server-to-Server OAuth على الخادم. طلبات الكتب تعتمد السعر المدخل إدارياً وتظل بانتظار الدفع حتى ربط بوابة دفع معتمدة.</div>
  </PlatformLayout>;
}
