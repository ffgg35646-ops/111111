"use client";

import Link from "next/link";
import { CreditCard, ShieldAlert } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

export default function AdminSubscriptionsPage(){
 return <PlatformLayout title="إدارة الاشتراكات والعضويات" description="متابعة حالة جاهزية نظام العضويات وخطط الاشتراك قبل إتاحة التحصيل المتكرر.">
  <section className="portal-card" style={{maxWidth:900}}>
   <div style={{display:"flex",alignItems:"center",gap:10}}><ShieldAlert color="#a77c3c"/><strong>الاشتراكات المتكررة غير مفعّلة</strong></div>
   <p style={{fontSize:11,lineHeight:2,color:"#71848c"}}>المنصة تعرض باقات عضوية تعريفية، لكن لا يوجد حتى الآن سجل اشتراكات فعّال أو دورة فوترة تلقائية أو تجديد أو إلغاء ذاتي أو تحصيل متكرر. لذلك لن تعرض هذه اللوحة اشتراكات نشطة غير موجودة ولن تنفّذ خصماً أو تجديداً.</p>
   <div className="portal-chip-row"><span className="portal-chip">الباقات: عرض تعريفي</span><span className="portal-chip">التجديد التلقائي: غير متاح</span><span className="portal-chip">الإلغاء والاسترداد: غير مربوط بالاشتراك</span></div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}><Link className="portal-button secondary" href="/membership"><CreditCard size={14}/> معاينة الباقات</Link><Link className="portal-button secondary" href="/platform-admin/payments">سجل المدفوعات</Link></div>
  </section>
 </PlatformLayout>
}
