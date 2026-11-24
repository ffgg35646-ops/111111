"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, ArrowUpLeft, BookOpen, Brain, ClipboardList, FileBadge, Glasses, GraduationCap, HeartHandshake, LayoutDashboard, Library, ShieldCheck, Video, Users, Newspaper, Sparkles } from "lucide-react";
const navigation=[
{href:"/specialties",label:"المسارات التخصصية",icon:Brain},{href:"/academy",label:"الأكاديمية",icon:GraduationCap},
{href:"/cases",label:"الحالات التدريبية",icon:Brain},{href:"/assistant",label:"مساعد اتزان الذكي",icon:Sparkles},{href:"/assessments",label:"المقاييس والاختبارات",icon:ClipboardList},
{href:"/classrooms",label:"الفصول المباشرة",icon:Video},{href:"/consultations",label:"الاستشارات",icon:HeartHandshake},
{href:"/books",label:"المكتبة العلمية والكتب",icon:Library},{href:"/tools",label:"النماذج المهنية",icon:ClipboardList},
{href:"/membership",label:"العضويات",icon:ShieldCheck},{href:"/articles",label:"المقالات العلمية",icon:Newspaper},
{href:"/community",label:"المجتمع المهني",icon:Users},{href:"/certificates",label:"الشهادات",icon:FileBadge},
{href:"/simulation",label:"محاكاة VR",icon:Glasses},{href:"/supervision",label:"الإشراف المباشر",icon:Activity},
{href:"/competencies",label:"الكفاءات المهنية",icon:ShieldCheck},{href:"/login",label:"تسجيل الدخول",icon:ShieldCheck}
];
type SignedInUser={name:string;email:string;role:string;sessionId?:string};
function PlatformChrome(){
 const [user,setUser]=useState<SignedInUser|null>(null),[stamp,setStamp]=useState("");
 useEffect(()=>{
  let active=true;const update=()=>{if(active)setStamp(new Date().toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}))};update();
  const interval=window.setInterval(update,60000);
  fetch("/api/auth/session",{cache:"no-store"}).then(async response=>{if(!response.ok)return;const data=await response.json();if(active&&data.authenticated&&data.user?.name&&data.user?.email)setUser({name:String(data.user.name),email:String(data.user.email),role:String(data.user.role||""),sessionId:typeof data.user.sessionId==="string"?data.user.sessionId:undefined})}).catch(()=>{});
  return()=>{active=false;window.clearInterval(interval)};
 },[]);
 const watermark=user?user.name+" · "+user.email+" · "+(user.sessionId?user.sessionId.slice(-6):"جلسة")+" · "+stamp:"";
 return <>
  <nav className="portal-nav">
   {user&&<Link href="/dashboard"><LayoutDashboard size={15}/>لوحة العمل</Link>}
   {user&&<Link href="/account/security"><ShieldCheck size={15}/>أمان الحساب</Link>}
   {user&&<Link href="/account/privacy"><FileBadge size={15}/>طلباتي للخصوصية</Link>}
   {navigation.map(({href,label,icon:Icon})=><Link href={href} key={href}><Icon size={15}/>{label}</Link>)}
  </nav>
  <Link href="/platform-admin" className="portal-admin-link">لوحة الإدارة <ArrowUpLeft size={15}/></Link>
  {user&&<div className="etzan-session-watermark" aria-hidden="true"><span>{watermark}</span><span>{watermark}</span><span>{watermark}</span><span>{watermark}</span></div>}
 </>;
}
export function PlatformLayout({title,eyebrow="اتزان | من المعرفة إلى الممارسة",description,children}:{title:string;eyebrow?:string;description:string;children:ReactNode}){
 return <main className="portal-root" dir="rtl">
  <header className="portal-topbar"><Link href="/" className="portal-brand"><span className="portal-brand-mark"><BookOpen size={20}/></span><span><strong>اتزان | ETZAN</strong><small>من المعرفة إلى الممارسة</small></span></Link><PlatformChrome/></header>
  <div className="portal-content"><div className="portal-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children}</div>
  <footer className="portal-footer"><span>اتزان | ETZAN</span><span>المحتوى والمحاكاة لأغراض التدريب المهني ولا تحل محل الممارسة المرخصة</span></footer>
 </main>;
}
