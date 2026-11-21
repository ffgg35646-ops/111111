"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, BookOpen, Brain, CalendarDays, ChartNoAxesCombined, ClipboardCheck,
  FileText, GraduationCap, LayoutDashboard, MessageCircle, Settings,
  ShieldCheck, ShoppingBag, Users, Video, Glasses, Plus, Search,
  Bell, ChevronLeft, CircleHelp, PanelRightClose
} from "lucide-react";

const sections = [
  { title:"الرئيسية", items:[["نظرة عامة",LayoutDashboard]] },
  { title:"الأكاديمية والتعلم", items:[["الدورات والبرامج",GraduationCap],["الفصول المباشرة عبر Zoom",Video],["الشهادات",ShieldCheck]] },
  { title:"المسارات التخصصية", items:[["منظومة التدريب التخصصي",Brain],["الخدمة الاجتماعية",Users],["العلاج المعرفي السلوكي CBT",Brain],["اضطراب طيف التوحد",Users],["الاضطرابات النمائية والإعاقة الذهنية",Users],["دراسة الحالة والمقاييس",ClipboardCheck]] },
  { title:"المحاكاة السريرية", items:[["مكتبة الحالات التدريبية",Brain],["قاعة محاكاة الحالة",Video],["الشخصيات الافتراضية",Users],["غرف الواقع الافتراضي",Glasses],["جلسات الإشراف",Activity],["تقييم لغة الجسد",Activity],["الغرف المشتركة",Video],["ملف الكفاءات المهنية",ChartNoAxesCombined],["مختبر المقاييس",ClipboardCheck]] },
  { title:"الخدمات", items:[["الاستشارات العلاجية والمهنية",MessageCircle],["المتجر المعرفي والكتب",ShoppingBag],["تأجير قاعات Zoom",Video]] },
  { title:"الإدارة", items:[["المتدربون والمختصون",Users],["التقارير والكفاءات",ChartNoAxesCombined],["إدارة المحتوى العلمي",BookOpen],["الإعدادات والصلاحيات",Settings]] },
] as const;

const routeByLabel: Record<string,string> = {
  "منظومة التدريب التخصصي": "/specialties",
  "الدورات والبرامج": "/academy",
  "الفصول المباشرة عبر Zoom": "/classrooms",
  "الشهادات": "/certificates",
  "الخدمة الاجتماعية": "/specialties?track=social-work",
  "العلاج المعرفي السلوكي CBT": "/specialties?track=psychotherapy",
  "اضطراب طيف التوحد": "/specialties?track=autism",
  "الاضطرابات النمائية والإعاقة الذهنية": "/specialties?track=developmental",
  "دراسة الحالة والمقاييس": "/specialties?section=case-study",
  "مكتبة الحالات التدريبية": "/cases",
  "قاعة محاكاة الحالة": "/simulation",
  "الشخصيات الافتراضية": "/characters",
  "تقييم لغة الجسد": "/posture",
  "الغرف المشتركة": "/supervision",
  "ملف الكفاءات المهنية": "/competencies",
  "مختبر المقاييس": "/specialties?section=scales",
  "الاستشارات العلاجية والمهنية": "/consultations",
  "المتجر المعرفي والكتب": "/books",
  "تأجير قاعات Zoom": "/room-rental",
};

const stats = [
  {label:"إجمالي المتدربين",value:"—",note:"سيظهر بعد ربط قاعدة البيانات",icon:Users,tone:"blue"},
  {label:"البرامج التدريبية",value:"—",note:"بانتظار إضافة البرامج",icon:GraduationCap,tone:"teal"},
  {label:"سيناريوهات المحاكاة",value:"—",note:"بانتظار إعداد الحالات",icon:Brain,tone:"violet"},
  {label:"جلسات هذا الأسبوع",value:"—",note:"بانتظار إعداد الحجوزات",icon:CalendarDays,tone:"amber"},
];

const modules = [
  [BookOpen,"التعليم والدورات"],[Video,"الفصول المباشرة"],[MessageCircle,"الاستشارات"],
  [ShoppingBag,"المتجر المعرفي"],[Glasses,"محاكاة VR"],[Brain,"الذكاء الاصطناعي"],[ClipboardCheck,"التقييم والكفاءات"]
] as const;

export default function HomePage() {
  const router = useRouter();
  const [active,setActive] = useState("نظرة عامة");
  const [query,setQuery] = useState("");
  const [sidebarOpen,setSidebarOpen] = useState(true);

  return <main className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <div className="brand-block">
        <div className="brand-copy"><strong>منصة التدريب السريري</strong><span>الإدارة والتشغيل</span></div>
        <button className="icon-button sidebar-toggle" onClick={()=>setSidebarOpen(false)} aria-label="إخفاء القائمة"><PanelRightClose size={18}/></button>
      </div>
      <div className="workspace-label">مساحة العمل</div>
      <nav className="side-nav">
        {sections.map(section=><div className="nav-section" key={section.title}>
          <p>{section.title}</p>
          {section.items.map(([label,Icon])=><button key={label} className={`nav-item ${active===label?"active":""}`} onClick={()=>{const target=routeByLabel[label];if(target)router.push(target);else setActive(label);}}>
            <Icon size={18}/><span>{label}</span>
          </button>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="support-icon"><CircleHelp size={18}/></div><div><strong>تحتاج إلى مساعدة؟</strong><span>مركز الدعم والإرشادات</span></div><ChevronLeft size={16}/></div>
    </aside>

    <section className="main-area">
      <header className="topbar">
        <div className="topbar-start">
          {!sidebarOpen&&<button className="icon-button" onClick={()=>setSidebarOpen(true)} aria-label="إظهار القائمة"><PanelRightClose size={19}/></button>}
          <div className="breadcrumb">الإدارة <ChevronLeft size={14}/> <strong>{active}</strong></div>
        </div>
        <div className="topbar-actions">
          <label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث في المنصة..."/></label>
          <button className="icon-button notification-button" aria-label="الإشعارات"><Bell size={19}/><i/></button>
          <div className="admin-profile"><div className="avatar">م</div><div><strong>مدير المنصة</strong><span>واجهة أولية — الدخول الفعلي قيد البناء</span></div></div>
        </div>
      </header>

      <div className="page-content">
        <div className="welcome-row">
          <div><div className="eyebrow">لوحة التحكم الرئيسية</div><h1>مرحباً بك في مساحة الإدارة</h1><p>إدارة التعليم والتدريب والاستشارات والمحاكاة السريرية من مكان واحد.</p></div>
          <button className="primary-button" onClick={()=>router.push("/cases")}><Plus size={18}/> إعداد حالة تدريبية</button>
        </div>

        <div className="notice-strip">
          <div className="notice-icon"><Brain size={19}/></div>
          <div><strong>إدارة الشخصيات والحالات الافتراضية</strong><span>الدكتور أو المشرف العلمي يكتب ملف الحالة وأهدافها وحدود معرفة الشخصية وطريقة استجابتها. الشخصية تتفاعل مع الحوار في سياقه، وليست تسجيلاً محفوظاً.</span></div>
          <button onClick={()=>router.push("/cases")}>إعداد الحالات <ChevronLeft size={15}/></button>
        </div>

        <div className="stats-grid">{stats.map(stat=><article className="stat-card" key={stat.label}>
          <div className={`stat-icon ${stat.tone}`}><stat.icon size={20}/></div>
          <div className="stat-label">{stat.label}</div><div className="stat-value">{stat.value}</div><div className="stat-note">{stat.note}</div>
        </article>)}</div>

        <div className="content-grid">
          <section className="panel activity-panel">
            <div className="panel-heading"><div><h2>مسار العمل التالي</h2><p>الأجزاء التي يلزم بناؤها وربطها قبل التشغيل الفعلي</p></div><span className="roadmap-tag">تأسيس المشروع</span></div>
            {[
              ["تأسيس تسجيل الدخول والصلاحيات","مدير المنصة، الدكتور، المشرف، المدرب، المتدرب"],
              ["محرر الحالات السريرية","المعلومات الأساسية، التاريخ، الأهداف، السيناريو، معايير التقييم"],
              ["محرر الشخصيات الافتراضية","الصوت، اللهجة، الشخصية، الخلفية، المعرفة، السلوك الحواري"],
              ["محرك المحادثة التفاعلية","صوت مباشر، ذاكرة سياقية، استجابات غير محفوظة، ضوابط أمان"],
            ].map(([title,desc])=><div className="activity-row" key={title}><div className="activity-symbol"><FileText size={18}/></div><div className="activity-main"><strong>{title}</strong><span>{desc}</span></div><span className="status-pill status-muted">لم يبدأ</span></div>)}
          </section>
          <section className="panel quick-panel">
            <div className="panel-heading"><div><h2>اختصارات الإدارة</h2><p>أقسام الإدارة الأساسية</p></div></div>
            <div className="quick-grid">
              <button onClick={()=>router.push("/cases")}><span className="quick-icon teal"><Brain size={19}/></span><strong>إعداد حالة تدريبية</strong><small>كتابة السيناريو السريري</small></button>
              <button onClick={()=>router.push("/characters")}><span className="quick-icon blue"><Users size={19}/></span><strong>إعداد شخصية افتراضية</strong><small>تعليمات الشخصية وصوتها</small></button>
              <button onClick={()=>router.push("/academy")}><span className="quick-icon violet"><GraduationCap size={19}/></span><strong>إضافة دورة</strong><small>برنامج تدريبي جديد</small></button>
              <button onClick={()=>router.push("/competencies")}><span className="quick-icon amber"><ChartNoAxesCombined size={19}/></span><strong>ملفات الكفاءات</strong><small>تقييم أداء المتدربين</small></button>
            </div>
          </section>
        </div>

        <section className="panel roadmap-panel">
          <div className="panel-heading"><div><h2>وحدات المنظومة المستهدفة</h2><p>هذه خريطة نطاق العمل وليست خصائص مكتملة بعد</p></div></div>
          <div className="module-chips">{modules.map(([Icon,label])=><span key={label}><Icon size={16}/>{label}</span>)}</div>
        </section>
        <footer className="page-footer">منصة التدريب والمحاكاة السريرية <span>•</span> مساحة الإدارة</footer>
      </div>
    </section>
  </main>;
}
