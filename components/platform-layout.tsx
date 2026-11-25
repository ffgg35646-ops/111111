"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity, Award, BookOpen, Brain, CalendarDays, ClipboardCheck,
  FileText, GraduationCap, HeartHandshake, Home, Library, LockKeyhole,
  Menu, MessageSquare, Scale, ShieldCheck, Sparkles, Users, X,
  type LucideIcon,
} from "lucide-react";

type SignedInUser = { name: string; email: string; role: string; sessionId?: string };
type NavigationItem = { href: string; label: string; icon: LucideIcon; roles?: string[]; group: string };

const roleLabels: Record<string, string> = {
  admin: "مدير النظام",
  platform_manager: "مدير المنصة",
  supervisor: "المشرف",
  trainer: "المدرب",
  trainee: "المتدرب",
  consultant: "مقدم الاستشارة",
  accountant: "المحاسب",
  support: "فريق الدعم",
  content_manager: "مسؤول المحتوى",
  quality_manager: "مسؤول الجودة",
};

const navigation: NavigationItem[] = [
  { href: "/specialties", label: "المسارات التخصصية", icon: GraduationCap, group: "التعلم والتطوير" },
  { href: "/academy", label: "الأكاديمية والدورات", icon: BookOpen, group: "التعلم والتطوير" },
  { href: "/cases", label: "الحالات التدريبية", icon: Brain, group: "التعلم والتطوير" },
  { href: "/classrooms", label: "الفصول المباشرة", icon: CalendarDays, roles: ["admin", "platform_manager", "supervisor", "trainer", "trainee"], group: "التعلم والتطوير" },
  { href: "/assistant", label: "مساعد اتزان الذكي", icon: Sparkles, roles: ["admin", "platform_manager", "supervisor", "trainer", "trainee", "consultant", "content_manager", "quality_manager"], group: "الأدوات والتقييم" },
  { href: "/assessments", label: "المقاييس والاختبارات", icon: ClipboardCheck, group: "الأدوات والتقييم" },
  { href: "/simulation", label: "مختبر المحاكاة", icon: Brain, roles: ["admin", "platform_manager", "supervisor", "trainer", "trainee"], group: "الأدوات والتقييم" },
  { href: "/supervision", label: "الإشراف المباشر", icon: Users, roles: ["admin", "platform_manager", "supervisor", "trainer", "consultant"], group: "الأدوات والتقييم" },
  { href: "/competencies", label: "الكفاءات المهنية", icon: Activity, roles: ["admin", "platform_manager", "supervisor", "trainer", "trainee", "quality_manager"], group: "الأدوات والتقييم" },
  { href: "/consultations", label: "الاستشارات", icon: HeartHandshake, group: "الخدمات والمعرفة" },
  { href: "/books", label: "المكتبة العلمية", icon: Library, group: "الخدمات والمعرفة" },
  { href: "/tools", label: "النماذج المهنية", icon: FileText, group: "الخدمات والمعرفة" },
  { href: "/membership", label: "العضويات", icon: Award, group: "الخدمات والمعرفة" },
  { href: "/articles", label: "المقالات العلمية", icon: BookOpen, group: "الخدمات والمعرفة" },
  { href: "/community", label: "المجتمع المهني", icon: MessageSquare, group: "الخدمات والمعرفة" },
  { href: "/certificates", label: "الشهادات", icon: Award, group: "الخدمات والمعرفة" },
];

const navigationGroups = ["التعلم والتطوير", "الأدوات والتقييم", "الخدمات والمعرفة"];

function PlatformChrome({ sidebarOpen, onClose }: { sidebarOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SignedInUser | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (active && data.authenticated && data.user?.name && data.user?.email) {
          setUser({
            name: String(data.user.name),
            email: String(data.user.email),
            role: String(data.user.role || ""),
            sessionId: typeof data.user.sessionId === "string" ? data.user.sessionId : undefined,
          });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const isManager = user?.role === "admin" || user?.role === "platform_manager";
  const watermark = user ? user.name + " · " + user.email + (user.sessionId ? " · " + user.sessionId.slice(-6) : "") : "";
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <button
        type="button"
        className={"portal-sidebar-backdrop" + (sidebarOpen ? " is-visible" : "")}
        aria-label="إغلاق القائمة"
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={onClose}
      />
      <aside className={"portal-sidebar" + (sidebarOpen ? " is-open" : "")} aria-label="القائمة الرئيسية">
        <div className="portal-sidebar-header">
          <Link href="/" className="portal-sidebar-brand" onClick={onClose}>
            <span className="portal-sidebar-brand-icon"><Scale size={23}/></span>
            <span><strong>اتزان <small>| ETZAN</small></strong><em>من المعرفة إلى الممارسة</em></span>
          </Link>
          <button type="button" className="portal-sidebar-close" onClick={onClose} aria-label="إغلاق القائمة"><X size={18}/></button>
        </div>

        <div className="portal-sidebar-profile">
          <span className="portal-user-avatar">{user?.name?.trim().charAt(0) || "م"}</span>
          <span className="portal-user-details">
            <strong>{user?.name || "مساحة المستخدم"}</strong>
            <small>{roleLabels[user?.role || ""] || (user ? user.role : "مرحباً بك في اتزان")}</small>
          </span>
          <span className="portal-user-status" title="مساحة العمل"><i/></span>
        </div>

        <nav className="portal-side-nav" aria-label="أقسام المنصة">
          <Link href="/dashboard" onClick={onClose} className={"portal-side-link portal-dashboard-link" + (isActive("/dashboard") ? " active" : "")} aria-current={isActive("/dashboard") ? "page" : undefined}>
            <Home size={17}/><span>لوحة العمل</span>
          </Link>

          {navigationGroups.map((group) => {
            const items = navigation.filter((item) => item.group === group && (!item.roles || (user && item.roles.includes(user.role))));
            if (!items.length) return null;
            return (
              <div className="portal-side-group" key={group}>
                <p>{group}</p>
                {items.map(({ href, label, icon: Icon }) => (
                  <Link href={href} key={href} onClick={onClose} className={"portal-side-link" + (isActive(href) ? " active" : "")} aria-current={isActive(href) ? "page" : undefined}>
                    <Icon size={17}/><span>{label}</span>
                  </Link>
                ))}
              </div>
            );
          })}

          {isManager && <div className="portal-side-group portal-management-group"><p>الإدارة</p><Link href="/platform-admin" onClick={onClose} className={"portal-side-link" + (isActive("/platform-admin") ? " active" : "")}><ShieldCheck size={17}/><span>لوحة الإدارة</span></Link><Link href="/platform-admin/students" onClick={onClose} className={"portal-side-link" + (isActive("/platform-admin/students") ? " active" : "")}><GraduationCap size={17}/><span>الطلاب</span></Link></div>}
          {!user && <Link href="/login" onClick={onClose} className="portal-side-link portal-login-link"><LockKeyhole size={17}/><span>تسجيل الدخول</span></Link>}
        </nav>

        <div className="portal-sidebar-bottom">
          {user && <div className="portal-account-links"><Link href="/account/security" onClick={onClose}><ShieldCheck size={15}/> أمان الحساب</Link><Link href="/account/privacy" onClick={onClose}><LockKeyhole size={15}/> الخصوصية</Link></div>}
          <div className="portal-sidebar-caption"><span>اتزان | ETZAN</span><small>بيئة تعلم وتطوير مهني</small></div>
        </div>
      </aside>
      {user && <div className="etzan-session-watermark" aria-hidden="true"><span>{watermark}</span></div>}
    </>
  );
}

export function PlatformLayout({ title, eyebrow = "اتزان", description, children }: { title: string; eyebrow?: string; description: string; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <main className="portal-root" dir="rtl">
      <div className={"portal-shell" + (sidebarOpen ? " portal-shell-open" : "")}>
        <PlatformChrome sidebarOpen={sidebarOpen} onClose={closeSidebar}/>
        <div className="portal-main">
          <header className="portal-topbar">
            <div className="portal-topbar-start">
              <button type="button" className="portal-menu-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={sidebarOpen}>
                {sidebarOpen ? <X size={19}/> : <Menu size={19}/>}
              </button>
              <div className="portal-breadcrumb"><span>اتزان</span><b>/</b><strong>{title}</strong></div>
            </div>
            <Link href="/" className="portal-home-link"><Home size={16}/> <span>الصفحة الرئيسية</span></Link>
          </header>

          <div className="portal-content">
            <div className="portal-heading">
              <span>{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {children}
          </div>

          <footer className="portal-footer">
            <span>اتزان | ETZAN</span>
            <span>المحتوى والمحاكاة لأغراض التدريب المهني ولا تحل محل الممارسة المرخصة</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
