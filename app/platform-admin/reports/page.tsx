"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Award, BookOpen, CalendarDays, ChartNoAxesCombined, ClipboardCheck, FileText, RefreshCw, ShoppingBag, Users } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Data={generatedAt:string;totals:Record<string,number>;capability:Record<string,boolean|string>};
const sections=[
 {title:"المستخدمون والتدريب",items:[["إجمالي الحسابات","usersTotal",Users],["الحسابات النشطة","usersActive",Users],["المتدربون النشطون","trainees",Users],["الدورات المدرجة","courses",BookOpen],["أدوات التقدير التدريبية","practiceScales",ClipboardCheck],["سجلات التقدم والمحاكاة","simulationReports",Activity]]},
 {title:"المحتوى والمنتجات",items:[["المقالات المسجلة","articlesTotal",FileText],["المقالات المنشورة","publishedArticles",FileText],["الكتب والمنتجات","booksTotal",ShoppingBag],["الكتب المنشورة","publishedBooks",ShoppingBag],["النماذج المهنية المحفوظة","professionalForms",ClipboardCheck]]},
 {title:"الخدمات والتشغيل",items:[["الطلبات قيد المراجعة","pendingRequests",ClipboardCheck],["طلبات الاستشارات","consultationRequests",CalendarDays],["الاستشارات المدفوعة والمعتمدة","paidConsultations",CalendarDays],["المواعيد المفتوحة","openConsultantSlots",CalendarDays],["الجلسات المباشرة","scheduledSessions",CalendarDays],["سجلات الحضور","attendanceRecords",Users]]},
 {title:"المالية والحوكمة",items:[["عمليات الدفع المؤكدة","paidPayments",ChartNoAxesCombined],["إجمالي عمليات الدفع","paymentTotal",ChartNoAxesCombined],["الشهادات السارية","issuedCertificates",Award],["الشهادات الملغاة","revokedCertificates",Award],["البلاغات المفتوحة","openCommunityReports",ClipboardCheck],["المشاركات المنتظرة","pendingCommunityPosts",ClipboardCheck]]}
] as const;
const links=[["إدارة الحسابات","/platform-admin/users"],["الدورات","/platform-admin/courses"],["المحتوى","/platform-admin/content"],["الكتب والمنتجات","/platform-admin/books"],["المدفوعات","/platform-admin/payments"],["الشهادات","/platform-admin/certificates"],["المجتمع والبلاغات","/platform-admin/community"],["تقارير المحاكاة","/platform-admin/activities"]] as const;
export default function AdminReportsPage(){
 const [data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){setError("");try{const r=await fetch("/api/platform/admin/overview",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر تحميل الإحصائيات.");setData(d)}catch(e){setError(e instanceof Error?e.message:"تعذر تحميل الإحصائيات.")}}
 useEffect(()=>{let active=true;fetch("/api/platform/admin/overview",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setData(d)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"تعذر تحميل الإحصائيات.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return <PlatformLayout title="التقارير والإحصائيات" description="ملخص تشغيلي من سجلات قاعدة البيانات، يتم تحديثه عند الطلب ولا يعتمد على أرقام تجريبية.">
  <div className="portal-section-title"><div><h2><ChartNoAxesCombined size={17}/> مؤشرات المنصة</h2><p>{data?.generatedAt?("آخر تحديث: "+new Date(data.generatedAt).toLocaleString("ar-EG")):""}</p></div><button className="portal-button secondary" onClick={()=>void load()}><RefreshCw size={14}/> تحديث الإحصائيات</button></div>
  {error&&<p role="alert" style={{color:"#a44",fontSize:11}}>{error}</p>}
  {loading?<div className="portal-empty">جارٍ تحميل مؤشرات الأداء...</div>:data&&sections.map(section=><section key={section.title} style={{marginBottom:18}}>
    <div className="portal-section-title"><div><h2>{section.title}</h2></div></div>
    <div className="portal-grid">{section.items.map(([label,key,Icon])=><article className="portal-card" key={key}><div style={{display:"flex",alignItems:"center",gap:8,color:"#218579"}}><Icon size={16}/><span style={{fontSize:9,color:"#7b8e95"}}>{label}</span></div><strong style={{display:"block",fontSize:23,color:"#304e59",marginTop:10}}>{Number(data.totals[key]||0).toLocaleString("ar-SA")}</strong></article>)}</div>
  </section>)}
  <section className="portal-card" style={{marginTop:14}}><h3>وظائف غير مفعّلة بعد</h3><div className="portal-chip-row"><span className="portal-chip">{data?.capability.recurringSubscriptions?"الاشتراكات المتكررة مفعلة":"الاشتراكات المتكررة غير مفعلة"}</span><span className="portal-chip">{data?.capability.electronicInvoicing?"الفواتير الإلكترونية مفعلة":"الفواتير الإلكترونية غير مفعلة"}</span><span className="portal-chip">{data?.capability.courseCatalogEditing?"تحرير الدورات من اللوحة متاح":"تحرير محتوى الدورات من اللوحة غير متاح"}</span><span className="portal-chip">{data?.capability.licensedScaleEditing?"تحرير المقاييس المرخصة متاح":"تحرير المقاييس المرخصة غير متاح"}</span></div></section>
  <div className="portal-section-title"><div><h2>الانتقال إلى التقارير التشغيلية</h2></div></div>
  <div className="portal-chip-row">{links.map(([label,href])=><Link className="portal-link-button secondary" href={href} key={href}>{label}</Link>)}</div>
 </PlatformLayout>
}
