"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { BadgeCheck, FileBadge, Printer, Search, ShieldCheck, Award, LockKeyhole } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Certificate={serial:string;learnerName:string;courseTitle:string;issuedAt:string;certificateType:string};

export default function CertificatesPage(){
  const [code,setCode]=useState("");
  const [certificate,setCertificate]=useState<Certificate|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [verificationUrl,setVerificationUrl]=useState("");
  const [learnerName,setLearnerName]=useState("");
  const [courseTitle,setCourseTitle]=useState("");
  const [completionVerified,setCompletionVerified]=useState(false);
  const [issueError,setIssueError]=useState("");
  const [issueSuccess,setIssueSuccess]=useState("");
  const [issuing,setIssuing]=useState(false);

  useEffect(()=>{
    const value=new URLSearchParams(window.location.search).get("code");
    if(!value)return;
    setCode(value);setLoading(true);
    fetch(`/api/platform/certificates?code=${encodeURIComponent(value.trim().toUpperCase())}`,{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok||!result.valid)throw new Error(result.error||"الشهادة غير موجودة.");setCertificate(result.certificate)}).catch(cause=>setError(cause instanceof Error?cause.message:"تعذر التحقق من الشهادة.")).finally(()=>setLoading(false));
  },[]);

  const issueCertificate=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setIssuing(true);setIssueError("");setIssueSuccess("");
    try{
      const response=await fetch("/api/platform/certificates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({learnerName,courseTitle,certificateType:"appreciation",completionVerified})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"تعذر إصدار الشهادة.");
      setIssueSuccess(result.certificate.serial);
      setCode(result.certificate.serial);
      setCertificate(result.certificate);
      setLearnerName("");setCourseTitle("");setCompletionVerified(false);
    }catch(cause){setIssueError(cause instanceof Error?cause.message:"تعذر إصدار الشهادة.");}
    finally{setIssuing(false);}
  };

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
  useEffect(()=>{if(certificate&&typeof window!=="undefined")setVerificationUrl(`${window.location.origin}/certificates?code=${encodeURIComponent(certificate.serial)}`)},[certificate]);

  return <PlatformLayout title="شهادات الشكر والتقدير والتحقق" description="تتيح المنصة إصدار شهادة شكر بعد اعتماد إكمال المتطلبات التدريبية من الإدارة، والتحقق من صحة الشهادة باستخدام رمزها.">
    <div className="portal-callout"><ShieldCheck size={16}/> لا تُصدر شهادة لمجرد التسجيل. يجب أن تعتمد الإدارة حضور المتدرب وإكمال المتطلبات أولاً، والشهادة التدريبية لا تعني ترخيصاً مهنياً أو مؤهلاً أكاديمياً ما لم تصرح الجهة بذلك.</div>
    <section className="portal-card certificate-issue-card">
      <div className="portal-section-title"><div><h2><Award size={18}/> إصدار شهادة شكر وتقدير</h2><p>إصدار إداري بعد مراجعة الحضور وإكمال المتطلبات.</p></div><LockKeyhole size={20}/></div>
      <form onSubmit={issueCertificate} className="certificate-issue-form">
        <label>اسم المتدرب<input required maxLength={100} value={learnerName} onChange={event=>setLearnerName(event.target.value)} placeholder="الاسم كما سيظهر على الشهادة"/></label>
        <label>اسم الدورة أو البرنامج<input required maxLength={180} value={courseTitle} onChange={event=>setCourseTitle(event.target.value)} placeholder="اسم البرنامج التدريبي"/></label>
        <label className="certificate-confirm"><input type="checkbox" checked={completionVerified} onChange={event=>setCompletionVerified(event.target.checked)}/> أؤكد أنني راجعت الحضور وإتمام متطلبات البرنامج.</label>
        {issueError&&<p className="certificate-error">{issueError}</p>}
        {issueSuccess&&<p className="certificate-issued-success">تم إصدار الشهادة بنجاح. رمز التحقق: <b>{issueSuccess}</b></p>}
        <button className="portal-button" disabled={issuing||!completionVerified}>{issuing?"جارٍ إصدار الشهادة...":"إصدار الشهادة"}</button>
      </form>
      <small className="certificate-admin-note">إصدار الشهادات وإلغاؤها متاحان لحساب مدير النظام بعد تسجيل الدخول. لا تستخدم هذه الشهادة كترخيص مهني.</small>
    </section>
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
          <small>تاريخ الإصدار: {new Date(certificate.issuedAt).toLocaleDateString("ar-EG")}</small><b>رمز التحقق: {certificate.serial}</b><div style={{display:"grid",justifyItems:"center",gap:6,marginTop:14}}>{verificationUrl&&<QRCodeSVG value={verificationUrl} size={128} level="M"/>}<small>امسح الرمز للتحقق من الشهادة</small></div>
          <span className="certificate-verified"><ShieldCheck size={14}/> شهادة صادرة ومسجلة في قاعدة بيانات المنصة</span>
        </div>
      </div>
      <button className="portal-button" onClick={()=>window.print()}><Printer size={15}/> طباعة الشهادة</button>
    </section>}
    <div className="portal-callout">الشهادة تقديرية لإتمام برنامج تدريبي، ولا تمثل ترخيصاً مهنياً أو مؤهلاً أكاديمياً أو تشخيصاً.</div>
  </PlatformLayout>;
}
