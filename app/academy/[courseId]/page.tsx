"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ChevronLeft, CirclePlay, ClipboardCheck, GraduationCap, LockKeyhole, Video } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import PlatformRequestForm from "@/components/platform-request-form";
import { courses } from "@/lib/platform-catalog";
import { platformQuizByTrack, type PlatformQuizQuestion } from "@/lib/platform-quizzes";
import { ProtectedCourseVideo } from "@/components/protected-course-video";
import { BunnyLessonPlayer } from "@/components/bunny-lesson-player";
import "./learning.css";

type Guide = { intro: string; points: string[]; exercise: string };
const guideByTrack: Record<string, Guide[]> = {
  "social-work": [
    { intro:"ابدأ ببناء علاقة مهنية واضحة، واشرح هدف المقابلة وحدود السرية واطلب الموافقة قبل جمع المعلومات.", points:["استخدم أسئلة مفتوحة ثم أسئلة توضيحية محايدة.","اسأل الشخص عن أولوياته وما يريد تغييره.","افصل بين ما قاله المصدر وما لاحظته بنفسك وما استنتجته."], exercise:"اكتب ثلاثة أسئلة مفتوحة تساعدك على فهم المشكلة من منظور صاحب الحالة." },
    { intro:"ضع المعلومات داخل سياقها الاجتماعي والبيئي بدلاً من تفسيرها بعامل واحد.", points:["راجع التاريخ الأسري والتعليمي والمهني والصحي ذي الصلة.","ارسم شبكة العلاقات والخدمات والموارد.","وثق العوائق والتيسيرات والاختلافات بين البيئات."], exercise:"أنشئ خريطة مختصرة للأسرة والمدرسة والخدمات وشبكة الدعم في حالة افتراضية." },
    { intro:"وازن بين عوامل الخطورة والحماية، ولا تحول المؤشر المنفرد إلى حكم نهائي.", points:["تحقق من مصدر المعلومة وحداثتها.","استكشف السلامة بصورة مباشرة ومحترمة عند الحاجة.","اتبع بروتوكول المؤسسة عند وجود خطر أو واجب إبلاغ."], exercise:"اكتب عاملين للحماية وعاملين يحتاجان إلى استيضاح، مع مصدر كل معلومة." },
    { intro:"حوّل التقدير إلى خطة مشتركة محددة وقابلة للمتابعة.", points:["صغ هدفاً واضحاً يهم الشخص والأسرة.","حدد المسؤوليات والموارد والخدمات والإحالات.","ضع موعد مراجعة ومؤشراً وظيفياً للتقدم."], exercise:"اكتب هدفاً قصير المدى ومؤشر متابعة وموعد مراجعة." }
  ],
  cbt: [
    { intro:"العلاقة التعاونية والاتفاق على هدف واضح أساس للعمل المعرفي السلوكي.", points:["اشرح النموذج بلغة بسيطة دون فرض تفسير.","حدد هدفاً قابلاً للملاحظة والقياس.","راجع توقعات الشخص وموافقته وحدود دورك."], exercise:"صغ هدفاً تدريبياً محدداً يمكن مراجعته في نهاية اللقاء." },
    { intro:"يساعد نموذج الموقف والفكرة والانفعال والاستجابة على تنظيم الخبرة دون افتراض أن الفكرة حقيقة.", points:["حدد الموقف والسياق.","اكتب الفكرة التلقائية كما وردت.","اربطها بالانفعال والاستجابة الجسدية والسلوك."], exercise:"املأ مثالاً افتراضياً يوضح الموقف والفكرة والانفعال والسلوك." },
    { intro:"افحص الفكرة بطريقة تعاونية ومتوازنة، ولا تستبدلها بتفاؤل قسري.", points:["ما الأدلة المؤيدة؟ وما الأدلة التي لا تتفق معها؟","ما تفسير بديل معقول؟","ما أثر كل تفسير على الشعور والسلوك؟"], exercise:"اكتب سؤالين سقراطيين يساعدان على فحص فكرة تلقائية." },
    { intro:"تُبنى التجربة السلوكية تدريجياً وبموافقة الشخص، ثم تراجع النتائج دون أحكام.", points:["حدد توقعاً قابلاً للاختبار.","اختر خطوة آمنة ومتدرجة.","قارن التوقع بما حدث وما تعلمه الشخص."], exercise:"اقترح تجربة صغيرة اختيارية ومؤشر متابعة، دون تقديم وعد علاجي." }
  ],
  autism: [
    { intro:"ابدأ بالتعرف على الشخص ونقاط قوته وطريقة تواصله المفضلة.", points:["استخدم لغة واضحة ووقت معالجة كافياً.","اعرض خيارات بصرية أو وسيلة التواصل المناسبة.","خاطب الشخص مباشرة ولا تختزله في تشخيص."], exercise:"اكتب تهيئتين للتواصل تحترمان تفضيلات شخص افتراضي." },
    { intro:"افهم التواصل الاجتماعي في سياقه، مع مراعاة الاختلافات الفردية.", points:["اجمع أمثلة من أكثر من بيئة ومصدر.","لا تفترض أن التواصل البصري شرط للفهم أو المشاركة.","لاحظ المبادرة والاستجابة والوسائل البديلة للتواصل."], exercise:"صف مثالاً وظيفياً للتواصل دون تقييم الشخص على مظهره أو تواصله البصري." },
    { intro:"قد تؤثر الأصوات والإضاءة والملمس والانتقالات في الراحة والمشاركة.", points:["اسأل عن المثيرات التي تريح الشخص أو تزعجه.","اعرض خيارات مكان هادئ أو أدوات تنظيم آمنة.","لا تستخدم الإكراه أو منع وسائل التنظيم الذاتي الآمنة."], exercise:"ضع خطة تيسير حسّي من ثلاث خطوات لبيئة افتراضية." },
    { intro:"الدعم الفعال تشاركي وفردي ويركز على المشاركة وجودة الحياة.", points:["حدد هدفاً وظيفياً ذا معنى للشخص.","أشرك الأسرة والفريق بموافقة الشخص أو وليه حسب السياق.","راجع أثر التيسيرات وعدّل الخطة."], exercise:"اكتب هدف مشاركة فردياً ومؤشراً لمراجعته مع الأسرة." }
  ],
  developmental: [
    { intro:"التاريخ النمائي خط زمني يوضح اكتساب المهارات والتغيرات والفقد المحتمل.", points:["اسأل عن مراحل النمو ومصادر المعلومات.","استوضح أي فقد لمهارة مكتسبة وأحِل وفق البروتوكول.","راجع السمع والبصر والصحة واللغة وفرص التعلم."], exercise:"رتب خمسة أحداث نمائية افتراضية على خط زمني." },
    { intro:"الملاحظة تصف الأداء في سياق محدد ولا تفسر السبب بمفردها.", points:["استخدم وصفاً قابلاً للملاحظة بدلاً من الأوصاف العامة.","قارن الأداء بين المنزل والتعليم والمجتمع.","سجل الظروف التي تسهل الأداء أو تعوقه."], exercise:"حوّل حكماً عاماً مثل «لا يتعاون» إلى وصف سلوكي محدد." },
    { intro:"المهارات التكيفية تشمل مجالات مفاهيمية واجتماعية وعملية في الحياة اليومية.", points:["اجمع أمثلة عن التواصل والعناية الذاتية والتنقل والاختيار.","استكشف ما ينجزه الشخص باستقلال وما يحتاج فيه إلى دعم.","لا تختزل التقدير في درجة واحدة أو مصدر واحد."], exercise:"أنشئ جدولاً يميز المهارات المستقلة والمهارات التي تحتاج تيسيراً." },
    { intro:"يُكتب التقرير بلغة وصفية، وتُحدد المعلومات الناقصة ومسار الإحالة.", points:["افصل بين الوقائع والملاحظات والفرضيات.","تحقق من صلاحية الأداة وترخيصها وملاءمتها.","أحل التشخيص الرسمي إلى مختص وفريق مؤهل."], exercise:"اكتب فقرة تقرير تتضمن الدليل وحدوده والمعلومة التي تحتاج إلى استكمال." }
  ],
  "mental-health": [
    { intro:"المقابلة المهنية الآمنة تبدأ بتوضيح الدور والخصوصية والهدف.", points:["استخدم أسئلة مفتوحة ومحايدة.","استكشف بداية الأعراض ومدتها وتغيرها.","اسأل عن الأثر في العمل والعلاقات والنوم والأنشطة."], exercise:"اكتب أربعة أسئلة افتتاحية لا تفترض تشخيصاً." },
    { intro:"اجمع وصف الأعراض والسياق والعوامل الطبية والاجتماعية ذات الصلة.", points:["ميز التقرير الذاتي عن الملاحظة المباشرة.","استكشف الأدوية والمواد والنوم والصحة الجسدية عند الاختصاص.","اجمع معلومات متعددة بموافقة مناسبة."], exercise:"أنشئ جدولاً من عمودين: معلومة متاحة ومعلومة تحتاج إلى تحقق." },
    { intro:"تقييم السلامة ليس اختباراً شكلياً؛ اتبع بروتوكول المؤسسة والتصعيد البشري.", points:["تعرف على مؤشرات الخطر المباشر.","لا تترك حالة طارئة تعتمد على محاكاة أو روبوت.","استخدم مسارات الإحالة والطوارئ المحلية."], exercise:"حدد متى توقف المقابلة التدريبية وتطلب إشرافاً أو إحالة عاجلة." },
    { intro:"التشخيص الرسمي قرار مهني مخول يتطلب تقييماً شاملاً، وليس اختيار اسم من قائمة.", points:["كوّن فرضيات أولية قابلة للمراجعة.","افحص التفسيرات البديلة والمعلومات الناقصة.","وثق حدود التقييم وخطوة الإحالة المناسبة."], exercise:"اكتب فرضيتين بديلتين وما الدليل المطلوب للتمييز بينهما." }
  ]
};

export default function CourseLearningPage() {
  const params = useParams<{courseId:string}>();
  const router = useRouter();
  const staticCourse = courses.find(item=>item.id===params.courseId);
  const [dynamicCourse,setDynamicCourse] = useState<import("@/lib/platform-catalog").Course|null>(null);
  const [dynamicLessons,setDynamicLessons] = useState<{id:string;title:string;videoReady:boolean}[]>([]);
  const [dynamicLoading,setDynamicLoading] = useState(!staticCourse);
  const course = staticCourse || dynamicCourse;
  const [activeLesson,setActiveLesson] = useState(0);
  const [completed,setCompleted] = useState<number[]>([]);
  const [answers,setAnswers] = useState<Record<number,number>>({});
  const [checked,setChecked] = useState(false);
  const [hasProtectedRecording,setHasProtectedRecording] = useState(false);
  const [reflection,setReflection] = useState("");
  const [savedReflection,setSavedReflection] = useState(false);
  const [progressHydrated,setProgressHydrated] = useState(false);
  const [accessStatus,setAccessStatus] = useState<"checking"|"allowed"|"payment_required"|"login_required"|"error">("checking");
  const [issuedCertificate,setIssuedCertificate] = useState<{serial:string;status:string}|null>(null);
  const [completionMessage,setCompletionMessage] = useState("");
  const [progressSaveError,setProgressSaveError] = useState("");
  const [customQuiz,setCustomQuiz] = useState<PlatformQuizQuestion[]>([]);
  useEffect(()=>{
    if(staticCourse)return;
    let active=true;
    fetch("/api/academy/courses/"+encodeURIComponent(params.courseId),{cache:"no-store"})
      .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"الدورة غير موجودة.");return data.course;})
      .then(item=>{if(!active||!item)return;setDynamicLessons(Array.isArray(item.lessons)?item.lessons:[]);setDynamicCourse({id:item.id,title:item.title,trackId:item.trackId,category:item.category,mode:"recorded",level:item.level,duration:item.duration,summary:item.summary,outcomes:Array.isArray(item.outcomes)?item.outcomes:[],lessons:(item.lessons||[]).map((lesson:{title:string})=>lesson.title)});})
      .catch(()=>{if(active)setDynamicCourse(null);})
      .finally(()=>{if(active)setDynamicLoading(false);});
    return()=>{active=false};
  },[params.courseId,staticCourse]);
  const defaultQuiz = useMemo(()=>course?platformQuizByTrack[course.trackId]??platformQuizByTrack["mental-health"]:[],[course]);
  const quiz = customQuiz.length ? customQuiz : defaultQuiz;
  const score = quiz.reduce((sum,item,index)=>sum+(answers[index]===item.correct?1:0),0);
  const guides = course ? guideByTrack[course.trackId] ?? guideByTrack["mental-health"] : [];
  const guide = guides[activeLesson % guides.length];

  useEffect(()=>{
    if(!course)return;
    let active=true;
    const hydrate=async()=>{
      setCustomQuiz([]);
      try{
        const response=await fetch("/api/learning/progress?courseId="+encodeURIComponent(course.id),{cache:"no-store"});
        if(response.status===401){if(active){setAccessStatus("login_required");setProgressHydrated(false)}return;}
        if(response.status===402){if(active){setAccessStatus("payment_required");setProgressHydrated(false)}return;}
        if(!response.ok){if(active){setAccessStatus("error");setProgressHydrated(false)}return;}
        if(response.ok){
          const saved=await response.json();
          if(!active)return;
          const done=Array.isArray(saved.completedLessons)?saved.completedLessons.filter((n:number)=>Number.isInteger(n)&&n>=0&&n<course.lessons.length):[];
          const note=typeof saved.reflection==="string"?saved.reflection:"";
          if(Array.isArray(saved.quiz)&&saved.quiz.length>=3)setCustomQuiz(saved.quiz as PlatformQuizQuestion[]);
          setHasProtectedRecording(saved.hasProtectedVideo===true);
          setCompleted(done);setReflection(note);setAnswers(saved.quizAnswers&&typeof saved.quizAnswers==="object"?saved.quizAnswers:{});setChecked(saved.quizChecked===true);
          if(saved.certificate&&typeof saved.certificate.serial==="string")setIssuedCertificate({serial:saved.certificate.serial,status:String(saved.certificate.status||"issued")});
          localStorage.setItem("clinical-course-progress:"+course.id,JSON.stringify({completed:done,reflection:note,updatedAt:new Date().toISOString()}));
          setAccessStatus("allowed");setProgressHydrated(true);return;
        }
      }catch{if(active){setAccessStatus("error");setProgressHydrated(false)}return;}
      try{
        const saved=JSON.parse(localStorage.getItem("clinical-course-progress:"+course.id)||"{}") as {completed?:number[];reflection?:string;answers?:Record<number,number>;checked?:boolean};
        if(!active)return;
        setCompleted(Array.isArray(saved.completed)?saved.completed.filter(n=>Number.isInteger(n)&&n>=0&&n<course.lessons.length):[]);
        setReflection(typeof saved.reflection==="string"?saved.reflection:"");
        setAnswers(saved.answers&&typeof saved.answers==="object"?saved.answers:{});setChecked(saved.checked===true);
      }catch{setCompleted([]);setReflection("");}
      if(active){setAccessStatus("allowed");setProgressHydrated(true)}
    };
    void hydrate();
    return ()=>{active=false};
  },[course]);

  useEffect(()=>{
    if(!course||!progressHydrated)return;
    const payload={completedLessons:completed,reflection,quizAnswers:answers,quizChecked:checked,updatedAt:new Date().toISOString()};
    localStorage.setItem("clinical-course-progress:"+course.id,JSON.stringify({completed,reflection,answers,checked,updatedAt:payload.updatedAt}));
    const timer=window.setTimeout(()=>{void (async()=>{try{const response=await fetch("/api/learning/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId:course.id,...payload})});const result=await response.json();if(!response.ok){if(response.status!==402)setProgressSaveError(result.error||"تعذر حفظ تقدم الدورة.");return;}setProgressSaveError("");if(result.certificate&&typeof result.certificate.serial==="string"){setIssuedCertificate({serial:result.certificate.serial,status:String(result.certificate.status||"issued")});setCompletionMessage(result.certificate.status==="issued"?"تم إصدار شهادتك تلقائياً وأصبحت جاهزة للتنزيل والتحقق.":"توجد شهادة مسجلة لهذه الدورة لكنها ملغاة؛ راجع إدارة المنصة.");}else if(result.completedCount===result.totalLessons&&result.quizPassed&&course.mode!=="recorded"&&!result.attendanceVerified){setCompletionMessage("اكتملت الوحدات والاختبار. ستصدر الشهادة تلقائياً بعد اعتماد حضورك من المدرب أو المشرف.");}}catch{setProgressSaveError("تعذر حفظ تقدم الدورة حالياً.");}})();},650);
    return ()=>window.clearTimeout(timer);
  },[course,completed,reflection,answers,checked,progressHydrated]);

  if(!course && dynamicLoading) return <PlatformLayout title="تحميل محتوى الدورة" description="جارٍ تجهيز الدروس المنشورة."><div className="portal-empty">جارٍ تحميل بيانات الكورس والدروس...</div></PlatformLayout>;
  if(!course) return <PlatformLayout title="الدورة غير موجودة" description="لم نعثر على هذه الدورة في الكتالوج."><div className="portal-card"><Link href="/academy">العودة إلى الأكاديمية</Link></div></PlatformLayout>;
  if(accessStatus!=="allowed") return <PlatformLayout title={course.title} description="تتطلب هذه الدورة حساباً نشطاً واعتماد الالتحاق قبل فتح المحتوى.">
    {accessStatus==="checking"&&<div className="portal-empty">جارٍ التحقق من صلاحية الالتحاق...</div>}
    {accessStatus==="login_required"&&<div className="portal-card"><p>سجل الدخول إلى حساب المتدرب أولاً.</p><Link className="portal-button" href={"/login?next="+encodeURIComponent("/academy/"+course.id)}>تسجيل الدخول</Link></div>}
    {accessStatus==="payment_required"&&<section className="portal-card"><h2>الالتحاق بالدورة</h2><p>أرسل طلب الالتحاق باستخدام البريد الإلكتروني نفسه المرتبط بحسابك. بعد مراجعة الطلب وتحديد السعر، ستظهر لك وسيلة الدفع. لا يفتح المحتوى إلا بعد تأكيد الدفع.</p><PlatformRequestForm kind={course.mode==="recorded"?"course_enrollment":"classroom_registration"} title="طلب الالتحاق" initialData={{courseId:course.id}} fields={course.mode==="recorded"?[]:[{name:"preferredAt",label:"الموعد المناسب للفصل المباشر",type:"datetime-local",required:true},{name:"requestNote",label:"ملاحظات تنظيمية",type:"textarea"}]}/></section>}
    {accessStatus==="error"&&<div className="portal-card"><p>تعذر التحقق من صلاحية الدورة حالياً. أعد تحميل الصفحة بعد التأكد من اتصال الحساب.</p><button className="portal-button secondary" onClick={()=>window.location.reload()}>إعادة المحاولة</button></div>}
  </PlatformLayout>;

  const toggleLesson=()=>{
    setCompleted(current=>current.includes(activeLesson)?current.filter(n=>n!==activeLesson):[...current,activeLesson]);
  };
  const quizPassed=checked&&score>=Math.ceil(quiz.length*(2/3));
  const allLessonsDone=completed.length===course.lessons.length;
  const learningComplete=allLessonsDone&&quizPassed;

  return <PlatformLayout title={course.title} description={course.summary}>
    <div className="learning-topline"><Link href="/academy"><ArrowRight size={15}/> العودة للدورات</Link><span>{course.mode==="recorded"?"دورة مسجلة":course.mode==="live"?"دورة مباشرة":"دورة هجينة"}</span></div>
    <div className="learning-progress-card">
      <div><strong>تقدمك في الدورة</strong><small>{completed.length} من {course.lessons.length} وحدات مكتملة</small></div>
      <div className="learning-progress-track"><i style={{width:(completed.length/course.lessons.length*100)+"%"}}/></div>
      <span>{Math.round(completed.length/course.lessons.length*100)}%</span>
    </div>
    <div className="learning-layout">
      <aside className="learning-sidebar">
        <h2><BookOpen size={17}/> وحدات الدورة</h2>
        {course.lessons.map((lesson,index)=><button key={lesson} className={activeLesson===index?"active":""} onClick={()=>{setActiveLesson(index);setChecked(false);}}><span>{completed.includes(index)?<CheckCircle2 size={16}/>:<b>{String(index+1).padStart(2,"0")}</b>}</span>{lesson}</button>)}
      </aside>
      <section className="learning-main">
        <div className="learning-lesson-heading"><span>الوحدة {activeLesson+1} من {course.lessons.length}</span><h2>{course.lessons[activeLesson]}</h2></div>
        {dynamicLessons[activeLesson]?.videoReady ? <div className="learning-video"><BunnyLessonPlayer key={dynamicLessons[activeLesson].id} courseId={course.id} lessonId={dynamicLessons[activeLesson].id} title={dynamicLessons[activeLesson].title}/></div> : hasProtectedRecording ? <div className="learning-video"><ProtectedCourseVideo courseId={course.id} title={course.title}/></div> : <div className="learning-video-placeholder"><CirclePlay size={24}/><strong>{course.mode==="live"?"محتوى الفصل المباشر":"المادة التعليمية لهذه الوحدة"}</strong><span>{course.mode==="live"?"سيظهر تسجيل اللقاء هنا بعد رفعه من المدرب.":"لم يُرفق تسجيل فيديو لهذه الوحدة بعد؛ يمكنك دراسة المادة والتمرين أدناه."}</span></div>}
        <article className="learning-guide"><h3>ملخص الوحدة</h3><p>{guide.intro}</p><ul>{guide.points.map(point=><li key={point}>{point}</li>)}</ul><div className="learning-exercise"><strong>تطبيق عملي</strong><p>{guide.exercise}</p><textarea value={reflection} onChange={event=>{setReflection(event.target.value);setSavedReflection(false);}} rows={3} placeholder="اكتب إجابتك باستخدام حالة افتراضية فقط..."/><button onClick={()=>setSavedReflection(true)}>حفظ الملاحظة على هذا الجهاز</button>{savedReflection&&<small>تم حفظ الملاحظة محلياً في هذا المتصفح.</small>}</div></article>
        <div className="learning-actions"><button className="portal-button secondary" disabled={activeLesson===0} onClick={()=>{setActiveLesson(n=>n-1);setChecked(false);}}>الوحدة السابقة</button><button className="portal-button" onClick={toggleLesson}>{completed.includes(activeLesson)?"إلغاء إكمال الوحدة":"اعتماد إكمال الوحدة"} <CheckCircle2 size={15}/></button><button className="portal-button secondary" disabled={activeLesson===course.lessons.length-1} onClick={()=>{setActiveLesson(n=>n+1);setChecked(false);}}>الوحدة التالية <ChevronLeft size={15}/></button></div>
      </section>
    </div>
    <section className="learning-quiz">
      <div className="portal-section-title"><div><h2><ClipboardCheck size={18}/> اختبار فهم الدورة</h2><p>أجب عن الأسئلة الثلاثة. يلزم إجابتان صحيحتان على الأقل لاجتياز الاختبار.</p></div></div>
      {quiz.map((item,index)=><article key={item.q}><strong>{index+1}. {item.q}</strong><div>{item.options.map((option,choice)=><label key={option} className={answers[index]===choice?"chosen":""}><input type="radio" name={"quiz-"+index} checked={answers[index]===choice} onChange={()=>{setAnswers(current=>({...current,[index]:choice}));setChecked(false);}}/>{option}</label>)}</div>{checked&&<p className={answers[index]===item.correct?"right":"wrong"}>{answers[index]===item.correct?"إجابة صحيحة. ":"راجع الإجابة. "}{item.why}</p>}</article>)}
      <button className="portal-button" onClick={()=>setChecked(true)} disabled={Object.keys(answers).length!==quiz.length}>تصحيح الاختبار</button>
      {checked&&<p className={quizPassed?"learning-passed":"learning-failed"}>{score} من {quiz.length} — {quizPassed?"اجتزت الاختبار":"تحتاج إلى مراجعة المحتوى والمحاولة مرة أخرى"}.</p>}
    </section>
    <section className="learning-completion"><GraduationCap size={23}/><div><strong>إتمام الدورة والشهادة</strong><p>{issuedCertificate?.status==="issued"?"أصدرت المنصة شهادتك تلقائياً بعد استيفاء شروط الإتمام.":learningComplete?(course.mode==="recorded"?"أكملت الوحدات واجتزت الاختبار. جارٍ تسجيل الشهادة تلقائياً.":"أكملت الوحدات واجتزت الاختبار. تصدر الشهادة تلقائياً بعد اعتماد حضورك."):"أكمل جميع الوحدات واجتز الاختبار للوصول إلى شرط إصدار الشهادة."}</p>{issuedCertificate?.serial&&<small dir="ltr">الرقم التسلسلي: {issuedCertificate.serial}</small>}{completionMessage&&<small>{completionMessage}</small>}{progressSaveError&&<small role="alert" style={{color:"#a55b53"}}>{progressSaveError}</small>}</div><button disabled={!issuedCertificate?.serial&&!learningComplete} onClick={()=>router.push(issuedCertificate?.serial?"/certificates/verify?code="+encodeURIComponent(issuedCertificate.serial):"/certificates/mine")}>{issuedCertificate?.serial?"عرض وتنزيل الشهادة":"متابعة الشهادات"}</button></section>
    {course.mode!=="recorded"&&<div className="portal-callout"><Video size={16}/> هذه الدورة تتضمن لقاءات مباشرة. <Link href="/classrooms">انتقل إلى صفحة الفصول الافتراضية</Link> لطلب الالتحاق واستلام رابط Zoom بعد اعتماد الموعد.</div>}
    <div className="portal-callout"><LockKeyhole size={15}/> يُحفظ تقدم الوحدات ونتائج الاختبار داخل حسابك في المنصة، وتُراجع شروط الحضور قبل إصدار شهادة الدورات المباشرة والهجينة.</div>
  </PlatformLayout>;
}
