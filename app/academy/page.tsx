"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Brain, ClipboardList, Clock3, GraduationCap, PlayCircle, Video } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import PlatformRequestForm from "@/components/platform-request-form";
import { courses, learningTracks } from "@/lib/platform-catalog";

const modeLabels={recorded:"مسجلة",live:"مباشرة",hybrid:"مباشرة ومسجلة"};

export default function AcademyPage() {
  const [track,setTrack]=useState("all");
  const [mode,setMode]=useState("all");
  const [selectedCourse,setSelectedCourse]=useState<string|null>(null);
  const filtered=useMemo(()=>courses.filter(course=>(track==="all"||course.trackId===track)&&(mode==="all"||course.mode===mode)),[track,mode]);
  const chosen=courses.find(course=>course.id===selectedCourse);

  return <PlatformLayout title="الأكاديمية والمسارات التدريبية" description="برامج منظمة للتأهيل في الخدمة الاجتماعية والصحة النفسية وCBT والتوحد والاضطرابات النمائية، مع محتوى مسجل ولقاءات مباشرة.">
    <div className="portal-callout">التسجيل هنا يرسل طلب التحاق للمراجعة. فتح الدروس المسجلة وجدولة الفصول المباشرة وربط حساب المتدرب ولوحة المدرب تأتي ضمن تهيئة التشغيل المؤسسي.</div>
    <div className="portal-section-title"><div><h2>المسارات التخصصية</h2><p>اختر مجالاً لاستعراض البرامج ذات الصلة</p></div></div>
    <div className="portal-grid">
      {learningTracks.map(item=><article className="portal-card track-card" key={item.id}>
        <span className="track-icon"><GraduationCap size={18}/></span><h3>{item.title}</h3><p>{item.summary}</p>
        <div className="portal-chip-row">{item.skills.map(skill=><span className="portal-chip" key={skill}>{skill}</span>)}</div>
        <button className="portal-button secondary" onClick={()=>{setTrack(item.id);setSelectedCourse(null);}}>عرض دورات المسار</button>
      </article>)}
    </div>

    <div className="portal-section-title"><div><h2>الدورات والبرامج</h2><p>{filtered.length} برامج في الكتالوج التدريبي</p></div><Link className="portal-link-button secondary" href="/classrooms"><Video size={14}/> الفصول المباشرة</Link></div>
    <div className="portal-filter-row">
      <button className={track==="all"?"portal-filter active":"portal-filter"} onClick={()=>setTrack("all")}>كل المسارات</button>
      {learningTracks.map(item=><button key={item.id} className={track===item.id?"portal-filter active":"portal-filter"} onClick={()=>setTrack(item.id)}>{item.title}</button>)}
    </div>
    <div className="portal-filter-row">
      {(["all","recorded","live","hybrid"] as const).map(item=><button key={item} className={mode===item?"portal-filter active":"portal-filter"} onClick={()=>setMode(item)}>{item==="all"?"كل أنماط التعلم":modeLabels[item as keyof typeof modeLabels]??item}</button>)}
    </div>
    <div className="portal-grid">
      {filtered.map(course=><article className="portal-card course-card" key={course.id}>
        <div className="course-card-top"><span className={"course-mode "+course.mode}>{modeLabels[course.mode]}</span><small>{course.level}</small></div>
        <h3>{course.title}</h3><p>{course.summary}</p>
        <div className="course-meta"><span><Clock3 size={13}/>{course.duration}</span><span><BookOpen size={13}/>{course.lessons.length} وحدات</span></div>
        <button className="portal-button" onClick={()=>setSelectedCourse(course.id)}>تفاصيل وطلب الالتحاق</button>
      </article>)}
    </div>
    {chosen&&<section className="course-detail-panel">
      <div className="course-detail-head"><div><span className="portal-chip">{chosen.category}</span><h2>{chosen.title}</h2><p>{chosen.summary}</p></div><button onClick={()=>setSelectedCourse(null)} aria-label="إغلاق التفاصيل">×</button></div>
      <div className="course-detail-columns">
        <div><strong>نواتج التعلم</strong><ul>{chosen.outcomes.map(x=><li key={x}>{x}</li>)}</ul></div>
        <div><strong>الخطة التعليمية</strong><ol>{chosen.lessons.map(x=><li key={x}>{x}</li>)}</ol></div>
      </div>
      <PlatformRequestForm key={chosen.id} kind={chosen.mode==="recorded"?"course_enrollment":"classroom_registration"} title="طلب الالتحاق بالدورة" description="أدخل بيانات التواصل ليُراجع فريق التدريب طلبك." initialData={{courseId:chosen.id}} fields={chosen.mode==="recorded"?[]:[{name:"preferredAt",label:"الموعد المفضل للفصل المباشر",type:"datetime-local",required:true}]}/>
    </section>}
    <div className="portal-section-title"><div><h2>مختبر التطبيق العملي</h2><p>طبّق مهارات المقابلة وصياغة الحالة داخل غرفة افتراضية</p></div></div>
    <div className="portal-grid">
      <article className="portal-card"><Brain size={20} color="#188579"/><h3>محاكاة دراسة الحالة</h3><p>حالات اجتماعية ونفسية ونمائية افتراضية مع قرارات متدرجة وتغذية راجعة.</p><Link className="portal-link-button" href="/cases"><PlayCircle size={14}/> فتح الحالات</Link></article>
      <article className="portal-card"><ClipboardList size={20} color="#188579"/><h3>مختبر المقاييس</h3><p>تدريب على اختيار الأداة وفهم مجالاتها وقراءة النتائج وحدودها.</p><Link className="portal-link-button" href="/assessments">فتح مختبر المقاييس</Link></article>
      <article className="portal-card"><Video size={20} color="#188579"/><h3>التدريب المباشر عبر Zoom</h3><p>طلبات الالتحاق بالفصول ومتابعة إعداد جلسات Zoom.</p><Link className="portal-link-button" href="/classrooms">فتح الفصول</Link></article>
    </div>
  </PlatformLayout>;
}
