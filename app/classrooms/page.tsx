"use client";

import { useState } from "react";
import { BookOpen, Clock3, MonitorPlay, Video, MessageCircle, Hand, ClipboardCheck, Save } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import PlatformRequestForm from "@/components/platform-request-form";
import { courses } from "@/lib/platform-catalog";

export default function ClassroomsPage(){
  const liveCourses=courses.filter(course=>course.mode!=="recorded");
  const [selected,setSelected]=useState(liveCourses[0]?.id??"");
  const chosen=liveCourses.find(course=>course.id===selected);
  const [discussion,setDiscussion]=useState("");
  const [reflection,setReflection]=useState("");
  const [saved,setSaved]=useState(false);
  const [poll,setPoll]=useState("");
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
    <section className="portal-card classroom-interaction">
      <div className="portal-section-title"><div><h2><MessageCircle size={18}/> مساحة التفاعل والمشاركة</h2><p>أدوات تحضير ومتابعة ترافق اجتماع Zoom المباشر.</p></div><Hand size={21}/></div>
      <div className="classroom-interaction-grid">
        <article><strong>قبل وأثناء اللقاء</strong><ul><li>ارفع يدك من أدوات Zoom لطلب المداخلة.</li><li>استخدم المحادثة لطرح سؤال مرتبط بمحور الدرس.</li><li>شارك الشاشة أو ملف الحالة عندما يسمح المدرب.</li><li>شارك في غرف النقاش الفرعية إذا فعّلها المضيف.</li></ul></article>
        <article><strong>سؤال النقاش</strong><p>ما الدليل الذي تحتاج إلى جمعه قبل الانتقال من الملاحظة إلى الفرضية؟</p><textarea value={discussion} onChange={event=>{setDiscussion(event.target.value);setSaved(false);}} rows={3} placeholder="اكتب سؤالك أو مداخلتك..."/></article>
        <article><strong>تحقق سريع من الفهم</strong><p>ما التصرف المهني عند ظهور نتيجة تحرٍّ إيجابية؟</p><div className="classroom-poll">{["اعتبارها تشخيصاً نهائياً","استكمال التقييم وفق الدليل والسياق","تجاهلها تماماً"].map((choice,index)=><label key={choice}><input type="radio" name="classroom-poll" checked={poll===String(index)} onChange={()=>setPoll(String(index))}/>{choice}</label>)}</div></article>
        <article><strong>ملاحظات ما بعد الفصل</strong><textarea value={reflection} onChange={event=>{setReflection(event.target.value);setSaved(false);}} rows={3} placeholder="ما أهم فكرة تعلمتها؟ وما السؤال الذي تريد مناقشته؟"/><button className="portal-button secondary" onClick={()=>{localStorage.setItem("clinical-classroom-reflection:"+selected,JSON.stringify({discussion,reflection,poll,updatedAt:new Date().toISOString()}));setSaved(true);}}><Save size={14}/> حفظ الملاحظات على هذا الجهاز</button>{saved&&<small>تم حفظ ملاحظاتك محلياً.</small>}</article>
      </div>
      <div className="portal-callout"><Video size={15}/> الصوت والصورة والمحادثة الحية تتم داخل اجتماع Zoom الذي يرسله المنسق بعد اعتماد الطلب. هذه المساحة تحفظ ملاحظات المتدرب على جهازه ولا تمثل محادثة جماعية متزامنة.</div>
    </section>
    <div className="portal-section-title"><div><h2>كيف يعمل الفصل المباشر؟</h2><p>خطوات الحضور من التسجيل إلى الشهادة</p></div></div>
    <div className="portal-grid classroom-steps">
      {[["01","إرسال طلب الالتحاق","تحديد البرنامج والموعد المفضل."],["02","مراجعة وتأكيد الحجز","يتحقق المنسق من المقاعد وجدول المدرب."],["03","استلام رابط Zoom","يرسل رابط الانضمام بعد إنشاء الاجتماع المؤسسي."],["04","الحضور والتفاعل","مشاركة الشاشة والمواد والنقاش مع المدرب."],["05","اعتماد الإتمام","تراجع الإدارة الحضور والمتطلبات قبل إصدار الشهادة."]].map(([number,title,description])=><article className="portal-card" key={number}><b className="step-number">{number}</b><h3>{title}</h3><p>{description}</p></article>)}
    </div>
  </PlatformLayout>;
}
