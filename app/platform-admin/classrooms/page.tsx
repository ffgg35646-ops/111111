"use client";
import {useEffect,useState,type FormEvent} from "react";
import {CalendarDays,Clock3,ExternalLink,Video,Users,RefreshCw,Archive,PlayCircle,UserCheck} from "lucide-react";
import {PlatformLayout} from "@/components/platform-layout";
import {courses} from "@/lib/platform-catalog";
type Session={sessionId:string;courseId:string;courseTitle:string;topic:string;startTime:string;durationMinutes:number;timezone:string;status:string;joinUrl?:string;hostStartUrl?:string;recordingAllowed:boolean;recordingStatus?:string;recordingUrl?:string};
type Person={userId:string;name:string;email:string;status:string;markedAt?:string|null};
const liveCourses=courses.filter(c=>c.mode!=="recorded");
const emptyForm={courseId:liveCourses[0]?.id||"",topic:"",startTime:"",durationMinutes:"90",recordingAllowed:false,recordingConsentConfirmed:false};
export default function ClassroomsAdminPage(){
 const [sessions,setSessions]=useState<Session[]>([]),[form,setForm]=useState(emptyForm),[people,setPeople]=useState<Person[]>([]),[selected,setSelected]=useState(""),[busy,setBusy]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function reload(){const r=await fetch("/api/classrooms/sessions",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل الجلسات.");setSessions(d.sessions||[]);}
 useEffect(()=>{let active=true;fetch("/api/classrooms/sessions",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setSessions(d.sessions||[])}).catch(e=>{if(active)setError(e.message||"تعذر تحميل الجلسات")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 async function create(e:FormEvent){e.preventDefault();setBusy("create");setError("");setNotice("");try{if(!form.startTime)throw new Error("حدد موعد الجلسة.");const r=await fetch("/api/classrooms/sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,startTime:new Date(form.startTime).toISOString(),durationMinutes:Number(form.durationMinutes)})});const d=await r.json();if(!r.ok)throw new Error(d.error);setNotice("تم إنشاء جلسة Zoom وحفظ رابط الحضور للمسجلين المعتمدين.");setForm(emptyForm);await reload()}catch(e){setError(e instanceof Error?e.message:"تعذر إنشاء الجلسة.")}finally{setBusy("")}}
 async function loadRoster(sessionId:string){setSelected(sessionId);setPeople([]);setError("");try{const r=await fetch("/api/classrooms/attendance?sessionId="+encodeURIComponent(sessionId),{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setPeople(d.roster||[])}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل كشف الحضور.")}}
 async function mark(userId:string,status:"attended"|"absent"|"late"|"excused"){setBusy(userId);setError("");try{const r=await fetch("/api/classrooms/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:selected,userId,status})});const d=await r.json();if(!r.ok)throw new Error(d.error);setNotice("تم حفظ حالة الحضور.");await loadRoster(selected)}catch(e){setError(e instanceof Error?e.message:"تعذر حفظ الحضور.")}finally{setBusy("")}}
 async function action(session:Session,kind:"cancel"|"publish_recording"){if(kind==="cancel"&&!window.confirm("تأكيد إلغاء الجلسة واجتماع Zoom؟"))return;setBusy(session.sessionId);setError("");setNotice("");try{const r=await fetch("/api/classrooms/sessions",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:session.sessionId,action:kind})});const d=await r.json();if(!r.ok)throw new Error(d.error);setNotice(kind==="cancel"?"تم إلغاء الجلسة.":"تم نشر تسجيل المحاضرة للمسجلين المعتمدين.");await reload()}catch(e){setError(e instanceof Error?e.message:"تعذر تنفيذ الإجراء.")}finally{setBusy("")}}
 const statusName=(s:string)=>s==="scheduled"?"مجدولة":s==="completed"?"مكتملة":s==="cancelled"?"ملغاة":s;
 const attendanceName=(s:string)=>s==="attended"?"حاضر":s==="absent"?"غائب":s==="late"?"متأخر":s==="excused"?"بعذر":"لم يسجل";
 return <PlatformLayout title="قاعة التدريب المباشر" description="جدولة الفصول المشتركة وإنشاء اجتماعات Zoom وإدارة الحضور والتسجيلات للمشاركين المعتمدين.">
  <section className="portal-card" style={{marginBottom:18}}>
   <div className="portal-section-title"><div><h2><Video size={18}/> جدولة جلسة جديدة</h2><p>يتم إنشاء اجتماع مركزي واحد للدورة، وليس اجتماعاً منفصلاً لكل متدرب.</p></div></div>
   <form onSubmit={create} style={{display:"grid",gap:10}}>
    <label style={{display:"grid",gap:5}}>الدورة التدريبية<select required value={form.courseId} onChange={e=>setForm(v=>({...v,courseId:e.target.value}))} style={{padding:11,border:"1px solid #dce5e9",borderRadius:8}}>{liveCourses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
    <label style={{display:"grid",gap:5}}>عنوان الجلسة<input value={form.topic} maxLength={180} onChange={e=>setForm(v=>({...v,topic:e.target.value}))} placeholder="اتركه فارغاً لاستخدام اسم الدورة" style={{padding:11,border:"1px solid #dce5e9",borderRadius:8}}/></label>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
     <label style={{display:"grid",gap:5}}>تاريخ ووقت البداية<input type="datetime-local" required value={form.startTime} onChange={e=>setForm(v=>({...v,startTime:e.target.value}))} style={{padding:11,border:"1px solid #dce5e9",borderRadius:8}}/></label>
     <label style={{display:"grid",gap:5}}>المدة بالدقائق<input type="number" min="15" max="480" step="15" required value={form.durationMinutes} onChange={e=>setForm(v=>({...v,durationMinutes:e.target.value}))} style={{padding:11,border:"1px solid #dce5e9",borderRadius:8}}/></label>
    </div>
    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:12}}><input type="checkbox" checked={form.recordingAllowed} onChange={e=>setForm(v=>({...v,recordingAllowed:e.target.checked,recordingConsentConfirmed:false}))}/> السماح بالتسجيل السحابي للمحاضرة</label>
    {form.recordingAllowed&&<label style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:11,lineHeight:1.8}}><input type="checkbox" checked={form.recordingConsentConfirmed} onChange={e=>setForm(v=>({...v,recordingConsentConfirmed:e.target.checked}))}/> أؤكد إبلاغ جميع المشاركين بأن المحاضرة ستُسجل والحصول على موافقتهم قبل بدء التسجيل.</label>}
    <button className="portal-button" disabled={busy==="create"||(form.recordingAllowed&&!form.recordingConsentConfirmed)}><Video size={14}/>{busy==="create"?"جارٍ إنشاء اجتماع Zoom...":"إنشاء الجلسة وجدولتها"}</button>
   </form>
  </section>
  {error&&<p role="alert" style={{color:"#a64f4f",fontSize:12}}>{error}</p>}{notice&&<p role="status" className="portal-callout">{notice}</p>}
  <div className="portal-section-title"><div><h2>الجلسات المجدولة</h2><p>{sessions.length} جلسة محفوظة</p></div><button className="portal-button secondary" disabled={loading} onClick={()=>reload().catch(e=>setError(e.message))}><RefreshCw size={14}/> تحديث</button></div>
  {loading&&<div className="portal-empty">جارٍ تحميل الجلسات...</div>}
  {!loading&&sessions.length===0&&<div className="portal-empty">لا توجد جلسات مجدولة حتى الآن.</div>}
  <div style={{display:"grid",gap:12}}>{sessions.map(s=><article className="portal-card" key={s.sessionId}>
   <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><span className="portal-chip">{s.courseTitle} · {statusName(s.status)}</span><h3>{s.topic}</h3><p><CalendarDays size={14}/> {new Date(s.startTime).toLocaleString("ar-EG",{dateStyle:"full",timeStyle:"short"})} · <Clock3 size={14}/> {s.durationMinutes} دقيقة</p></div><div style={{display:"grid",gap:6,alignContent:"start"}}>{s.recordingAllowed?<span className="portal-chip">التسجيل مسموح</span>:<span className="portal-chip">دون تسجيل</span>}{s.recordingStatus&&<small>{s.recordingStatus==="published"?"التسجيل منشور":s.recordingStatus==="awaiting_recording"?"بانتظار التسجيل":"غير مفعّل"}</small>}</div></div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
    {s.hostStartUrl&&<a className="portal-button secondary" href={s.hostStartUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> بدء الاجتماع للمضيف</a>}
    <button className="portal-button secondary" onClick={()=>void loadRoster(s.sessionId)}><Users size={14}/> كشف الحضور</button>
    {s.recordingAllowed&&s.status!=="cancelled"&&s.recordingStatus!=="published"&&<button className="portal-button secondary" disabled={busy===s.sessionId} onClick={()=>void action(s,"publish_recording")}><PlayCircle size={14}/> جلب التسجيل ونشره</button>}
    {s.status!=="cancelled"&&<button className="portal-button secondary" disabled={busy===s.sessionId} onClick={()=>void action(s,"cancel")}><Archive size={14}/> إلغاء الجلسة</button>}
    {s.recordingUrl&&<a className="portal-button secondary" href={s.recordingUrl} target="_blank" rel="noreferrer"><PlayCircle size={14}/> معاينة التسجيل</a>}
   </div>
  </article>)}</div>
  {selected&&<section className="portal-card" style={{marginTop:18}}>
   <div className="portal-section-title"><div><h2><UserCheck size={18}/> كشف الحضور</h2><p>{people.length} متدرباً مسجلاً ومعتمداً</p></div><button className="portal-button secondary" onClick={()=>{setSelected("");setPeople([])}}>إغلاق</button></div>
   {people.length===0?<div className="portal-empty">لا توجد تسجيلات معتمدة لهذه الدورة أو لا توجد حسابات نشطة مرتبطة بها.</div>:<div style={{display:"grid",gap:9}}>{people.map(p=><article key={p.userId} style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #edf1f2",padding:"9px 0"}}><div><strong>{p.name}</strong><p>{p.email}</p><span className="portal-chip">{attendanceName(p.status)}</span></div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{(["attended","late","absent","excused"] as const).map(st=><button key={st} className={st==="attended"?"portal-button":"portal-button secondary"} disabled={busy===p.userId} onClick={()=>void mark(p.userId,st)}>{attendanceName(st)}</button>)}</div></article>)}</div>}
  </section>}
  <div className="portal-callout" style={{marginTop:18}}>لا يظهر رابط الانضمام للمتدرب إلا بعد اعتماد طلب التحاقه وتأكيد الدفع. لا يتم تفعيل التسجيل السحابي إلا باختيار مسؤول الجلسة وتأكيد إبلاغ المشاركين وموافقتهم.</div>
 </PlatformLayout>;
}
