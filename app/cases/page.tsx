import Link from "next/link";
import { Activity, ArrowUpLeft, BookOpen, ClipboardCheck, PlayCircle, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { trainingCases } from "@/lib/platform-catalog";

export default function CasesPage() {
  return <PlatformLayout title="مكتبة الحالات والمحاكاة العملية" description="تدرب على دراسة الحالة والمقابلة وتقدير الاحتياج والفرضيات التعليمية وخطة التدخل داخل سيناريوهات افتراضية.">
    <div className="portal-callout"><ShieldCheck size={17}/> جميع الحالات خيالية. يتعلم المتدرب جمع الأدلة وصياغة الفرضيات ومعرفة حدود الاختصاص ومتى يحيل الحالة. لا تصدر المنصة تشخيصاً طبياً أو نفسياً رسمياً.</div>
    <div className="portal-section-title"><div><h2>سيناريوهات التدريب المتاحة</h2><p>كل حالة تحتوي على خمس مراحل ومؤشرات تقييم للممارسة</p></div><Link className="portal-link-button secondary" href="/assessments"><ClipboardCheck size={14}/> مختبر المقاييس</Link></div>
    <div className="portal-grid">
      {trainingCases.map((item,index)=><article className="portal-card case-library-card" key={item.id}>
        <span className="case-number">حالة {String(index+1).padStart(2,"0")}</span><span className="portal-chip">{item.track}</span>
        <h3>{item.title}</h3><p>{item.briefing}</p>
        <div className="course-meta"><span><Activity size={13}/>{item.steps.length} مراحل تقييم</span><span><BookOpen size={13}/>{item.ageGroup}</span></div>
        <div className="portal-chip-row">{item.learningGoals.slice(0,3).map(x=><span className="portal-chip" key={x}>{x}</span>)}</div>
        <Link className="portal-link-button" href={"/simulation?case="+item.id}><PlayCircle size={14}/> دخول القاعة وبدء المحاكاة <ArrowUpLeft size={14}/></Link>
      </article>)}
    </div>
    <section className="portal-card case-workflow">
      <h3>كيف تتم دراسة الحالة داخل المنصة؟</h3>
      <div className="workflow-steps">
        {["استقبال الحالة وبناء العلاقة","جمع التاريخ والمعلومات والسياق","استكشاف عوامل الحماية والمخاطر","صياغة الفرضيات التعليمية","بناء خطة دعم وإحالة ومتابعة","التوثيق والتقييم تحت إشراف"].map((item,i)=><div key={item}><b>{String(i+1).padStart(2,"0")}</b><span>{item}</span></div>)}
      </div>
    </section>
  </PlatformLayout>;
}
