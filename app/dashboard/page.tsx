import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Award, BookOpen, BrainCircuit, FileText, GraduationCap, HeartHandshake, LibraryBig, MessageCircle, ShieldCheck, Sparkles, Users } from "lucide-react";

const destinations = [
  { href: "/academy", title: "الأكاديمية والدورات", description: "ابدأ رحلة تعلم منظمة عبر برامج ودورات مهنية.", icon: GraduationCap, tone: "gold" },
  { href: "/specialties", title: "المسارات التخصصية", description: "اكتشف مسارات الخدمة الاجتماعية وعلم النفس والتخصصات الدقيقة.", icon: BookOpen, tone: "teal" },
  { href: "/simulation", title: "مختبر المحاكاة", description: "تدرّب على مواقف مهنية تفاعلية وراجع أداءك.", icon: BrainCircuit, tone: "violet" },
  { href: "/books", title: "المكتبة العلمية", description: "مراجع وكتب ومواد معرفية تدعم ممارستك.", icon: LibraryBig, tone: "blue" },
  { href: "/consultations", title: "الاستشارات", description: "تعرّف على خدمات الاستشارة وطرق الحجز.", icon: HeartHandshake, tone: "rose" },
  { href: "/assessments", title: "المقاييس والأدوات", description: "استكشف أدوات التقدير والنماذج المهنية.", icon: ShieldCheck, tone: "green" },
  { href: "/articles", title: "المقالات العلمية", description: "اقرأ محتوى معرفياً مختاراً من مجالات المنصة.", icon: FileText, tone: "orange" },
  { href: "/community", title: "المجتمع المهني", description: "شارك المعرفة وتواصل مع مجتمع الممارسين.", icon: Users, tone: "cyan" },
];

export default function DashboardHomePage() {
  return (
    <main className="etzan-dashboard-home" dir="rtl">
      <header className="edh-header">
        <Link href="/" className="edh-brand"><span className="edh-brand-mark"><Image src="/etzan-symbol.svg" alt="" width={34} height={34} unoptimized /></span><span><b>اتزان</b><small>ETZAN · من المعرفة إلى الممارسة</small></span></Link>
        <nav className="edh-nav"><Link href="/about">عن المنصة</Link><Link href="/academy">الأكاديمية</Link><Link href="/specialties">المسارات</Link><Link href="/certificates">الشهادات</Link></nav>
        <div className="edh-actions"><Link href="/login" className="edh-login">دخول الأعضاء</Link><Link href="/register" className="edh-register">إنشاء حساب <ArrowLeft size={15}/></Link></div>
      </header>

      <section className="edh-hero">
        <div className="edh-hero-copy">
          <span className="edh-eyebrow"><i/> بوابتك إلى التطور المهني</span>
          <h1>المعرفة التي<br/><em>تصنع فرقاً في الممارسة.</em></h1>
          <p>منصة اتزان تجمع التعلم المتخصص، والتدريب التطبيقي، والمحاكاة المهنية، والأدوات العلمية في مساحة واحدة تساعدك على تطوير خبرتك.</p>
          <div className="edh-hero-actions"><Link href="/academy" className="edh-primary">استكشف البرامج <ArrowLeft size={17}/></Link><Link href="/about" className="edh-secondary">اكتشف اتزان</Link></div>
          <div className="edh-trust"><span><ShieldCheck size={16}/> محتوى للتطوير المهني</span><span><Sparkles size={16}/> تعلم تطبيقي متجدد</span></div>
        </div>
        <div className="edh-hero-art" aria-hidden="true"><div className="edh-orbit edh-orbit-one"/><div className="edh-orbit edh-orbit-two"/><div className="edh-emblem"><Image src="/etzan-symbol.svg" alt="" width={112} height={112} unoptimized/><span>ETZAN</span><small>LEARN · PRACTICE · GROW</small></div><div className="edh-float edh-float-top"><BrainCircuit size={19}/><span>محاكاة وتطبيق</span></div><div className="edh-float edh-float-bottom"><Award size={19}/><span>مسارات وشهادات</span></div></div>
      </section>

      <section className="edh-destinations">
        <div className="edh-section-heading"><div><span>استكشف المنصة</span><h2>مساحتك للتعلم والتطوير</h2><p>اختر المجال الذي تريد البدء منه، وانتقل مباشرة إلى خدمات اتزان.</p></div><Link href="/academy">عرض البرامج <ArrowLeft size={15}/></Link></div>
        <div className="edh-grid">{destinations.map(({href,title,description,icon:Icon,tone})=><Link href={href} className="edh-card" key={href}><span className={"edh-card-icon "+tone}><Icon size={22}/></span><span className="edh-card-arrow"><ArrowLeft size={17}/></span><h3>{title}</h3><p>{description}</p><b>استكشف القسم <ArrowLeft size={14}/></b></Link>)}</div>
      </section>

      <section className="edh-bottom"><div><span>اتزان · ETZAN</span><h2>من المعرفة إلى الممارسة</h2><p>بيئة عربية متخصصة للتعلم والتدريب والتطوير المهني المستمر.</p></div><Link href="/register">ابدأ رحلتك <ArrowLeft size={16}/></Link></section>
      <footer className="edh-footer"><span>© اتزان ETZAN</span><span>المحتوى والمحاكاة لأغراض التدريب والتطوير المهني.</span><Link href="/login">دخول الأعضاء</Link></footer>
    </main>
  );
}
