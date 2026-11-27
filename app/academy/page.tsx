"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Brain, ClipboardList, Clock3, GraduationCap, PlayCircle, Video } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { courses, learningTracks, type Course } from "@/lib/platform-catalog";

const modeLabels={recorded:"مسجلة",live:"مباشرة",hybrid:"مباشرة ومسجلة"};
type PublishedCourse = { id:string; title:string; summary:string; trackId:string; category:string; mode:"recorded"|"live"|"hybrid"; contentType?:"course"|"program"; level:string; duration:string; outcomes:string[]; lessons:{id:string;title:string;videoReady:boolean}[]; price:number };
type AcademyCourse = Course & { contentType:"course"|"program"; price?:number; currency?:string };

function AcademyWorkspace() {
  const params = useSearchParams();
  const requestedTrack = params.get("track");
  const [availableTracks,setAvailableTracks]=useState(learningTracks);
  const [track,setTrack]=useState(() => requestedTrack || "all");
  const [mode,setMode]=useState("all");
  const [contentType,setContentType]=useState<"all"|"course"|"program">("all");
  const [coursePrices,setCoursePrices]=useState<Record<string,number>>({});
  const [publishedCourses,setPublishedCourses]=useState<PublishedCourse[]>([]);
  useEffect(()=>{let active=true;fetch("/api/specialist-tracks",{cache:"no-store"}).then(async response=>{const data=await response.json();if(response.ok&&active&&Array.isArray(data.tracks)){const rows=data.tracks.map((item:{id:string;title:string;summary:string;accent?:string;skills?:string[]})=>({id:item.id,title:item.title,summary:item.summary,accent:item.accent||"teal",skills:Array.isArray(item.skills)?item.skills:[]}));setAvailableTracks(rows);if(requestedTrack&&rows.some((item:{id:string})=>item.id===requestedTrack))setTrack(requestedTrack);else if(requestedTrack)setTrack("all");}}).catch(error=>console.error("ETZAN specialist track catalog unavailable",error));return()=>{active=false}},[requestedTrack]);
  useEffect(()=>{let active=true;fetch("/api/platform/commerce/course-prices",{cache:"no-store"}).then(async response=>{const data=await response.json();if(response.ok&&active){const next:Record<string,number>={};for(const item of data.courses||[]){if(item.active===true&&typeof item.price==="number")next[item.courseId]=item.price;}setCoursePrices(next);}}).catch(error=>console.error("ETZAN course prices unavailable",error));fetch("/api/academy/courses",{cache:"no-store"}).then(async response=>{const data=await response.json();if(response.ok&&active){const rows=Array.isArray(data.courses)?data.courses:[];setPublishedCourses(rows);}}).catch(error=>console.error("Published ETZAN courses unavailable",error));return()=>{active=false}},[]);
  const allCourses=useMemo<AcademyCourse[]>(()=>[...courses.map(item=>({...item,contentType:"course" as const})),...publishedCourses.map(item=>({...item,contentType:item.contentType==="program"?"program" as const:"course" as const,lessons:item.lessons.map(lesson=>lesson.title)}))],[publishedCourses]);
  const filtered=useMemo(()=>allCourses.filter(course=>(track==="all"||course.trackId===track)&&(mode==="all"||course.mode===mode)&&(contentType==="all"||(course.contentType||"course")===contentType)),[allCourses,track,mode,contentType]);

  return <PlatformLayout title="الأكاديمية والمسارات التدريبية" description="برامج منظمة في الخدمة الاجتماعية وعلم النفس وCBT والإرشاد الأسري والاضطرابات النمائية والتوحد والقياس النفسي والممارسة الإكلينيكية والتطوير المهني.">
    <div className="portal-callout">اختر دورة لفتح وحداتها التعليمية والأنشطة القصيرة واختبار الفهم. تسجيلات الفيديو تظهر عند إضافة رابط التسجيل المعتمد لكل دورة، أما الفصول المباشرة فتُنسق عبر Zoom بعد اعتماد طلب الالتحاق.</div>
    <div className="portal-section-title"><div><h2>المسارات التخصصية</h2><p>اختر مجالاً لاستعراض البرامج ذات الصلة</p></div></div>
    <div className="portal-grid">
      {availableTracks.map(item=><article className="portal-card track-card" key={item.id}>
        <span className="track-icon"><GraduationCap size={18}/></span><h3>{item.title}</h3><p>{item.summary}</p>
        <div className="portal-chip-row">{item.skills.map(skill=><span className="portal-chip" key={skill}>{skill}</span>)}</div>
        <button className="portal-button secondary" onClick={()=>setTrack(item.id)>عرض دورات المسار</button>
      </article>)}
    </div>

    <div className="portal-section-title"><div><h2>الدورات والبرامج</h2><p>{filtered.length} عنصر في الكتالوج · اختر النوع والمسار ونمط التدريب</p></div><Link className="portal-link-button secondary" href="/classrooms"><Video size={14}/> الفصول المباشرة</Link></div>
    <div className="portal-filter-row">
      <button className={track==="all"?"portal-filter active":"portal-filter"} onClick={()=>setTrack("all")}>كل المسارات</button>
      {availableTracks.map(item=><button key={item.id} className={track===item.id?"portal-filter active":"portal-filter"} onClick={()=>setTrack(item.id)}>{item.title}</button>)}
    </div>
    <div className="portal-filter-row">
      {(["all","recorded","live","hybrid"] as const).map(item=><button key={item} className={mode===item?"portal-filter active":"portal-filter"} onClick={()=>setMode(item)}>{item==="all"?"كل أنماط التعلم":modeLabels[item as keyof typeof modeLabels]??item}</button>)}
    </div>
    <div className="portal-filter-row" aria-label="تصنيف المحتوى">
      <button className={contentType==="all"?"portal-filter active":"portal-filter"} onClick={()=>setContentType("all")}>كل المحتوى</button>
      <button className={contentType==="course"?"portal-filter active":"portal-filter"} onClick={()=>setContentType("course")}>الدورات التدريبية</button>
      <button className={contentType==="program"?"portal-filter active":"portal-filter"} onClick={()=>setContentType("program")}>البرامج التدريبية</button>
    </div>
    <div className="portal-grid">
      {filtered.map(course=><article className="portal-card course-card" key={course.id}>
        <div className="course-card-top"><span className={"course-mode "+course.mode}>{modeLabels[course.mode]}</span><small>{course.contentType === "program" ? "برنامج تدريبي" : course.level}</small></div>
        <h3>{course.title}</h3><p>{course.summary}</p>
        <div className="course-meta"><span><Clock3 size={13}/>{course.duration}</span><span><BookOpen size={13}/>{course.lessons.length} دروس</span></div>
        <div className="course-card-actions" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginTop:14}}>
          <Link className="portal-button" href={"/academy/"+course.id+"/details"}>تفاصيل الكورس</Link>
          <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
            <strong style={{fontSize:12,color:"#147f76"}}>{typeof coursePrices[course.id]==="number"?coursePrices[course.id].toFixed(2)+" SAR":"يحدد بعد مراجعة الطلب"}</strong>
            <Link className="portal-button secondary" href={"/login?next="+encodeURIComponent("/academy/"+course.id+"/request")}>اشترك الآن</Link>
          </div>
        </div>
      </article>)}
    </div>

    <div className="portal-section-title"><div><h2>مختبر التطبيق العملي</h2><p>طبّق مهارات المقابلة وصياغة الحالة داخل غرفة افتراضية</p></div></div>
    <div className="portal-grid">
      <article className="portal-card"><Brain size={20} color="#188579"/><h3>محاكاة دراسة الحالة</h3><p>حالات اجتماعية ونفسية ونمائية افتراضية مع قرارات متدرجة وتغذية راجعة.</p><Link className="portal-link-button" href="/cases"><PlayCircle size={14}/> فتح الحالات</Link></article>
      <article className="portal-card"><ClipboardList size={20} color="#188579"/><h3>مختبر المقاييس</h3><p>تدريب على اختيار الأداة وفهم مجالاتها وقراءة النتائج وحدودها.</p><Link className="portal-link-button" href="/assessments">فتح مختبر المقاييس</Link></article>
      <article className="portal-card"><Video size={20} color="#188579"/><h3>التدريب المباشر عبر Zoom</h3><p>طلبات الالتحاق بالفصول ومتابعة إعداد جلسات Zoom.</p><Link className="portal-link-button" href="/classrooms">فتح الفصول</Link></article>
    </div>
  </PlatformLayout>;
}

export default function AcademyPage() {
  return <Suspense fallback={<div className="portal-grid" aria-busy="true">{[0,1,2,3].map((item)=><section className="portal-card" key={item}><div className="portal-skeleton" style={{width:42,height:42,borderRadius:11,marginBottom:14}}/><div className="portal-skeleton" style={{width:"60%",height:13,marginBottom:10}}/><div className="portal-skeleton" style={{width:"90%",height:9,marginBottom:7}}/><div className="portal-skeleton" style={{width:"72%",height:9}}/></section>)}</div>}><AcademyWorkspace /></Suspense>;
}
