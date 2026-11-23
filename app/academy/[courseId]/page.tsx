"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ChevronLeft, CirclePlay, ClipboardCheck, GraduationCap, LockKeyhole, Video } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { courses } from "@/lib/platform-catalog";
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
const quizByTrack: Record<string,{q:string;options:string[];correct:number;why:string}[]> = {
  "social-work":[
    {q:"ما الممارسة الأفضل عند كتابة دراسة الحالة؟",options:["دمج أقوال المصادر والملاحظات في حقيقة واحدة","الفصل بين أقوال المصدر والملاحظة والفرضية","كتابة حكم عام دون أمثلة"],correct:1,why:"الفصل بين مصادر المعلومات والتفسير يجعل التقرير قابلاً للمراجعة."},
    {q:"كيف تصاغ خطة التدخل؟",options:["هدف تشاركي قابل للقياس مع مسؤوليات ومتابعة","قائمة خدمات دون موافقة","وعد بحل كل المشكلات"],correct:0,why:"الخطة المهنية تشاركية ومحددة وقابلة للمتابعة."},
    {q:"ما الذي يسبق الإحالة؟",options:["إخفاء سبب الإحالة","شرح سببها والتحقق من المسار والموافقة المناسبة","إصدار تشخيص نهائي"],correct:1,why:"الإحالة الواضحة تحترم الشخص وحدود الدور."}
  ],
  cbt:[
    {q:"ما عناصر نموذج CBT الأساسي؟",options:["الموقف والفكرة والانفعال والسلوك","العمر والوظيفة فقط","التشخيص والدواء فقط"],correct:0,why:"النموذج ينظم العلاقة بين الموقف والأفكار والانفعالات والاستجابات."},
    {q:"كيف نفحص فكرة تلقائية؟",options:["نستبدلها بإيجابية قسرية","نفحص الأدلة والتفسيرات البديلة تعاونياً","نؤكد أنها صحيحة دائماً"],correct:1,why:"الفحص التعاوني لا يفرض استنتاجاً مسبقاً."},
    {q:"ما شرط التجربة السلوكية؟",options:["الإكراه","خطوة آمنة متدرجة ومتفق عليها","ضمان اختفاء الأعراض"],correct:1,why:"التجربة التعليمية يجب أن تكون آمنة وتعاونية ولا تتضمن وعوداً."}
  ],
  autism:[
    {q:"ما الأساس في دعم التواصل؟",options:["فرض التواصل البصري","استخدام وسيلة التواصل المناسبة وإتاحة وقت المعالجة","تجاهل تفضيلات الشخص"],correct:1,why:"التواصل الفعال يحترم الاختلافات الفردية ووسائل التواصل."},
    {q:"عند الضيق الحسي، ماذا تفعل؟",options:["تعديل البيئة وعرض خيارات آمنة","الإصرار على البقاء في المثير","منع وسائل التنظيم الذاتي"],correct:0,why:"التيسيرات البيئية تدعم الراحة والمشاركة."},
    {q:"كيف تحدد هدف الدعم؟",options:["خطة واحدة للجميع","هدف فردي تشاركي ذو معنى","هدف يختاره المدرب وحده"],correct:1,why:"الدعم يتمحور حول الشخص واحتياجاته."}
  ],
  developmental:[
    {q:"ما الطريقة الأفضل لتقدير المهارات التكيفية؟",options:["درجة واحدة من استبيان","أمثلة من مجالات وسياقات ومصادر متعددة","الانطباع من العمر"],correct:1,why:"التقدير الشامل لا يختزل الأداء في مصدر واحد."},
    {q:"ما الذي قد يستدعي إحالة عاجلة؟",options:["فقد مهارة مكتسبة أو تغير حاد","اختلاف تفضيل النشاط","الحاجة إلى وقت معالجة"],correct:0,why:"فقد المهارات المكتسبة يحتاج استيضاحاً طبياً/نمائياً دون تأخير."},
    {q:"ما التقرير الجيد؟",options:["وصف الوقائع والحدود والمعلومات الناقصة","تسمية اضطراب من وصف قصير","مقارنة عامة بالأقران"],correct:0,why:"التقرير يفصل الأدلة عن الاستنتاجات ويحدد ما يحتاج إلى تقييم."}
  ],
  "mental-health":[
    {q:"كيف تبدأ المقابلة؟",options:["بسؤال مفتوح وشرح الدور والخصوصية","بتأكيد تشخيص","بتجاهل هدف الشخص"],correct:0,why:"المقابلة المهنية تبدأ بالوضوح والتعاون."},
    {q:"ما معنى نتيجة التحري الإيجابية؟",options:["تشخيص نهائي","إشارة لاستكمال التقييم حسب السياق","دليل على شدة الحالة"],correct:1,why:"أدوات التحري لا تثبت التشخيص ولا تنفيه."},
    {q:"ماذا تفعل عند خطر مباشر؟",options:["تواصل المحاكاة","تتبع بروتوكول الطوارئ والإحالة البشرية","تكتفي بتسجيل ملاحظة"],correct:1,why:"الخطر الواقعي يتطلب استجابة بشرية عاجلة."}
  ]
};

export default function CourseLearningPage() {
  const params = useParams<{courseId:string}>();
  const router = useRouter();
  const course = courses.find(item=>item.id===params.courseId);
  const [activeLesson,setActiveLesson] = useState(0);
  const [completed,setCompleted] = useState<number[]>([]);
  const [answers,setAnswers] = useState<Record<number,number>>({});
  const [checked,setChecked] = useState(false);
  const [recordingError,setRecordingError] = useState(false);
  const [reflection,setReflection] = useState("");
  const [savedReflection,setSavedReflection] = useState(false);
  const [progressHydrated,setProgressHydrated] = useState(false);
  const quiz = useMemo(()=>course?quizByTrack[course.trackId]??quizByTrack["mental-health"]:[],[course]);
  const score = quiz.reduce((sum,item,index)=>sum+(answers[index]===item.correct?1:0),0);
  const guides = course ? guideByTrack[course.trackId] ?? guideByTrack["mental-health"] : [];
  const guide = guides[activeLesson % guides.length];

  useEffect(()=>{
    if(!course)return;
    let active=true;
    const hydrate=async()=>{
      try{
        const response=await fetch("/api/learning/progress?courseId="+encodeURIComponent(course.id),{cache:"no-store"});
        if(response.ok){
          const saved=await response.json();
          if(!active)return;
          const done=Array.isArray(saved.completedLessons)?saved.completedLessons.filter((n:number)=>Number.isInteger(n)&&n>=0&&n<course.lessons.length):[];
          const note=typeof saved.reflection==="string"?saved.reflection:"";
          setCompleted(done);setReflection(note);setAnswers(saved.quizAnswers&&typeof saved.quizAnswers==="object"?saved.quizAnswers:{});setChecked(saved.quizChecked===true);
          localStorage.setItem("clinical-course-progress:"+course.id,JSON.stringify({completed:done,reflection:note,updatedAt:new Date().toISOString()}));
          setProgressHydrated(true);return;
        }
      }catch{}
      try{
        const saved=JSON.parse(localStorage.getItem("clinical-course-progress:"+course.id)||"{}") as {completed?:number[];reflection?:string;answers?:Record<number,number>;checked?:boolean};
        if(!active)return;
        setCompleted(Array.isArray(saved.completed)?saved.completed.filter(n=>Number.isInteger(n)&&n>=0&&n<course.lessons.length):[]);
        setReflection(typeof saved.reflection==="string"?saved.reflection:"");
        setAnswers(saved.answers&&typeof saved.answers==="object"?saved.answers:{});setChecked(saved.checked===true);
      }catch{setCompleted([]);setReflection("");}
      if(active)setProgressHydrated(true);
    };
    void hydrate();
    return ()=>{active=false};
  },[course]);

  useEffect(()=>{
    if(!course||!progressHydrated)return;
    const payload={completedLessons:completed,reflection,quizAnswers:answers,quizChecked:checked,updatedAt:new Date().toISOString()};
    localStorage.setItem("clinical-course-progress:"+course.id,JSON.stringify({completed,reflection,answers,checked,updatedAt:payload.updatedAt}));
    const timer=window.setTimeout(()=>{void fetch("/api/learning/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courseId:course.id,...payload})}).catch(()=>{});},650);
    return ()=>window.clearTimeout(timer);
  },[course,completed,reflection,answers,checked,progressHydrated]);

  if(!course) return <PlatformLayout title="الدورة غير موجودة" description="لم نعثر على هذه الدورة في الكتالوج."><div className="portal-card"><Link href="/academy">العودة إلى الأكاديمية</Link></div></PlatformLayout>;

  const toggleLesson=()=>{
    setCompleted(current=>current.includes(activeLesson)?current.filter(n=>n!==activeLesson):[...current,activeLesson]);
  };
  const quizPassed=checked&&score>=2;
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
        {course.recordingUrl ? <div className="learning-video"><video controls preload="metadata" src={course.recordingUrl} onError={()=>setRecordingError(true)}/>{recordingError&&<p>تعذر تشغيل التسجيل. راجع رابط الفيديو وصلاحية الوصول.</p>}</div> : <div className="learning-video-placeholder"><CirclePlay size={24}/><strong>{course.mode==="live"?"محتوى الفصل المباشر":"المادة التعليمية لهذه الوحدة"}</strong><span>{course.mode==="live"?"سيظهر تسجيل اللقاء هنا بعد رفعه من المدرب.":"لم يُرفق تسجيل فيديو لهذه الدورة بعد؛ يمكنك دراسة المادة والتمرين أدناه."}</span></div>}
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
    <section className="learning-completion"><GraduationCap size={23}/><div><strong>إتمام الدورة</strong><p>{learningComplete?"أكملت الوحدات واجتزت اختبار الفهم. أرسل طلب اعتماد الإكمال إلى إدارة المنصة.":"أكمل جميع الوحدات واجتز الاختبار لطلب اعتماد إتمام الدورة."}</p></div><button disabled={!learningComplete} onClick={()=>router.push("/certificates")}>الانتقال إلى الشهادات</button></section>
    {course.mode!=="recorded"&&<div className="portal-callout"><Video size={16}/> هذه الدورة تتضمن لقاءات مباشرة. <Link href="/classrooms">انتقل إلى صفحة الفصول الافتراضية</Link> لطلب الالتحاق واستلام رابط Zoom بعد اعتماد الموعد.</div>}
    <div className="portal-callout"><LockKeyhole size={15}/> تقدم هذه النسخة محفوظ محلياً في هذا المتصفح. ربط التقدم بحساب متدرب موحد يتطلب تفعيل تسجيل الدخول المؤسسي.</div>
  </PlatformLayout>;
}
