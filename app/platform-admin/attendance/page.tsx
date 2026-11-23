"use client";
import {useEffect,useState} from "react";
import {PlatformLayout} from "@/components/platform-layout";
import {courses} from "@/lib/platform-catalog";
type Person={userId:string;name:string;email:string;status:string};
export default function AttendanceAdminPage(){
 const eligible=courses.filter(c=>c.mode!=="recorded");
 const [courseId,setCourseId]=useState(eligible[0]?.id||"");
 const [people,setPeople]=useState<Person[]>([]);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function load(){if(!courseId)return;const r=await fetch("/api/platform/attendance?courseId="+encodeURIComponent(courseId),{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setPeople(d.roster||[])}
 useEffect(()=>{let live=true;fetch("/api/platform/attendance?courseId="+encodeURIComponent(courseId),{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(live)setPeople(d.roster||[])}).catch(e=>{if(live)setError(e.message||"تعذر تحميل الحضور")});return()=>{live=false}},[courseId]);
 async function mark(userId:string,status:"attended"|"absent"){setBusy(userId);setError("");setNotice("");try{const r=await fetch("/api/platform/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId,userId,status})});const d=await r.json();if(!r.ok)throw new Error(d.error);setNotice("تم حفظ حالة الحضور.");await load()}catch(e){setError(e instanceof Error?e.message:"تعذر حفظ الحضور")}finally{setBusy("")}}
 return <PlatformLayout title="إدارة الحضور" description="اعتماد حضور المتدربين المسجلين في الفصول المباشرة والهجينة. يعتمد إصدار شهادة الدورة المباشرة على تسجيل الحضور هنا.">
 <section className="portal-card"><label style={{display:"grid",gap:8}}>الدورة<select value={courseId} onChange={e=>setCourseId(e.target.value)} style={{padding:11,border:"1px solid #dce5e9",borderRadius:8}}>{eligible.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label></section>
 {error&&<p role="alert" style={{color:"#a33"}}>{error}</p>}{notice&&<p role="status" style={{color:"#18745e"}}>{notice}</p>}
 <div className="portal-section-title"><div><h2>قائمة المتدربين</h2><p>{people.length} تسجيلات معتمدة</p></div></div>
 <div style={{display:"grid",gap:10}}>{people.map(person=><article className="portal-card" key={person.userId} style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",flexWrap:"wrap"}}><div><strong>{person.name}</strong><p>{person.email}</p><span className="portal-chip">{person.status==="attended"?"حاضر":person.status==="absent"?"غائب":"لم يسجل"}</span></div><div style={{display:"flex",gap:8}}><button className="portal-button" disabled={busy===person.userId} onClick={()=>mark(person.userId,"attended")}>حاضر</button><button className="portal-button secondary" disabled={busy===person.userId} onClick={()=>mark(person.userId,"absent")}>غائب</button></div></article>)}</div>
 {people.length===0&&<div className="portal-empty">لا توجد طلبات حضور معتمدة مرتبطة بحسابات متدربين لهذه الدورة.</div>}
 </PlatformLayout>
}