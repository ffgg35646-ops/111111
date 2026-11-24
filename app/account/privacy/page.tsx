"use client";

import { useEffect, useState, type FormEvent } from "react";
import { FileText, ShieldCheck, Send } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type PrivacyRequest = {
  requestId: string; requestType: string; description: string; status: string;
  receivedAt: string; dueAt: string; extensionCount?: number; adminNote?: string;
};
const types = [
  ["access","الوصول إلى بياناتي"],
  ["copy","الحصول على نسخة من بياناتي"],
  ["correction","تصحيح أو استكمال بياناتي"],
  ["deletion","طلب إتلاف بياناتي حيثما يسمح النظام"],
  ["restriction","تقييد معالجة بيانات محددة"],
  ["withdraw_consent","العدول عن موافقة معالجة"],
  ["objection","الاعتراض أو الاستفسار عن معالجة"],
  ["other","طلب آخر متعلق بالخصوصية"],
];
const labels: Record<string,string> = {
  received:"تم الاستلام",in_review:"قيد المراجعة",fulfilled:"تمت المعالجة",rejected:"أُغلق مع توضيح",
};
const fmt=(v:string)=>new Date(v).toLocaleDateString("ar-SA",{dateStyle:"medium"});
export default function AccountPrivacyPage(){
  const [items,setItems]=useState<PrivacyRequest[]>([]);
  const [requestType,setRequestType]=useState("access");
  const [description,setDescription]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let active=true;
    fetch("/api/privacy/requests",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.requests||[])})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"تعذر تحميل الطلبات.")})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const r=await fetch("/api/privacy/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestType,description})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر حفظ الطلب.");
      setItems(current=>[d.request,...current]);setDescription("");setNotice("تم استلام طلبك وتسجيل مهلة المتابعة.");
    }catch(e){setError(e instanceof Error?e.message:"تعذر إرسال الطلب.");}
    finally{setBusy(false);}
  }
  return <PlatformLayout title="خصوصية حسابي وطلباتي" description="يمكنك طلب الوصول إلى بياناتك أو الحصول على نسخة أو تصحيحها أو تقديم طلب متعلق بطريقة معالجتها.">
    <div className="portal-callout"><ShieldCheck size={16}/> يتم تسجيل الطلب باسم حسابك للتحقق من الهوية. المهلة المستهدفة للرد 30 يوماً؛ وقد تسجل إدارة المنصة تمديداً واحداً بحد أقصى 30 يوماً إضافياً مع توثيق الإشعار وسببه.</div>
    <section className="portal-card" style={{marginTop:16}}>
      <div className="portal-section-title"><div><h2><FileText size={18}/> تقديم طلب جديد</h2><p>لا تكتب كلمات مرور أو أرقام بطاقات أو بيانات لا تلزم لمعالجة طلبك.</p></div></div>
      <form onSubmit={submit} style={{display:"grid",gap:12}}>
        <label style={{display:"grid",gap:6}}>نوع الطلب<select value={requestType} onChange={e=>setRequestType(e.target.value)}>{types.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label style={{display:"grid",gap:6}}>تفاصيل الطلب<textarea required minLength={15} maxLength={2000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="حدد البيانات أو المعالجة التي يتعلق بها طلبك، دون مشاركة أسرار الحساب."/></label>
        <button className="portal-button" disabled={busy||description.trim().length<15}><Send size={15}/>{busy?"جارٍ الإرسال...":"إرسال الطلب"}</button>
      </form>
      {error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}{notice&&<p role="status" style={{color:"#18745e"}}>{notice}</p>}
    </section>
    <section style={{marginTop:20}}>
      <div className="portal-section-title"><div><h2>طلباتي السابقة</h2><p>{items.length} طلبات مسجلة</p></div></div>
      {loading?<div className="portal-empty">جارٍ تحميل الطلبات...</div>:<div style={{display:"grid",gap:10}}>
        {items.map(item=><article className="portal-card" key={item.requestId}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}><strong>{types.find(t=>t[0]===item.requestType)?.[1]||item.requestType}</strong><span className="portal-chip">{labels[item.status]||item.status}</span></div>
          <p>{item.description}</p><small>تاريخ الاستلام: {fmt(item.receivedAt)} · موعد الاستجابة المستهدف: {fmt(item.dueAt)}</small>
          {item.extensionCount===1&&<p style={{fontSize:12,color:"#916b36"}}>تم تسجيل تمديد لمرة واحدة: {item.adminNote||"يرجى مراجعة فريق المنصة للمزيد من التفاصيل."}</p>}
          {item.adminNote&&<p style={{fontSize:12,color:"#6d7d86"}}>ملاحظة الإدارة: {item.adminNote}</p>}
        </article>)}
        {!items.length&&<div className="portal-empty">لا توجد طلبات خصوصية مسجلة لحسابك بعد.</div>}
      </div>}
    </section>
  </PlatformLayout>;
}
