"use client";

import { useState } from "react";
import { BadgeCheck, FileBadge, Printer, Search, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Certificate={serial:string;learnerName:string;courseTitle:string;issuedAt:string;certificateType:string};

export default function CertificatesPage(){
  const [code,setCode]=useState("");
  const [certificate,setCertificate]=useState<Certificate|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const verify=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setLoading(true);setError("");setCertificate(null);
    try{
      const response=await fetch(`/api/platform/certificates?code=${encodeURIComponent(code.trim().toUpperCase())}`,{cache:"no-store"});
      const result=await response.json();
      if(!response.ok||!result.valid)throw new Error(result.error||"الشهادة غير موجودة.");
      setCertificate(result.certificate);
    }catch(cause){setError(cause instanceof Error?cause.message:"تعذر التحقق من الشهادة.");}
    finally{setLoading(false);}
  };
  return <PlatformLayout title="شهادات الشكر والتقدير والتحقق" description="تتيح المنصة إصدار شهادة شكر بعد اعتماد إكمال المتطلبات التدريبية من الإدارة، والتحقق من صحة الشهادة باستخدام رمزها.">
    <div className="portal-callout"><ShieldCheck size={16}/> لا تُصدر شهادة لمجرد التسجيل. يجب أن تعتمد الإدارة حضور المتدرب وإكمال المتطلبات أولاً، والشهادة التدريبية لا تعني ترخيصاً مهنياً أو مؤهلاً أكاديمياً ما لم تصرح الجهة بذلك.</div>
    <section className="certificate-verify-card">
      <div><FileBadge size={24}/><h2>التحقق من شهادة</h2><p>أدخل رمز التحقق الموجود على الشهادة.</p></div>
      <form onSubmit={verify}><input required value={code} onChange={event=>setCode(event.target.value)} placeholder="رمز الشهادة"/><button disabled={loading}>{loading?"جارٍ التحقق...":<><Search size={15}/> تحقق</>}</button></form>
      {error&&<p className="certificate-error">{error}</p>}
    </section>
    {certificate&&<section className="certificate-result">
      <div className="certificate-paper">
        <div className="certificate-border">
          <span>منصة التدريب والتأهيل المهني</span><BadgeCheck size={35}/><h2>شهادة شكر وتقدير</h2>
          <p>تُمنح هذه الشهادة إلى</p><h3>{certificate.learnerName}</h3><p>تقديراً لإتمامه متطلبات البرنامج التدريبي</p><h4>{certificate.courseTitle}</h4>
          <small>تاريخ الإصدار: {new Date(certificate.issuedAt).toLocaleDateString("ar-EG")}</small><b>رمز التحقق: {certificate.serial}</b>
          <span className="certificate-verified"><ShieldCheck size={14}/> شهادة صادرة ومسجلة في قاعدة بيانات المنصة</span>
        </div>
      </div>
      <button className="portal-button" onClick={()=>window.print()}><Printer size={15}/> طباعة الشهادة</button>
    </section>}
    <div className="portal-card"><h3>إصدار الشهادات</h3><p>تتم عملية الإصدار من خلال واجهة إدارية محمية بمفتاح خادمي، وبعد توثيق إكمال البرنامج. لا يتاح إصدار شهادة ذاتية من هذه الصفحة.</p></div>
  </PlatformLayout>;
}
