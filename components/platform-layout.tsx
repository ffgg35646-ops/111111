"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notification-bell";
import {
  Activity, Award, BookOpen, Brain, CalendarDays, ClipboardCheck,
  FileText, GraduationCap, HeartHandshake, Home, Library, LockKeyhole,
  LogOut, Menu, MessageSquare, Scale, ShieldCheck, Sparkles, Users, X,
  type LucideIcon,
} from "lucide-react";

type SignedInUser = { name: string; email: string; role: string; sessionId?: string; avatarDataUrl?: string; permissions?: string[] };
type SiteBranding = { clinicName: string; logoName: string; logoImage: string };
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
  sub_admin: "أدمن فرعي",
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
  const router = useRouter();
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [branding, setBranding] = useState<SiteBranding>({clinicName:"اتزان",logoName:"ETZAN",logoImage:"/etzan-symbol.svg"});

  useEffect(() => {
    let active = true;
    fetch("/api/site-branding", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (active && data) setBranding({ clinicName: String(data.clinicName || "اتزان"), logoName: String(data.logoName || "ETZAN"), logoImage: String(data.logoImage || "/etzan-symbol.svg") }); }).catch(() => {});
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
            permissions: Array.isArray(data.user.permissions) ? data.user.permissions.filter((item: unknown): item is string => typeof item === "string") : [],
          });
          fetch("/api/account/profile", { cache: "no-store" }).then((profileResponse) => profileResponse.ok ? profileResponse.json() : null).then((profileData) => {
            if (active && profileData?.profile?.avatarDataUrl) setUser((current) => current ? { ...current, avatarDataUrl: String(profileData.profile.avatarDataUrl) } : current);
          }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const isManager = user?.role === "admin" || user?.role === "platform_manager";
  const canEditSite = isManager || user?.role === "sub_admin";
  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    catch { /* The login route also clears a stale local session on the next request. */ }
    router.replace("/login");
    router.refresh();
  }
  const canManageSpecialistTracks = isManager || (user?.role === "sub_admin" && user.permissions?.includes("specialist_tracks") === true);
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
            <span className="portal-sidebar-brand-icon">{branding.logoImage ? <img src={branding.logoImage} alt="" style={{ width: 27, height: 27, objectFit: "contain" }}/> : <Scale size={23}/>}</span>
            <span><strong>{branding.clinicName} <small>| {branding.logoName}</small></strong><em>من المعرفة إلى الممارسة</em></span>
          </Link>
          <button type="button" className="portal-sidebar-close" onClick={onClose} aria-label="إغلاق القائمة"><X size={18}/></button>
        </div>

        <div className="portal-sidebar-profile">
          <span className="portal-user-avatar">{user?.avatarDataUrl ? <img src={user.avatarDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}/> : user?.name?.trim().charAt(0) || "م"}</span>
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
          {user?.role === "trainee" && <Link href="/support" onClick={onClose} className={"portal-side-link" + (isActive("/support") ? " active" : "")}><MessageSquare size={17}/><span>الدعم الفني</span></Link>}
          {user && ["admin", "platform_manager", "support"].includes(user.role) && <Link href="/platform-admin/support" onClick={onClose} className={"portal-side-link" + (isActive("/platform-admin/support") ? " active" : "")}><MessageSquare size={17}/><span>تذاكر دعم الطلاب</span></Link>}

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

          {canEditSite && <div className="portal-side-group portal-management-group"><p>إدارة المحتوى</p>{isManager && <Link href="/platform-admin" onClick={onClose} className={"portal-side-link" + (isActive("/platform-admin") ? " active" : "")}><ShieldCheck size={17}/><span>لوحة الإدارة</span></Link>}<Link href="/platform-admin/site-content" onClick={onClose} className={"portal-side-link" + (isActive("/platform-admin/site-content") ? " active" : "")}><FileText size={17}/><span>صفحات الموقع</span></Link>{canManageSpecialistTracks && <Link href="/platform-admin/specialist-tracks" onClick={onClose} className={"portal-side-link" + (isActive("/platform-admin/specialist-tracks") ? " active" : "")}><GraduationCap size={17}/><span>إدارة المسارات المهنية</span></Link>}</div>}
          {!user && <Link href="/login" onClick={onClose} className="portal-side-link portal-login-link"><LockKeyhole size={17}/><span>تسجيل الدخول</span></Link>}
        </nav>

        <div className="portal-sidebar-bottom">
          {user && <div className="portal-account-links"><Link href="/account/profile" onClick={onClose}><Users size={15}/> الملف الشخصي</Link><Link href="/account/security" onClick={onClose}><ShieldCheck size={15}/> أمان الحساب</Link><Link href="/account/privacy" onClick={onClose}><LockKeyhole size={15}/> الخصوصية</Link></div>}
          {user && pathname === "/dashboard" && <button type="button" className="portal-logout-button" onClick={() => void logout()}><LogOut size={15}/> تسجيل الخروج</button>}
          <div className="portal-sidebar-caption"><span>{branding.clinicName} | {branding.logoName}</span><small>بيئة تعلم وتطوير مهني</small></div>
        </div>
      </aside>
      {user && <div className="etzan-session-watermark" aria-hidden="true"><span>{watermark}</span></div>}
    </>
  );
}

export function PlatformLayout({ title, eyebrow = "اتزان", description, children, headerContent }: { title: string; eyebrow?: string; description: string; children: ReactNode; headerContent?: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [branding, setBranding] = useState<SiteBranding>({clinicName:"اتزان",logoName:"ETZAN",logoImage:"/etzan-symbol.svg"});
  useEffect(() => { fetch("/api/site-branding", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (data) setBranding({clinicName:String(data.clinicName||"اتزان"),logoName:String(data.logoName||"ETZAN"),logoImage:String(data.logoImage||"/etzan-symbol.svg")}); }).catch(() => {}); }, []);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <main className={"portal-root" + (pathname === "/dashboard" ? " etzan-member-dashboard" : "")} dir="rtl">
      <div className={"portal-shell" + (sidebarOpen ? " portal-shell-open" : "")}>
        <PlatformChrome sidebarOpen={sidebarOpen} onClose={closeSidebar}/>
        <div className="portal-main">
          <header className="portal-topbar">
            <div className="portal-topbar-start">
              <button type="button" className="portal-menu-toggle" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={sidebarOpen}>
                {sidebarOpen ? <X size={19}/> : <Menu size={19}/>}
              </button>
              <div className="portal-breadcrumb"><span>{branding.clinicName}</span><b>/</b><strong>{title}</strong></div>
            </div>
            <div className="portal-topbar-actions">{headerContent}<NotificationBell/><Link href="/" className="portal-home-link"><Home size={16}/> <span>الصفحة الرئيسية</span></Link></div>
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
            <span>{branding.clinicName} | {branding.logoName}</span>
            <span>المحتوى والمحاكاة لأغراض التدريب المهني ولا تحل محل الممارسة المرخصة</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
