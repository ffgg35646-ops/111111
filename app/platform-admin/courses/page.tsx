"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Plus, RefreshCw, Save, UserRoundCog } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Course = { id:string; title:string; category:string; mode:string; duration:string; lessonCount:number; trainerId:string|null; trainerName:string|null; assignedAt:string|null };
type Trainer = { userId:string; name:string; email:string };

export default function AdminCoursesPage() {
  const [courses,setCourses]=useState<Course[]>([]);
  const [trainers,setTrainers]=useState<Trainer[]>([]);
  const [drafts,setDrafts]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function load() {
    setError("");
    const response=await fetch("/api/platform/admin/courses",{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"تعذر تحميل الدورات.");
    setCourses(data.courses||[]);
    setTrainers(data.trainers||[]);
    setDrafts(Object.fromEntries((data.courses||[]).map((item:Course)=>[item.id,item.trainerId||""])));
  }
  useEffect(()=>{let active=true;fetch("/api/platform/admin/courses",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active){setCourses(d.courses||[]);setTrainers(d.trainers||[]);setDrafts(Object.fromEntries((d.courses||[]).map((item:Course)=>[item.id,item.trainerId||""])));}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"تعذر تحميل الدورات.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  async function save(course:Course) {
    setBusy(course.id);setError("");setNotice("");
    try {
      const response=await fetch("/api/platform/admin/courses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId:course.id,trainerId:drafts[course.id]||""})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"تعذر حفظ الإسناد.");
      setNotice(data.trainerName?"تم إسناد الدورة إلى "+data.trainerName+".":"تم إلغاء إسناد المدرب من الدورة.");
      await load();
    } catch(e) {setError(e instanceof Error?e.message:"تعذر حفظ الإسناد.");}
    finally {setBusy("")}
  }
  const mode=(value:string)=>value==="recorded"?"مسجلة":value==="live"?"مباشرة":"هجينة";
  return <PlatformLayout title="إدارة الدورات والبرامج" description="استعراض كتالوج الدورات وإسناد المدربين، وإنشاء محتوى الكورسات ودروس الفيديو الكبيرة.">
    <div className="portal-callout">يمكنك إنشاء كورس جديد ببياناته وسعره، ثم إضافة عدد غير محدود عملياً من الدروس، ولكل درس فيديو مستقل.</div>
    <div className="portal-section-title"><div><h2><BookOpen size={17}/> الدورات المسجلة</h2><p>{courses.length} دورة · {trainers.length} مدرب نشط</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link className="portal-link-button" href="/platform-admin/courses/editor"><Plus size={14}/> إضافة كورس جديد</Link><button className="portal-button secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> تحديث</button></div></div>
    {error&&<p role="alert" style={{color:"#a44",fontSize:11}}>{error}</p>}
    {notice&&<p role="status" className="portal-callout">{notice}</p>}
    {loading?<div className="portal-empty">جارٍ تحميل الدورات...</div>:<div style={{display:"grid",gap:10}}>
      {courses.map(course=><article className="portal-card" key={course.id}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div><span className="portal-chip">{course.category} · {mode(course.mode)}</span><h3>{course.title}</h3><p>{course.duration} · {course.lessonCount} وحدات</p></div>
          <Link className="portal-link-button secondary" href={"/academy/"+course.id}>معاينة صفحة التعلم</Link>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:9,marginTop:12,alignItems:"end"}}>
          <label style={{display:"grid",gap:6,fontSize:10,color:"#70828a"}}>المدرب المسؤول
            <select value={drafts[course.id]||""} onChange={e=>setDrafts(v=>({...v,[course.id]:e.target.value}))} style={{padding:10,border:"1px solid #dce5e9",borderRadius:8,background:"#fff",font:"inherit"}}>
              <option value="">بدون مدرب مسند</option>{trainers.map(t=><option value={t.userId} key={t.userId}>{t.name} · {t.email}</option>)}
            </select>
          </label>
          <button className="portal-button" disabled={busy===course.id||(drafts[course.id]||"")===(course.trainerId||"")} onClick={()=>void save(course)}>{busy===course.id?"جارٍ الحفظ...":<><Save size={14}/> حفظ الإسناد</>}</button>
        </div>
      </article>)}
      {!courses.length&&<div className="portal-empty">لا توجد دورات في الكتالوج.</div>}
    </div>}
    <div className="portal-callout" style={{marginTop:14}}><UserRoundCog size={15}/> لا يستطيع المدرب فتح بيانات المتدربين أو تعديل اختبارات الدورة إلا بعد إسنادها إلى حسابه. ويُسجل كل تغيير إسناد في سجل التدقيق.</div>
  </PlatformLayout>
}
