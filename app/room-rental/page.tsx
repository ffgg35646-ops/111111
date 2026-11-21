import { CalendarDays, Clock3, MonitorPlay, ShieldCheck, Users } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import PlatformRequestForm from "@/components/platform-request-form";

export default function RoomRentalPage(){
  return <PlatformLayout title="تأجير قاعات Zoom والفصول الافتراضية" description="اطلب قاعة لاجتماع تدريبي أو ورشة أو إشراف أو نشاط تعليمي، مع تحديد الموعد والمدة وعدد المشاركين.">
    <div className="portal-callout"><MonitorPlay size={16}/> تنسيق القاعة يتم عبر حساب Zoom مؤسسي. بعد مراجعة الطلب واعتماده، ينشئ المنسق الاجتماع ويرسل رابط الانضمام. رابط المضيف لا يشارك مع الحضور.</div>
    <div className="rental-feature-grid">
      <article><Users size={19}/><strong>أعداد مختلفة</strong><span>حدد عدد المشاركين المتوقع.</span></article>
      <article><Clock3 size={19}/><strong>مدد مرنة</strong><span>من 30 إلى 240 دقيقة لكل طلب.</span></article>
      <article><ShieldCheck size={19}/><strong>غرفة انتظار</strong><span>إعدادات دخول منظمة وموافقة المضيف.</span></article>
    </div>
    <PlatformRequestForm kind="room_rental" title="طلب استئجار قاعة افتراضية" description="املأ البيانات الأساسية وسيتواصل معك منسق القاعات لتأكيد التوفر والتكلفة." fields={[
      {name:"preferredAt",label:"موعد بدء القاعة",type:"datetime-local",required:true},
      {name:"durationMinutes",label:"المدة بالدقائق",type:"number",required:true,min:30,max:240,placeholder:"60"},
      {name:"attendees",label:"عدد المشاركين المتوقع",type:"number",required:true,min:2,max:500,placeholder:"20"},
      {name:"roomPurpose",label:"الغرض من القاعة",type:"textarea",placeholder:"ورشة تدريبية، إشراف أكاديمي، فصل افتراضي..."},
    ]} submitLabel="إرسال طلب حجز القاعة"/>
    <div className="portal-section-title"><div><h2>التهيئة التقنية</h2><p>تحتاج الإدارة لإعداد بيانات Zoom مرة واحدة على الخادم</p></div><CalendarDays size={20}/></div>
    <div className="portal-card"><p>بعد إعداد Server-to-Server OAuth وتحديد حساب المضيف يمكن للمسؤول إنشاء الاجتماع من نقطة الإدارة المحمية ثم ربط رابط الانضمام بالطلب الموافق عليه. تفاصيل الإعداد في دليل الخدمات التقنية.</p></div>
  </PlatformLayout>;
}
