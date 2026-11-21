"use client";

import { useState } from "react";
import { BookOpen, Clock3, MonitorPlay, Video } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import PlatformRequestForm from "@/components/platform-request-form";
import { courses } from "@/lib/platform-catalog";

export default function ClassroomsPage(){
  const liveCourses=courses.filter(course=>course.mode!=="recorded");
  const [selected,setSelected]=useState(liveCourses[0]?.id??"");
  const chosen=liveCourses.find(course=>course.id===selected);
  return <PlatformLayout title="الفصول الافتراضية والدورات المباشرة" description="مساحة طلب الالتحاق باللقاءات المباشرة والدورات الهجينة، مع ربط جلسات التدريب والاجتماعات بمنصة Zoom.">
    <div className="portal-callout"><Video size={16}/> يتم تجهيز اجتماع Zoom بعد اعتماد الطلب وتحديد المدرب والموعد. لن يظهر رابط اجتماع فعلي قبل ربط حساب Zoom المؤسسي واعتماد الجدول.</div>
    <div className="portal-section-title"><div><h2>البرامج التي تتضمن لقاءات مباشرة</h2><p>اختر البرنامج لتقديم طلب حضور</p></div></div>
    <div className="portal-grid">
      {liveCourses.map(course=><article className="portal-card" key={course.id}>
        <span className="course-mode live">{course.mode==="hybrid"?"مباشر ومسجل":"لقاءات مباشرة"}</span><h3>{course.title}</h3><p>{course.summary}</p>
        <div className="course-meta"><span><Clock3 size={13}/>{course.duration}</span><span><BookOpen size={13}/>{course.lessons.length} محاور</span></div>
        <button className="portal-button secondary" onClick={()=>setSelected(course.id)}>اختيار الفصل</button>
      </article>)}
    </div>
    {chosen&&<section className="classroom-register">
      <div className="portal-section-title"><div><h2>طلب حضور: {chosen.title}</h2><p>يسجل الطلب في قائمة انتظار التنسيق.</p></div><MonitorPlay size={21}/></div>
      <PlatformRequestForm key={chosen.id} kind="classroom_registration" title="بيانات الالتحاق بالفصل" initialData={{courseId:chosen.id}} fields={[
        {name:"preferredAt",label:"الموعد المناسب لك",type:"datetime-local",required:true},
        {name:"requestNote",label:"ملاحظات تنظيمية (اختياري)",type:"textarea",placeholder:"اكتب ما يتعلق بترتيبات حضورك فقط."},
      ]} submitLabel="طلب الانضمام للفصل"/>
    </section>}
    <div className="portal-section-title"><div><h2>كيف يعمل الفصل المباشر؟</h2><p>خطوات الحضور من التسجيل إلى الشهادة</p></div></div>
    <div className="portal-grid classroom-steps">
      {[["01","إرسال طلب الالتحاق","تحديد البرنامج والموعد المفضل."],["02","مراجعة وتأكيد الحجز","يتحقق المنسق من المقاعد وجدول المدرب."],["03","استلام رابط Zoom","يرسل رابط الانضمام بعد إنشاء الاجتماع المؤسسي."],["04","الحضور والتفاعل","مشاركة الشاشة والمواد والنقاش مع المدرب."],["05","اعتماد الإتمام","تراجع الإدارة الحضور والمتطلبات قبل إصدار الشهادة."]].map(([number,title,description])=><article className="portal-card" key={number}><b className="step-number">{number}</b><h3>{title}</h3><p>{description}</p></article>)}
    </div>
  </PlatformLayout>;
}
