"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, FileCheck2, ShieldAlert } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type PrivacyRequest = {
  requestId: string; userId: string; requesterName: string; requesterEmail: string;
  requestType: string; description: string; status: string; receivedAt: string; dueAt: string;
  extensionCount?: number; extensionReason?: string; extensionNoticeMethod?: string; extensionNoticeAt?: string;
  adminNote?: string;
};
const typeLabels:Record<string,string>={access:"الوصول إلى البيانات",copy:"نسخة من البيانات",correction:"تصحيح البيانات",deletion:"إتلاف البيانات",restriction:"تقييد المعالجة",withdraw_consent:"العدول عن الموافقة",objection:"اعتراض/استفسار",other:"أخرى"};
const statusLabels:Record<string,string>={received:"مستلم",in_review:"قيد المراجعة",fulfilled:"تمت المعالجة",rejected:"مرفوض مع سبب"};
const fmt=(v:string)=>new Date(v).toLocaleDateString("ar-SA",{dateStyle:"medium"});
export default function PrivacyRequestsAdminPage(){
  const [items,setItems]=useState<PrivacyRequest[]>([]);
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [extensionReason,setExtensionReason]=useState<Record<string,string>>({});
  const [noticeDetails,setNoticeDetails]=useState<Record<string,string>>({});
  const [noticeMethod,setNoticeMethod]=useState<Record<string,string>>({});
  const [noticeSent,setNoticeSent]=useState<Record<string,boolean>>({});
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function load(){
    const r=await fetch("/api/privacy/requests?admin=1",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل الطلبات.");setItems(d.requests||[]);
  }
  useEffect(()=>{
    let active=true;
    fetch("/api/privacy/requests?admin=1",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.requests||[])})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"تعذر تحميل الطلبات.")})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);
  async function act(item:PrivacyRequest,action:"review"|"fulfill"|"reject"|"extend"){
    setBusy(item.requestId);setError("");setMessage("");
    try{
      const payload:Record<string,unknown>={requestId:item.requestId,action,adminNote:notes[item.requestId]||""};
      if(action==="extend"){
        payload.extensionReason=extensionReason[item.requestId]||"";
        payload.noticeDetails=noticeDetails[item.requestId]||"";
        payload.noticeMethod=noticeMethod[item.requestId]||"";
        payload.noticeSent=noticeSent[item.requestId]===true;
      }
      const r=await fetch("/api/privacy/requests",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحديث الطلب.");
      setMessage("تم تحديث الطلب "+item.requestId);await load();
    }catch(e){setError(e instanceof Error?e.message:"تعذر تحديث الطلب.");}
    finally{setBusy("");}
  }
  return <PlatformLayout title="طلبات أصحاب البيانات" description="تابع طلبات الوصول والتصحيح والإتلاف والاعتراض، والتزم بمهلة الاستجابة مع توثيق أي تمديد وإشعار لصاحب البيانات.">
    <div className="portal-callout"><Clock3 size={16}/> الاستجابة خلال 30 يوماً كقاعدة عامة. يمكن تسجيل تمديد واحد لا يتجاوز 30 يوماً إضافياً في الحالات المقررة، بعد توثيق السبب والإشعار المسبق.</div>
    {error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}{message&&<p role="status" style={{color:"#18745e"}}>{message}</p>}
    {loading?<div className="portal-empty">جارٍ تحميل الطلبات...</div>:<div style={{display:"grid",gap:14}}>
      {items.map(item=><article className="portal-card" key={item.requestId}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div><strong>{typeLabels[item.requestType]||item.requestType}</strong><p style={{margin:"4px 0",fontSize:12,color:"#77878f"}}>{item.requesterName} · {item.requesterEmail}</p></div>
          <span className="portal-chip">{statusLabels[item.status]||item.status}</span>
        </div>
        <p>{item.description}</p>
        <small>استلام: {fmt(item.receivedAt)} · الاستحقاق: {fmt(item.dueAt)} · {item.extensionCount===1?"تم تمديده":"دون تمديد"}</small>
        {item.extensionReason&&<p style={{fontSize:12,color:"#916b36"}}>سبب التمديد: {item.extensionReason} · طريقة الإشعار: {item.extensionNoticeMethod} · {item.extensionNoticeAt?fmt(item.extensionNoticeAt):""}</p>}
        {item.status!=="fulfilled"&&item.status!=="rejected"&&<>
          <label style={{display:"grid",gap:5,marginTop:10,fontSize:12}}>ملاحظة أو قرار الإدارة<textarea rows={2} maxLength={2000} value={notes[item.requestId]||""} onChange={e=>setNotes(v=>({...v,[item.requestId]:e.target.value}))} placeholder="توضيح الإجراء أو سبب الرفض أو نتيجة التنفيذ"/></label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
            <button className="portal-button secondary" disabled={busy===item.requestId} onClick={()=>void act(item,"review")}>بدء المراجعة</button>
            <button className="portal-button" disabled={busy===item.requestId||(notes[item.requestId]||"").trim().length<10} onClick={()=>void act(item,"fulfill")}><CheckCircle2 size={14}/> توثيق المعالجة</button>
            <button className="portal-button secondary" disabled={busy===item.requestId||(notes[item.requestId]||"").trim().length<10} onClick={()=>void act(item,"reject")}><ShieldAlert size={14}/> رفض مسبب</button>
          </div>
          {Number(item.extensionCount||0)<1&&<details style={{marginTop:12}}>
            <summary style={{cursor:"pointer",fontSize:12,fontWeight:700}}>تمديد مهلة الرد حتى 30 يوماً إضافياً</summary>
            <div style={{display:"grid",gap:8,marginTop:10}}>
              <label style={{display:"grid",gap:5,fontSize:12}}>سبب التمديد<textarea rows={2} value={extensionReason[item.requestId]||""} onChange={e=>setExtensionReason(v=>({...v,[item.requestId]:e.target.value}))}/></label>
              <label style={{display:"grid",gap:5,fontSize:12}}>طريقة إشعار صاحب البيانات<select value={noticeMethod[item.requestId]||""} onChange={e=>setNoticeMethod(v=>({...v,[item.requestId]:e.target.value}))}><option value="">اختر الطريقة</option><option value="email">البريد الإلكتروني</option><option value="sms">رسالة نصية</option><option value="phone">اتصال هاتفي</option><option value="portal">إشعار داخل المنصة</option><option value="other">أخرى</option></select></label>
              <label style={{display:"grid",gap:5,fontSize:12}}>تفاصيل الإشعار<textarea rows={2} value={noticeDetails[item.requestId]||""} onChange={e=>setNoticeDetails(v=>({...v,[item.requestId]:e.target.value}))}/></label>
              <label style={{display:"flex",gap:8,alignItems:"center",fontSize:12}}><input type="checkbox" checked={noticeSent[item.requestId]===true} onChange={e=>setNoticeSent(v=>({...v,[item.requestId]:e.target.checked}))}/> أؤكد أنني أرسلت إشعار التمديد لصاحب البيانات مسبقاً</label>
              <button className="portal-button secondary" disabled={busy===item.requestId||!noticeSent[item.requestId]||(extensionReason[item.requestId]||"").trim().length<15||(noticeDetails[item.requestId]||"").trim().length<10||!noticeMethod[item.requestId]} onClick={()=>void act(item,"extend")}>تسجيل التمديد</button>
            </div>
          </details>}
        </>}
      </article>)}
      {!items.length&&<div className="portal-empty">لا توجد طلبات خصوصية واردة.</div>}
    </div>}
  </PlatformLayout>;
}
