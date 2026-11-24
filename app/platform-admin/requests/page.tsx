"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, LogOut, RefreshCw, ShieldCheck, X } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type RequestRecord = {
  requestId: string; kind: string; name: string; email: string; phone?: string; status: string;
  courseTitle?: string; serviceId?: string; preferredAt?: string; requestNote?: string;
  durationMinutes?: number; attendees?: number; roomPurpose?: string;
  items?: { bookId: string; quantity: number; title?: string; productType?: string; unitPrice?: number }[]; deliveryRegion?: string; orderNote?: string; expectedAmount?: number;
  adminNote?: string; quotedAmount?: number; currency?: string; paymentStatus?: string; paymentId?: string; cancellationRequestedAt?: string; cancellationRefundStatus?: string; rescheduledAt?: string;
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
  const router=useRouter();
  const [requests,setRequests]=useState<RequestRecord[]>([]);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [authenticated,setAuthenticated]=useState(false);
  const [canReview,setCanReview]=useState(false);

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const response=await fetch("/api/platform/requests/admin",{cache:"no-store"});
      const data=await response.json();
      if(response.status===401||response.status===403){router.replace("/login?next=/platform-admin/requests");return;}
      if(!response.ok)throw new Error(data.error||"تعذر تحميل الطلبات.");
      setRequests(Array.isArray(data.requests)?data.requests:[]);
      setPrices(current=>({...Object.fromEntries((data.requests||[]).filter((item:RequestRecord)=>Number(item.expectedAmount)>0).map((item:RequestRecord)=>[item.requestId,String(item.expectedAmount)])),...current}));
      setAuthenticated(true);
    } catch(cause){setError(cause instanceof Error?cause.message:"حدث خطأ غير متوقع.");}
    finally{setLoading(false);}
  },[router]);

  useEffect(()=>{
    let active=true;
    fetch("/api/auth/session",{cache:"no-store"}).then(async response=>{
      const data=await response.json();
      if(!active)return;
      if(response.ok&&["admin","platform_manager","accountant","support"].includes(data.user?.role)&&!data.user?.mustChangePassword){setCanReview(["admin","platform_manager"].includes(data.user?.role));void load();}
      else if(response.ok&&data.user?.mustChangePassword)router.replace("/account/change-password");
      else router.replace("/login?next=/platform-admin/requests");
    }).catch(()=>{if(active)router.replace("/login?next=/platform-admin/requests");});
    return()=>{active=false;};
  },[load,router]);

  async function logout(){
    await fetch("/api/auth/logout",{method:"POST"});
    router.replace("/login");
    router.refresh();
  }

  async function refundConsultation(item:RequestRecord) {
    if(!item.paymentId)return;
    if(!window.confirm("تأكيد استرداد قيمة الاستشارة عبر Moyasar؟"))return;
    setBusy(item.requestId);setError("");setNotice("");
    try {
      const response=await fetch("/api/platform/payments/refund",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({paymentId:item.paymentId})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر تنفيذ الاسترداد.");
      setNotice("تم إرسال الاسترداد إلى Moyasar. الحالة: "+data.status);
      await load();
    } catch(cause) { setError(cause instanceof Error?cause.message:"تعذر تنفيذ الاسترداد."); }
    finally { setBusy(""); }
  }

  async function review(item:RequestRecord,action:"approve"|"reject") {
    if(action==="approve"&&!(Number(prices[item.requestId])>0)){
      setError("أدخل إجمالي السعر بالريال السعودي قبل اعتماد الطلب.");return;
    }
    if(!window.confirm(action==="approve"?"تأكيد اعتماد الطلب؟ سيتم إنشاء اجتماع Zoom تلقائياً للطلبات التي تحتاج جلسة.":"تأكيد رفض الطلب؟"))return;
    setBusy(item.requestId);setError("");
    try{
      const response=await fetch("/api/platform/requests/admin",{
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({requestId:item.requestId,action,adminNote:notes[item.requestId]||"",quotedAmount:prices[item.requestId]?Number(prices[item.requestId]):undefined}),
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"تعذر تحديث الطلب.");
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذر تحديث الطلب.");}
    finally{setBusy("");}
  }

  const pending=requests.filter(item=>item.status==="pending_review");
  return <PlatformLayout title="إدارة الطلبات والحجوزات" description="مراجعة طلبات الفصول والاستشارات والقاعات وطلبات شراء الكتب من لوحة موحدة.">
    <section className="portal-card" style={{marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><ShieldCheck size={19}/><strong>إدارة الطلبات بصلاحية مدير المنصة</strong></div>
      <div style={{display:"flex",gap:8}}>
        <button className="portal-button secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={15}/> تحديث</button>
        <button className="portal-button secondary" onClick={()=>void logout()}><LogOut size={15}/> تسجيل الخروج</button>
      </div>
    </section>
    {error&&<p role="alert" style={{color:"#b64b48",fontSize:12,margin:"0 0 12px"}}>{error}</p>}{notice&&<p role="status" className="portal-callout">{notice}</p>}
    {loading&&!authenticated&&<div className="portal-card"><LoaderCircle size={16}/> جارٍ التحقق من صلاحية الحساب...</div>}
    {authenticated&&<div className="portal-section-title"><div><h2>طلبات قيد المراجعة ({pending.length})</h2><p>إجمالي الطلبات المعروضة: {requests.length}</p></div></div>}
    {authenticated&&requests.length===0&&!loading&&<div className="portal-card"><p>لا توجد طلبات حتى الآن.</p></div>}
    <div style={{display:"grid",gap:14}}>
      {requests.map(item=><article className="portal-card" key={item.requestId} style={{padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <div><span className="portal-chip">{kindNames[item.kind]||item.kind}</span><h3 style={{margin:"9px 0 4px"}}>{item.name}</h3><small style={{color:"#71808d"}}>{item.email}{item.phone?" · "+item.phone:""}</small></div>
          <strong style={{fontSize:12,color:item.status==="pending_review"?"#a36d2c":item.status==="approved"?"#287b61":"#b64b48"}}>{item.status==="pending_review"?"قيد المراجعة":item.status==="approved"?"تم الدفع والاعتماد":item.status==="awaiting_payment"?"بانتظار الدفع":item.status==="rejected"?"مرفوض":item.status==="cancellation_requested"?"طلب إلغاء بانتظار الاسترداد":item.status==="cancelled"?"ملغي":item.status==="refunded"?"مسترد":item.status==="provisioning"?"جارٍ تجهيز الاجتماع":"بانتظار المراجعة"}</strong>
        </div>
        <div style={{display:"grid",gap:5,fontSize:12,color:"#536a75",marginTop:12}}>
          {item.courseTitle&&<div>الدورة: {item.courseTitle}</div>}
          {item.serviceId&&<div>الخدمة: {serviceNames[item.serviceId]||item.serviceId}</div>}
          {item.preferredAt&&<div>الموعد المطلوب: {new Date(item.preferredAt).toLocaleString("ar-EG")}</div>}
          {item.durationMinutes&&<div>المدة: {item.durationMinutes} دقيقة · الحضور: {item.attendees||"—"}</div>}
          {item.roomPurpose&&<div>الغرض: {item.roomPurpose}</div>}
          {item.items&&<div>الكتب: {item.items.map(row=>(row.title||bookNames[row.bookId]||row.bookId)+" × "+row.quantity).join("، ")}</div>}
          {item.deliveryRegion&&<div>منطقة التسليم: {item.deliveryRegion}</div>}
          {item.requestNote&&<div>ملاحظات: {item.requestNote}</div>}
          {item.orderNote&&<div>ملاحظة الطلب: {item.orderNote}</div>}
          {(item.quotedAmount||item.expectedAmount)&&<div>الإجمالي: {item.quotedAmount||item.expectedAmount} {item.currency||"SAR"} · حالة الدفع: {item.paymentStatus==="payment_due"?"بانتظار الدفع":item.paymentStatus||"غير محدد"}</div>}
          {item.adminNote&&<div>ملاحظة الإدارة: {item.adminNote}</div>}
          {item.zoomMeeting?.joinUrl&&<a href={item.zoomMeeting.joinUrl} target="_blank" rel="noreferrer">رابط اجتماع Zoom</a>}
        </div>
        {item.status==="cancellation_requested"&&canReview&&item.paymentStatus==="paid"&&item.paymentId&&<div style={{marginTop:14}}><p style={{fontSize:11,color:"#8a6541"}}>طلب العميل إلغاء الموعد. تنفيذ الاسترداد سيعيد إتاحة الفترة في تقويم مقدم الخدمة.</p><button className="portal-button secondary" disabled={busy===item.requestId} onClick={()=>void refundConsultation(item)}>تنفيذ الاسترداد وإتاحة الموعد</button></div>}
        {item.status==="pending_review"&&canReview&&<div style={{display:"grid",gap:9,marginTop:14}}>
          <label style={{fontSize:11,color:"#536a75"}}>السعر النهائي بالريال السعودي (SAR)<input type="number" min="1" step="0.01" value={prices[item.requestId]||""} onChange={e=>setPrices(v=>({...v,[item.requestId]:e.target.value}))} style={{display:"block",width:"100%",padding:10,border:"1px solid #dce5e9",borderRadius:8,marginTop:5}}/></label>
          <textarea rows={2} maxLength={1000} value={notes[item.requestId]||""} onChange={e=>setNotes(v=>({...v,[item.requestId]:e.target.value}))} placeholder="ملاحظة إدارية أو تعليمات للعميل..." style={{width:"100%",padding:10,border:"1px solid #dce5e9",borderRadius:8}}/>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="portal-button" disabled={busy===item.requestId} onClick={()=>review(item,"approve")}><Check size={15}/> اعتماد الطلب</button>
            <button className="portal-button secondary" disabled={busy===item.requestId} onClick={()=>review(item,"reject")}><X size={15}/> رفض الطلب</button>
            {busy===item.requestId&&<small>جارٍ تنفيذ الإجراء...</small>}
          </div>
          {item.kind==="book_order"&&<small style={{color:"#8a7a60"}}>اعتماد الطلب يثبت السعر ويتيح للمشتري الدفع الإلكتروني عبر Moyasar بعد تهيئة مفاتيح التاجر في إعدادات الخادم.</small>}
        </div>}
      </article>)}
    </div>
    <div className="portal-callout" style={{marginTop:18}}>إنشاء روابط Zoom يتطلب إعداد Server-to-Server OAuth على الخادم. لا يُكشف رابط الاجتماع لصاحب الطلب إلا بعد تأكيد الدفع من Moyasar والتحقق منه على الخادم.</div>
  </PlatformLayout>;
}
