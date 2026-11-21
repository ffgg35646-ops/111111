"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpLeft, BookOpen, Brain, FileBadge, GraduationCap, HeartHandshake, Library, Video } from "lucide-react";

const navigation = [
  { href: "/academy", label: "الأكاديمية", icon: GraduationCap },
  { href: "/cases", label: "الحالات التدريبية", icon: Brain },
  { href: "/classrooms", label: "فصول Zoom", icon: Video },
  { href: "/consultations", label: "الاستشارات", icon: HeartHandshake },
  { href: "/books", label: "الكتب", icon: Library },
  { href: "/certificates", label: "الشهادات", icon: FileBadge },
];

export function PlatformLayout({
  title,
  eyebrow = "منصة التعلم والتدريب والاستشارات",
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="portal-root" dir="rtl">
      <header className="portal-topbar">
        <Link href="/" className="portal-brand"><span className="portal-brand-mark"><BookOpen size={20}/></span><span><strong>منصة التدريب المهني</strong><small>تعلم · ممارسة · إشراف</small></span></Link>
        <nav className="portal-nav">
          {navigation.map(({href,label,icon:Icon})=><Link href={href} key={href}><Icon size={15}/>{label}</Link>)}
        </nav>
        <Link href="/" className="portal-admin-link">لوحة الإدارة <ArrowUpLeft size={15}/></Link>
      </header>
      <div className="portal-content">
        <div className="portal-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
        {children}
      </div>
      <footer className="portal-footer"><span>منصة التدريب والتأهيل المهني</span><span>المحتوى التدريبي لا يحل محل الممارسة المهنية المرخصة</span></footer>
    </main>
  );
}
