"use client";

import { useState } from "react";
import { CalendarDays, HeartHandshake, ShieldCheck, UserRoundCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import ConsultationBookingForm from "@/components/consultation-booking-form";

const services=[
 {id:"social-consultation",title:"استشارة في الخدمة الاجتماعية",description:"فهم الاحتياج الاجتماعي والموارد والإحالات وخيارات الدعم المجتمعي."},
 {id:"professional-consultation",title:"استشارة مهنية للأخصائيين",description:"مناقشة التوثيق ودراسة الحالة وحدود الدور المهني تحت إشراف مختص."},
 {id:"family-guidance",title:"إرشاد أسري وتوجيه الوالدين",description:"طلب موعد لمناقشة مهارات التواصل والدعم الأسري والتعامل مع الضغوط."},
 {id:"cbt-consultation",title:"طلب جلسة CBT مع مختص",description:"طلب تواصل مع مقدم خدمة مؤهل لتحديد ملاءمة الخدمة وخطواتها."},
];

export default function ConsultationsPage(){
  const [selected,setSelected]=useState(services[0].id);
  const active=services.find(item=>item.id===selected)!;
  return <PlatformLayout title="الاستشارات المهنية والإرشادية" description="اطلب تواصلاً مع مقدم خدمة مناسب في مجالات الخدمة الاجتماعية والإرشاد الأسري والتوجيه المهني والعلاج المعرفي السلوكي.">
    <div className="portal-callout"><ShieldCheck size={16}/> هذه الصفحة تستقبل طلبات التواصل والجدولة فقط؛ ليست خدمة طوارئ أو تشخيصاً آلياً. ستتم مراجعة الطلب وتحديد مقدم الخدمة ونطاقها قبل تأكيد الموعد.</div>
    <div style={{ display: "flex", justifyContent: "flex-start", margin: "12px 0 18px" }}><a className="portal-button secondary" href="/my-consultations" style={{ textDecoration: "none" }}><CalendarDays size={15}/> متابعة مواعيدي وحجوزاتي</a></div>
    <div className="portal-section-title"><div><h2>اختر مجال الاستشارة</h2><p>تحديد المجال يساعد فريق التنسيق على توجيه الطلب</p></div></div>
    <div className="portal-grid">
      {services.map(service=><button key={service.id} className={selected===service.id?"portal-card service-choice selected":"portal-card service-choice"} onClick={()=>setSelected(service.id)}><span className="service-choice-icon"><HeartHandshake size={18}/></span><h3>{service.title}</h3><p>{service.description}</p></button>)}
    </div>
    <section className="consultation-form-panel">
      <div className="portal-section-title"><div><h2>{active.title}</h2><p>{active.description}</p></div><UserRoundCheck size={21}/></div>
      <ConsultationBookingForm key={active.id} serviceId={active.id} title="حجز موعد تواصل أولي"/>
    </section>
  </PlatformLayout>;
}
