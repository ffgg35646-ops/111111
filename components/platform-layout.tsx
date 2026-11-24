"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

type SignedInUser = { name: string; email: string; role: string; sessionId?: string };
type NavigationItem = { href: string; label: string; roles?: string[] };

const navigation: NavigationItem[] = [
  { href: "/specialties", label: "المسارات التخصصية" },
  { href: "/academy", label: "الأكاديمية" },
  { href: "/cases", label: "الحالات التدريبية" },
  { href: "/assistant", label: "مساعد اتزان", roles: ["admin", "platform_manager", "supervisor", "trainer", "trainee", "consultant", "content_manager", "quality_manager"] },
  { href: "/assessments", label: "المقاييس والاختبارات" },
  { href: "/classrooms", label: "الفصول المباشرة", roles: ["admin", "platform_manager", "supervisor", "trainer", "trainee"] },
  { href: "/consultations", label: "الاستشارات" },
  { href: "/books", label: "المكتبة العلمية" },
  { href: "/tools", label: "النماذج المهنية" },
  { href: "/membership", label: "العضويات" },
  { href: "/articles", label: "المقالات العلمية" },
  { href: "/community", label: "المجتمع المهني" },
  { href: "/certificates", label: "الشهادات" },
  { href: "/simulation", label: "المحاكاة", roles: ["admin", "platform_manager", "supervisor", "trainer", "trainee"] },
  { href: "/supervision", label: "الإشراف المباشر", roles: ["admin", "platform_manager", "supervisor", "trainer", "consultant"] },
  { href: "/competencies", label: "الكفاءات المهنية", roles: ["admin", "platform_manager", "supervisor", "trainer", "trainee", "quality_manager"] },
];

function PlatformChrome() {
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

  const visibleNavigation = navigation.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const isManager = user?.role === "admin" || user?.role === "platform_manager";
  const watermark = user ? user.name + " · " + user.email + (user.sessionId ? " · " + user.sessionId.slice(-6) : "") : "";

  return (
    <>
      <nav className="portal-nav" aria-label="التنقل الرئيسي">
        {user && <Link href="/dashboard">لوحة العمل</Link>}
        {user && <Link href="/account/security">أمان الحساب</Link>}
        {user && <Link href="/account/privacy">الخصوصية</Link>}
        {visibleNavigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        {!user && <Link href="/login">تسجيل الدخول</Link>}
      </nav>
      {isManager && <Link href="/platform-admin" className="portal-admin-link">لوحة الإدارة</Link>}
      {user && <div className="etzan-session-watermark" aria-hidden="true"><span>{watermark}</span></div>}
    </>
  );
}

export function PlatformLayout({ title, eyebrow = "اتزان", description, children }: { title: string; eyebrow?: string; description: string; children: ReactNode }) {
  return (
    <main className="portal-root" dir="rtl">
      <header className="portal-topbar">
        <Link href="/" className="portal-brand">
          <span><strong>اتزان | ETZAN</strong><small>من المعرفة إلى الممارسة</small></span>
        </Link>
        <PlatformChrome />
      </header>
      <div className="portal-content">
        <div className="portal-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
        {children}
      </div>
      <footer className="portal-footer"><span>اتزان | ETZAN</span><span>المحتوى والمحاكاة لأغراض التدريب المهني ولا تحل محل الممارسة المرخصة</span></footer>
    </main>
  );
}
