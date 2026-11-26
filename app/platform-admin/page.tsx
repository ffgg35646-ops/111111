"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notification-bell";

type NavItem = { label: string; href: string };
type NavSection = { title: string; items: NavItem[] };
type Stat = { label: string; key: string; note: string };
type Integration = { label: string; configured: boolean; detail: string; state: string };
type Overview = {
  totals: Record<string, number>;
  generatedAt: string;
  integrations?: Record<string, Integration>;
  operationalGaps?: string[];
};

const sections: NavSection[] = [
  { title: "الرئيسية", items: [{ label: "نظرة عامة", href: "/platform-admin" }, { label: "التقارير والإحصائيات", href: "/platform-admin/reports" }] },
  { title: "الإدارة", items: [
    { label: "المستخدمون والأدوار", href: "/platform-admin/users" },
    { label: "الدورات والمدربون", href: "/platform-admin/courses" },
    { label: "المحتوى العلمي", href: "/platform-admin/content" },
    { label: "صفحات الموقع", href: "/platform-admin/site-content" },
    { label: "الأدمن الفرعي", href: "/platform-admin/sub-admins" },
    { label: "الكتب والمنتجات", href: "/platform-admin/books" },
    { label: "إدارة المقاييس والاختبارات", href: "/platform-admin/assessments" },
    { label: "إدارة الأدوات والنماذج", href: "/platform-admin/tools" },
    { label: "الملفات المهنية المحفوظة", href: "/platform-admin/forms" },
    { label: "الاستشارات والمواعيد", href: "/platform-admin/availability" },
    { label: "الاشتراكات", href: "/platform-admin/subscriptions" },
    { label: "المدفوعات", href: "/platform-admin/payments" },
    { label: "الفواتير", href: "/platform-admin/invoices" },
    { label: "الشهادات", href: "/platform-admin/certificates" },
    { label: "المجتمع والبلاغات", href: "/platform-admin/community" },
    { label: "الصلاحيات", href: "/platform-admin/permissions" },
    { label: "الذكاء الاصطناعي", href: "/platform-admin/ai" },
    { label: "فهرس المعرفة", href: "/platform-admin/ai-knowledge" },
    { label: "الأمان والخصوصية", href: "/platform-admin/security" },
  ] },
  { title: "التشغيل والتدريب", items: [
    { label: "طلبات المنصة", href: "/platform-admin/requests" },
    { label: "تذاكر دعم الطلاب", href: "/platform-admin/support" },
    { label: "الفصول المباشرة", href: "/platform-admin/classrooms" },
    { label: "إدارة سيناريوهات المحاكاة", href: "/simulation/manage" },
    { label: "الحالات التدريبية", href: "/cases" },
    { label: "الشخصيات الافتراضية", href: "/characters" },
    { label: "المحاكاة والواقع الافتراضي", href: "/simulation" },
    { label: "الإشراف المهني", href: "/supervision" },
    { label: "لغة الجسد", href: "/posture" },
    { label: "الكفاءات المهنية", href: "/competencies" },
  ] },
];

const shortcuts: NavItem[] = [
  { label: "إدارة الحسابات", href: "/platform-admin/users" },
  { label: "إسناد المدربين للدورات", href: "/platform-admin/courses" },
  { label: "مراجعة الطلبات والحجوزات", href: "/platform-admin/requests" },
  { label: "تذاكر دعم الطلاب", href: "/platform-admin/support" },
  { label: "إدارة المواعيد", href: "/platform-admin/availability" },
  { label: "جلسات التدريب المباشر", href: "/platform-admin/classrooms" },
  { label: "متابعة المدفوعات", href: "/platform-admin/payments" },
  { label: "متابعة الشهادات", href: "/platform-admin/certificates" },
  { label: "تقارير المحاكاة", href: "/platform-admin/activities" },
];

const stats: Stat[] = [
  { label: "حسابات المنصة", key: "usersTotal", note: "كل الحسابات المسجلة" },
  { label: "الدورات", key: "courses", note: "الدورات الموجودة في الكتالوج" },
  { label: "طلبات قيد المراجعة", key: "pendingRequests", note: "تحتاج قرار الإدارة" },
  { label: "الشهادات السارية", key: "issuedCertificates", note: "الشهادات غير الملغاة" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [checking, setChecking] = useState(true);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [clinicName, setClinicName] = useState("اتزان");
  const [logoName, setLogoName] = useState("ETZAN");

  useEffect(() => {
    let active = true;
    fetch("/api/site-branding", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(brand => { if (active && brand) { setClinicName(String(brand.clinicName || "اتزان")); setLogoName(String(brand.logoName || "ETZAN")); } }).catch(() => {});
    if (new URLSearchParams(window.location.search).get("preview") === "1") {
      setPreviewMode(true);
      setAuthorized(true);
      setChecking(false);
      return () => { active = false; };
    }
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.authenticated || !["admin", "platform_manager"].includes(data.user?.role)) {
          router.replace("/login?next=/platform-admin");
          return;
        }
        if (data.user?.mustChangePassword) {
          router.replace("/account/change-password");
          return;
        }
        if (active) setAuthorized(true);
      })
      .catch(() => router.replace("/login?next=/platform-admin"))
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!authorized || previewMode) return;
    let active = true;
    fetch("/api/platform/admin/overview", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل مؤشرات التشغيل.");
        if (active) setOverview(data);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "تعذر تحميل مؤشرات التشغيل."); });
    return () => { active = false; };
  }, [authorized, previewMode]);

  const filteredSections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ar");
    return sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => !needle || (item.label + " " + item.href).toLocaleLowerCase("ar").includes(needle)),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  const filteredShortcuts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ar");
    return shortcuts.filter((item) => !needle || item.label.toLocaleLowerCase("ar").includes(needle));
  }, [query]);

  if (checking) return <main className="app-shell admin-dashboard-shell" dir="rtl" aria-busy="true"><aside className="sidebar"><div className="brand-block"><div className="brand-copy"><strong>{clinicName} | {logoName}</strong><span>الإدارة والتشغيل</span></div></div></aside><section className="main-area"><header className="topbar"><div className="breadcrumb"><strong>الإدارة والتشغيل</strong></div></header><div className="page-content"><div className="stats-grid admin-stats-grid">{[0,1,2,3].map((item)=><section className="stat-card" key={item}><div className="portal-skeleton" style={{width:"55%",height:11,marginBottom:18}}/><div className="portal-skeleton" style={{width:"38%",height:27,marginBottom:12}}/><div className="portal-skeleton" style={{width:"72%",height:9}}/></section>)}</div><section className="panel roadmap-panel"><div className="portal-skeleton" style={{width:"34%",height:16,marginBottom:18}}/><div className="portal-skeleton" style={{width:"92%",height:11,marginBottom:10}}/><div className="portal-skeleton" style={{width:"76%",height:11}}/></section></div></section></main>;
  if (!authorized) return null;

  return (
    <main className="app-shell admin-dashboard-shell">
      <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        <div className="brand-block">
          <div className="brand-copy"><strong>{clinicName} | {logoName}</strong><span>الإدارة والتشغيل</span></div>
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(false)} aria-label="إخفاء القائمة">×</button>
        </div>
        <div className="workspace-label">القائمة الرئيسية</div>
        <nav className="side-nav" aria-label="أقسام الإدارة">
          {filteredSections.map((section) => (
            <div className="nav-section" key={section.title}>
              <p>{section.title}</p>
              {section.items.map((item) => (
                <Link key={item.href} href={previewMode ? "/platform-admin?preview=1" : item.href} aria-disabled={previewMode} title={previewMode ? "معاينة فقط — الوحدات الداخلية تحتاج تسجيل الدخول" : undefined} className={"nav-item" + (item.href === "/platform-admin" ? " active" : "")}><span>{item.label}</span></Link>
              ))}
            </div>
          ))}
          {filteredSections.length === 0 && <p className="portal-empty">لا توجد وحدات مطابقة للبحث.</p>}
        </nav>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="topbar-start">
            {!sidebarOpen && <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="إظهار القائمة">☰</button>}
            <div className="breadcrumb"><strong>الإدارة والتشغيل</strong></div>
          </div>
          <div className="topbar-actions">
            {previewMode ? <span className="portal-chip">وضع المعاينة</span> : <NotificationBell/>}
            <label className="search-box">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن وحدة أو إجراء..." aria-label="البحث في وحدات الإدارة" />
            </label>
            <Link className="admin-profile" href={previewMode ? "/platform-admin?preview=1" : "/platform-admin/users"} aria-disabled={previewMode} style={{ textDecoration: "none", color: "inherit" }}>
              <div><strong>إدارة الحسابات</strong><span>المستخدمون والأدوار</span></div>
            </Link>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row admin-welcome">
            <div><div className="eyebrow">لوحة التشغيل</div><h1>نظرة عامة</h1><p>مؤشرات من قاعدة البيانات وروابط مباشرة إلى وحدات الإدارة.</p></div>
          </div>

          {previewMode && <div className="portal-callout" role="status"><strong>وضع معاينة بدون تسجيل دخول.</strong> يمكنك استعراض شكل لوحة الإدارة وأقسامها فقط؛ لا يتم تحميل أي بيانات إدارية حقيقية، وجميع إجراءات الإدارة تظل محمية بتسجيل الدخول.</div>}
          {error && <div className="portal-callout" role="alert">{error}</div>}

          <div className="stats-grid admin-stats-grid">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.key}>
                <div className="stat-label">{stat.label}</div>
                <div className="stat-value">{overview ? Number(overview.totals[stat.key] || 0).toLocaleString("ar-SA") : previewMode ? "معاينة" : "—"}</div>
                <div className="stat-note">{stat.note}</div>
              </article>
            ))}
          </div>

          <section className="panel roadmap-panel">
            <div className="panel-heading"><div><h2>الوصول السريع</h2><p>اختر الوحدة التي تريد إدارتها.</p></div></div>
            <div className="quick-grid">
              {filteredShortcuts.map((item) => <button key={item.href} disabled={previewMode} onClick={() => router.push(item.href)} title={previewMode ? "سجّل الدخول لاستخدام الوحدة" : undefined}><strong>{item.label}</strong><small>{previewMode ? "للمعاينة فقط" : "فتح الوحدة"}</small></button>)}
              {filteredShortcuts.length === 0 && <p className="portal-empty">لا توجد وحدات مطابقة للبحث.</p>}
            </div>
          </section>

          <section className="panel roadmap-panel">
            <div className="panel-heading"><div><h2>حالة التكاملات</h2><p>حالة الإعداد كما تظهر من بيئة تشغيل المنصة؛ وجود المفاتيح لا يعني اكتمال اعتماد المزود.</p></div></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
              {Object.entries(overview?.integrations || {}).map(([key, item]) => (
                <article key={key} style={{ border: "1px solid #e3eaed", borderRadius: 9, padding: 13, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ fontSize: 11 }}>{item.label}</strong>
                    <span style={{ fontSize: 9, color: item.state === "connected" || item.configured ? "#237a68" : "#9b7441" }}>{item.state === "connected" ? "متصل" : item.configured ? "الإعداد موجود" : "يحتاج إعداد"}</span>
                  </div>
                  <p style={{ fontSize: 9, color: "#7b8d94", lineHeight: 1.8, margin: "7px 0 0" }}>{item.detail}</p>
                </article>
              ))}
              {!overview && <p className="portal-empty">{previewMode ? "تظهر حالة التكاملات الفعلية بعد تسجيل الدخول." : "جارٍ تحميل حالة التكاملات..."}</p>}
            </div>
          </section>

          <section className="panel roadmap-panel">
            <div className="panel-heading"><div><h2>نواقص تشغيلية معروفة</h2><p>وظائف غير مكتملة في الكود الحالي أو تحتاج تكاملًا واعتمادًا خارجيًا.</p></div></div>
            <div style={{ display: "grid", gap: 8 }}>
              {(overview?.operationalGaps || []).map((gap, index) => <div key={index} style={{ borderBottom: "1px solid #edf1f2", padding: "8px 0", fontSize: 10, color: "#647984", lineHeight: 1.8 }}>{gap}</div>)}
              {!overview && <p className="portal-empty">{previewMode ? "قائمة النواقص التشغيلية الفعلية تظهر بعد تسجيل الدخول." : "جارٍ تحميل قائمة النواقص..."}</p>}
            </div>
          </section>

          <footer className="page-footer"><Link href={previewMode ? "/platform-admin?preview=1" : "/platform-admin/reports"}>التقارير</Link><span>{clinicName} | {logoName}</span></footer>
        </div>
      </section>
    </main>
  );
}
