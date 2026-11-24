"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Film, LockKeyhole, Save, Trash2 } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { courses } from "@/lib/platform-catalog";
type Media = { courseId: string; title: string; status: string; sourceHost: string; updatedAt?: string };
export default function ProtectedCourseMediaPage() {
  const [items,setItems]=useState<Media[]>([]),[courseId,setCourseId]=useState(courses[0]?.id||""),[title,setTitle]=useState(""),[sourceUrl,setSourceUrl]=useState(""),[status,setStatus]=useState("published");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  async function load(){const r=await fetch("/api/platform/course-media",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل الوسائط.");setItems(d.media||[]);}
  useEffect(()=>{let active=true;fetch("/api/platform/course-media",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.media||[])}).catch(e=>{if(active)setError(e.message||"تعذر تحميل الوسائط")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  async function save(event:FormEvent){event.preventDefault();setBusy(true);setError("");setNotice("");try{const r=await fetch("/api/platform/course-media",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId,title,sourceUrl,status})});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر حفظ الفيديو.");setNotice("تم حفظ المصدر في التخزين المحمي، ولا يظهر رابطه للمتدرب.");setTitle("");setSourceUrl("");await load()}catch(e){setError(e instanceof Error?e.message:"تعذر حفظ الفيديو.")}finally{setBusy(false)}}
  async function disable(id:string){if(!window.confirm("تعطيل فيديو هذه الدورة؟"))return;setBusy(true);setError("");setNotice("");try{const r=await fetch("/api/platform/course-media",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId:id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تعطيل الفيديو.");setNotice("تم تعطيل الفيديو.");await load()}catch(e){setError(e instanceof Error?e.message:"تعذر تعطيل الفيديو.")}finally{setBusy(false)}}
  return <PlatformLayout title="الفيديوهات المحمية" description="إدارة فيديوهات الدورات بمصادر خاصة على نطاقات موثوقة، مع بث عبر الخادم والتحقق من الالتحاق عند كل طلب تشغيل أو انتقال زمني.">
    <div className="portal-callout"><LockKeyhole size={16}/> لا تضع رابط الفيديو في كود الواجهة أو في متغير NEXT_PUBLIC. أضف نطاق التخزين إلى ETZAN_VIDEO_ALLOWED_HOSTS في إعدادات الاستضافة.</div>
    <section className="portal-card" style={{marginTop:16}}><div className="portal-section-title"><div><h2><Film size={18}/> إضافة أو تحديث فيديو دورة</h2><p>يدعم ملفات MP4 وWebM عبر HTTPS من نطاق مسموح.</p></div></div>
      <form onSubmit={save} style={{display:"grid",gap:12}}>
        <label style={{display:"grid",gap:6}}>الدورة<select value={courseId} onChange={e=>setCourseId(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label style={{display:"grid",gap:6}}>عنوان الفيديو<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="تسجيل الدورة أو المادة التعليمية"/></label>
        <label style={{display:"grid",gap:6}}>رابط التخزين الخاص (HTTPS)<input required type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} placeholder="https://media.example.sa/course.mp4"/></label>
        <label style={{display:"grid",gap:6}}>حالة النشر<select value={status} onChange={e=>setStatus(e.target.value)}><option value="published">منشور</option><option value="draft">مسودة</option></select></label>
        <button className="portal-button" disabled={busy||!courseId}><Save size={15}/>{busy?"جارٍ الحفظ...":"حفظ الفيديو المحمي"}</button>
      </form>{error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}{notice&&<p role="status" style={{color:"#18745e"}}>{notice}</p>}
    </section>
    <section style={{marginTop:20}}><div className="portal-section-title"><div><h2>وسائط الدورات الحالية</h2><p>روابط المصدر الكاملة لا تُعرض للمتدرب أو في قائمة الإدارة.</p></div></div>
      {loading?<div className="portal-empty">جارٍ التحميل...</div>:<div style={{display:"grid",gap:9}}>{items.map(item=><article className="portal-card" key={item.courseId} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <div><strong>{courses.find(c=>c.id===item.courseId)?.title||item.courseId}</strong><p style={{margin:"4px 0",fontSize:12,color:"#77878f"}}>{item.title} · {item.sourceHost} · {item.status==="published"?"منشور":item.status}</p></div>
        {item.status==="published"&&<button className="portal-button secondary" disabled={busy} onClick={()=>void disable(item.courseId)}><Trash2 size={14}/> تعطيل الفيديو</button>}
      </article>)}{!items.length&&<div className="portal-empty">لم تتم إضافة فيديوهات للدورات بعد.</div>}</div>}
    </section>
  </PlatformLayout>;
}
