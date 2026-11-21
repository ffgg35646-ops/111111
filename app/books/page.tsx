"use client";

import { useState } from "react";
import { BookOpen, ShoppingBag } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import PlatformRequestForm from "@/components/platform-request-form";

const books=[
 {id:"book-social-case",title:"دليل دراسة الحالة في الخدمة الاجتماعية",category:"الخدمة الاجتماعية",description:"مادة تعليمية مقترحة لتنظيم المقابلة والتاريخ الاجتماعي وخطة التدخل.",format:"كتاب تدريبي"},
 {id:"book-cbt-practice",title:"دفتر تطبيقات العلاج المعرفي السلوكي",category:"CBT",description:"أوراق عمل تعليمية لنموذج ABC وسجل الأفكار والتجارب السلوكية.",format:"دفتر تمارين"},
 {id:"book-autism-support",title:"دليل التواصل والدعم للأسر",category:"التوحد",description:"مادة إرشادية عن التواصل الداعم والاحتياجات الحسية والشراكة مع الأسرة.",format:"دليل عملي"},
 {id:"book-developmental",title:"مدخل إلى التقدير النمائي والمهارات التكيفية",category:"الاضطرابات النمائية",description:"مفاهيم تدريبية لفهم التاريخ النمائي والأداء التكيفي وحدود التقييم.",format:"كتاب تدريبي"},
 {id:"book-scales",title:"مرشد قراءة المقاييس النفسية والنمائية",category:"المقاييس والتقييم",description:"مبادئ الصدق والثبات والمعايير وحقوق استخدام أدوات القياس.",format:"مرجع تعليمي"},
];
export default function BooksPage(){
  const [bookId,setBookId]=useState(books[0].id);
  const active=books.find(book=>book.id===bookId)!;
  return <PlatformLayout title="المكتبة والمتجر المعرفي" description="كتالوج للكتب والأدلة والمواد التعليمية المرتبطة بالخدمة الاجتماعية والصحة النفسية والتوحد والقياس.">
    <div className="portal-callout"><ShoppingBag size={16}/> أرسل طلب الكتاب وسيتحقق فريق المتجر من توفر النسخة والسعر ووسيلة التسليم قبل تأكيد الطلب. الدفع الإلكتروني والمخزون والشحن الآلي لم يتم ربطها بعد.</div>
    <div className="portal-grid">
      {books.map(book=><article className="portal-card book-card" key={book.id}>
        <div className="book-cover"><BookOpen size={30}/><span>{book.category}</span></div>
        <span className="portal-chip">{book.format}</span><h3>{book.title}</h3><p>{book.description}</p>
        <button className="portal-button secondary" onClick={()=>setBookId(book.id)}>طلب هذه المادة</button>
      </article>)}
    </div>
    <section className="book-order-panel">
      <div className="portal-section-title"><div><h2>طلب شراء</h2><p>{active.title}</p></div></div>
      <PlatformRequestForm key={active.id} kind="book_order" title="بيانات طلب الكتاب" initialData={{items:[{bookId:active.id,quantity:1}]}} fields={[
        {name:"deliveryRegion",label:"المدينة / منطقة التسليم",type:"text",placeholder:"اكتب المدينة"},
        {name:"orderNote",label:"ملاحظة للطلب (اختياري)",type:"textarea",placeholder:"عدد النسخ أو تفضيل طريقة التواصل."},
      ]} submitLabel="إرسال طلب الشراء"/>
    </section>
  </PlatformLayout>;
}
