"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, BookOpen, Brain, CalendarDays, ChartNoAxesCombined, ClipboardCheck, CreditCard, Wallet,
  FileText, GraduationCap, LayoutDashboard, MessageCircle, Settings,
  ShieldCheck, ShoppingBag, Users, Video, Glasses, Plus, Search,
  Bell, ChevronLeft, CircleHelp, PanelRightClose
} from "lucide-react";

const sections = [
  { title:"الرئيسية", items:[["نظرة عامة",LayoutDashboard]] },
  { title:"الإدارة الرئيسية", items:[
    ["إدارة المستخدمين",Users],["إدارة الدورات والبرامج",GraduationCap],["إدارة المحتوى العلمي",BookOpen],
    ["إدارة الكتب والمنتجات",ShoppingBag],["إدارة المقاييس والنماذج",ClipboardCheck],
    ["إدارة الاستشارات",MessageCircle],["إدارة الاشتراكات",CreditCard],
    ["المدفوعات",Wallet],["الفواتير",FileText],["إدارة الشهادات",ShieldCheck],
    ["المجتمع والبلاغات",MessageCircle],["التقارير والإحصائيات",ChartNoAxesCombined],["إدارة الصلاحيات",Settings],
  ] },
  { title:"تشغيل الخدمات", items:[
    ["طلبات المنصة والحجوزات",ClipboardCheck],["إتاحة مواعيد الاستشارات",CalendarDays],
    ["الفصول المباشرة عبر Zoom",Video],["قاعة التدريب المباشر",Video],
  ] },
  { title:"التدريب والمحاكاة", items:[
    ["منظومة التدريب التخصصي",Brain],["إدارة سيناريوهات ومعايير التقييم",Settings],
    ["مكتبة الحالات التدريبية",Brain],["قاعة محاكاة الحالة",Video],["الشخصيات الافتراضية",Users],
    ["غرف الواقع الافتراضي",Glasses],["جلسات الإشراف",Activity],["تقييم لغة الجسد",Activity],
    ["ملف الكفاءات المهنية",ChartNoAxesCombined],
  ] },
] as const;

const routeByLabel: Record<string,string> = {
  "إدارة المستخدمين": "/platform-admin/users",
  "إدارة الدورات والبرامج": "/platform-admin/courses",
  "إدارة المحتوى العلمي": "/platform-admin/content",
  "إدارة الكتب والمنتجات": "/platform-admin/books",
  "إدارة المقاييس والنماذج": "/platform-admin/forms",
  "إدارة الاستشارات": "/platform-admin/availability",
  "إدارة الاشتراكات": "/platform-admin/subscriptions",
  "المدفوعات": "/platform-admin/payments",
  "الفواتير": "/platform-admin/invoices",
  "إدارة الشهادات": "/platform-admin/certificates",
  "المجتمع والبلاغات": "/platform-admin/community",
  "التقارير والإحصائيات": "/platform-admin/reports",
  "إدارة الصلاحيات": "/platform-admin/permissions",
  "طلبات المنصة والحجوزات": "/platform-admin/requests",
  "إتاحة مواعيد الاستشارات": "/platform-admin/availability",
  "الفصول المباشرة عبر Zoom": "/classrooms",
  "قاعة التدريب المباشر": "/platform-admin/classrooms",
  "منظومة التدريب التخصصي": "/specialties",
  "إدارة سيناريوهات ومعايير التقييم": "/simulation/manage",
  "مكتبة الحالات التدريبية": "/cases",
  "قاعة محاكاة الحالة": "/simulation",
  "غرف الواقع الافتراضي": "/simulation",
  "جلسات الإشراف": "/supervision",
  "الشخصيات الافتراضية": "/characters",
  "تقييم لغة الجسد": "/posture",
  "ملف الكفاءات المهنية": "/competencies",
};

const stats = [
  {label:"حسابات المنصة",valueKey:"usersTotal",note:"كل حسابات الأدوار المسجلة",icon:Users,tone:"blue"},
  {label:"الدورات التدريبية",valueKey:"courses",note:"دورات الكتالوج الحالي",icon:GraduationCap,tone:"teal"},
  {label:"طلبات قيد المراجعة",valueKey:"pendingRequests",note:"تنتظر قرار الإدارة",icon:ClipboardCheck,tone:"violet"},
  {label:"الشهادات السارية",valueKey:"issuedCertificates",note:"شهادات صادرة وغير ملغاة",icon:ShieldCheck,tone:"amber"},
] as const;

const modules = [
  [BookOpen,"التعليم والدورات"],[Video,"الفصول المباشرة"],[MessageCircle,"الاستشارات"],
  [ShoppingBag,"المتجر المعرفي"],[Glasses,"محاكاة VR"],[Brain,"الذكاء الاصطناعي"],[ClipboardCheck,"التقييم والكفاءات"]
] as const;

const adminShortcuts = [
  {label:"إدارة المستخدمين",description:"الحسابات والأدوار والحالات",href:"/platform-admin/users",icon:Users},
  {label:"إدارة الدورات",description:"كتالوج البرامج وإسناد المدربين",href:"/platform-admin/courses",icon:GraduationCap},
  {label:"إدارة المحتوى",description:"المقالات العلمية والنشر",href:"/platform-admin/content",icon:BookOpen},
  {label:"الكتب والمنتجات",description:"الكتب الرقمية والورقية والمخزون",href:"/platform-admin/books",icon:ShoppingBag},
  {label:"المقاييس والنماذج",description:"سجلات النماذج وأدوات التقدير",href:"/platform-admin/forms",icon:ClipboardCheck},
  {label:"الاستشارات",description:"المواعيد والحجوزات",href:"/platform-admin/availability",icon:CalendarDays},
  {label:"الاشتراكات",description:"جاهزية العضويات والتجديد",href:"/platform-admin/subscriptions",icon:CreditCard},
  {label:"المدفوعات والفواتير",description:"سجل العمليات والمبالغ",href:"/platform-admin/invoices",icon:Wallet},
  {label:"الشهادات",description:"الإصدار والتحقق والإلغاء",href:"/platform-admin/certificates",icon:ShieldCheck},
  {label:"المجتمع والبلاغات",description:"المشاركات والتقارير المفتوحة",href:"/platform-admin/community",icon:MessageCircle},
  {label:"التقارير والإحصائيات",description:"مؤشرات التشغيل والأداء",href:"/platform-admin/reports",icon:ChartNoAxesCombined},
  {label:"إدارة الصلاحيات",description:"الأدوار وحدود الوصول",href:"/platform-admin/permissions",icon:Settings},
] as const;

export default function HomePage() {
  const router = useRouter();
  const [authorized,setAuthorized] = useState(false);
  const [checking,setChecking] = useState(true);
  useEffect(()=>{let active=true;fetch("/api/auth/session",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok||!data.authenticated||!["admin","platform_manager"].includes(data.user?.role)){router.replace("/login?next=/platform-admin");return;}if(data.user?.mustChangePassword){router.replace("/account/change-password");return;}if(active)setAuthorized(true)}).catch(()=>router.replace("/login?next=/platform-admin")).finally(()=>{if(active)setChecking(false)});return()=>{active=false}},[router]);
  const [active,setActive] = useState("نظرة عامة");
  const [query,setQuery] = useState("");
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [overview,setOverview] = useState<{totals:Record<string,number>;generatedAt:string}|null>(null);
  const [overviewError,setOverviewError] = useState("");
  useEffect(()=>{if(!authorized)return;let active=true;fetch("/api/platform/admin/overview",{cache:"no-store"}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"تعذر تحميل المؤشرات.");if(active)setOverview(data)}).catch(error=>{if(active)setOverviewError(error instanceof Error?error.message:"تعذر تحميل المؤشرات.")});return()=>{active=false}},[authorized]);

  if(checking)return <main className="app-shell" dir="rtl"><div className="portal-empty">جارٍ التحقق من صلاحية الإدارة...</div></main>;
  if(!authorized)return null;
  return <main className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <div className="brand-block">
        <div className="brand-copy"><strong>اتزان | ETZAN</strong><span>الإدارة والتشغيل</span></div>
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
          <a className="admin-profile" href="/platform-admin/users" style={{ textDecoration: "none", color: "inherit" }}><div className="avatar">إ</div><div><strong>إدارة الحسابات</strong><span>المستخدمون والأدوار</span></div></a>
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
          <div className="stat-label">{stat.label}</div><div className="stat-value">{overview?Number(overview.totals[stat.valueKey]||0).toLocaleString("ar-SA"):"—"}</div><div className="stat-note">{stat.note}</div>
        </article>)}</div>

        {overviewError&&<div className="portal-callout" role="alert">{overviewError}</div>}
        <section className="panel roadmap-panel admin-shortcuts-panel"><div className="panel-heading"><div><h2>مراكز الإدارة</h2><p>الوصول المباشر إلى وحدات الإدارة من مكان واحد</p></div></div><div className="quick-grid">{adminShortcuts.map(({label,description,href,icon:Icon},index)=><button key={href} onClick={()=>router.push(href)}><span className={"quick-icon "+(["teal","blue","violet","amber"][index%4])}><Icon size={19}/></span><strong>{label}</strong><small>{description}</small></button>)}</div></section>
        <div className="content-grid">
          <section className="panel activity-panel">
            <div className="panel-heading"><div><h2>مسار تشغيل المنظومة</h2><p>الوحدات الأساسية وما يتطلب ربطاً واعتماداً قبل الإطلاق</p></div><span className="roadmap-tag">خطة التشغيل</span></div>
            {[
              ["الحسابات والأدوار","دخول آمن وحسابات منفصلة للمدير والمشرف والمدرب والمتدرب والمستشار"],
              ["دراسة الحالة والتقييم","جمع المعلومات والفرضيات ونقاط القوة والمعلومات الناقصة ومراجعة المشرف"],
              ["الشخصيات السريرية التفاعلية","شخصيات ثلاثية الأبعاد ومحادثة سياقية بالصوت والنص"],
              ["المحاكاة والإشراف","WebXR داخل المتصفح وغرف LiveKit وقياسات VR وتقارير الكفاءات"],
            ].map(([title,desc])=><div className="activity-row" key={title}><div className="activity-symbol"><FileText size={18}/></div><div className="activity-main"><strong>{title}</strong><span>{desc}</span></div><span className="status-pill status-green">وحدة مضافة</span></div>)}
          </section>
          <section className="panel quick-panel">
            <div className="panel-heading"><div><h2>اختصارات الإدارة</h2><p>أقسام الإدارة الأساسية</p></div></div>
            <div className="quick-grid">
              <button onClick={()=>router.push("/cases")}><span className="quick-icon teal"><Brain size={19}/></span><strong>إعداد حالة تدريبية</strong><small>كتابة السيناريو السريري</small></button>
              <button onClick={()=>router.push("/characters")}><span className="quick-icon blue"><Users size={19}/></span><strong>إعداد شخصية افتراضية</strong><small>تعليمات الشخصية وصوتها</small></button>
              <button onClick={()=>router.push("/platform-admin/courses")}><span className="quick-icon violet"><GraduationCap size={19}/></span><strong>إدارة الدورات</strong><small>إسناد المدربين ومتابعة البرامج</small></button>
              <button onClick={()=>router.push("/competencies")}><span className="quick-icon amber"><ChartNoAxesCombined size={19}/></span><strong>ملفات الكفاءات</strong><small>تقييم أداء المتدربين</small></button>
            </div>
          </section>
        </div>

        <section className="panel roadmap-panel">
          <div className="panel-heading"><div><h2>وحدات المنظومة</h2><p>الوصول إلى وحدات التعلم والتدريب والخدمات والمحاكاة</p></div></div>
          <div className="module-chips">{modules.map(([Icon,label])=><span key={label}><Icon size={16}/>{label}</span>)}</div>
        </section>
        <footer className="page-footer">اتزان | ETZAN <span>•</span> مساحة الإدارة <span>•</span> <a href="/platform-admin/users">إدارة الحسابات</a></footer>
      </div>
    </section>
  </main>;
}
