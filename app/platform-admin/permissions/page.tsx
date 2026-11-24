"use client";

import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

const roles=[
 ["admin","مدير النظام","إدارة شاملة للحسابات والإعدادات والعمليات الحساسة."],
 ["platform_manager","مدير المنصة","تشغيل وحدات المنصة وإدارة الحسابات التشغيلية دون إدارة حساب مدير النظام."],
 ["supervisor","المشرف","مراجعة المحاكاة والتقييمات والإشراف ومراجعة المجتمع حسب واجهات الخدمة."],
 ["trainer","المدرب","إدارة الدورات المسندة والاختبارات والحضور ونتائج متدربيه."],
 ["trainee","المتدرب","التعلم والاختبارات والتقدم والشهادات الخاصة به."],
 ["consultant","مقدم الاستشارة","إدارة المواعيد والخدمات والحجوزات المسندة إليه."],
 ["accountant","المحاسب","الاطلاع على سجل المدفوعات ومهام المتابعة المالية المسموح بها."],
 ["support","فريق الدعم","دعم المستخدمين ومتابعة الطلبات وفق الواجهات المصرح بها."],
 ["content_manager","مسؤول المحتوى","إدارة المقالات والمكتبة العلمية."],
 ["quality_manager","مسؤول الجودة","مراجعة مؤشرات الجودة والمجتمع والتقارير المصرح بها."]
] as const;

export default function AdminPermissionsPage(){
 return <PlatformLayout title="إدارة الصلاحيات والأدوار" description="مرجع الأدوار العشرة المستخدمة في المنصة، مع الانتقال إلى إدارة الحسابات لإسناد الدور للحساب.">
  <div className="portal-callout"><ShieldCheck size={15}/> الصلاحيات مفروضة على الخادم عبر حواجز الأدوار في واجهات API، وليست مجرد إخفاء عناصر في الشاشة. مدير المنصة لا يمكنه إنشاء مدير نظام أو ترقية حساب إلى هذا الدور.</div>
  <div className="portal-section-title"><div><h2>الأدوار المعتمدة</h2><p>{roles.length} أدوار تشغيلية</p></div><Link className="portal-button" href="/platform-admin/users"><Users size={14}/> إدارة حسابات المستخدمين</Link></div>
  <div style={{display:"grid",gap:9}}>{roles.map(([id,title,description])=><article className="portal-card" key={id} style={{display:"grid",gridTemplateColumns:"minmax(150px,0.6fr) minmax(0,1.4fr)",gap:12,alignItems:"center"}}><div><strong>{title}</strong><small style={{display:"block",marginTop:4,color:"#8a999f",direction:"ltr",textAlign:"right"}}>{id}</small></div><p>{description}</p></article>)}</div>
  <section className="portal-card" style={{marginTop:15}}><h3>حدود إدارة الصلاحيات الحالية</h3><p style={{fontSize:10,lineHeight:1.9,color:"#7b8d94"}}>يمكن تعيين أحد الأدوار أعلاه أو تعطيل الحساب من صفحة إدارة المستخدمين. مصفوفة مخصصة لتغيير صلاحية كل عملية على حدة (عرض/إضافة/تعديل/حذف/اعتماد) لم تُفعّل بعد؛ تظل قواعد الخادم الحالية هي المرجع ولا يمكن تغييرها من هذه الشاشة.</p><Link className="portal-link-button secondary" href="/platform-admin/users">فتح إدارة المستخدمين والأدوار</Link></section>
 </PlatformLayout>
}
