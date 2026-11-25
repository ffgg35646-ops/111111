"use client";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
function VerifyContent() {
  const router = useRouter(), search = useSearchParams();
  const [email,setEmail]=useState(search.get("email")||""); const [code,setCode]=useState("");
  const [error,setError]=useState(""); const [notice,setNotice]=useState(""); const [loading,setLoading]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(""); try {
    const response=await fetch("/api/auth/verify-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code})});
    const data=await response.json(); if(!response.ok) throw new Error(data.error||"تعذر تأكيد البريد.");
    router.replace("/dashboard"); router.refresh();
  } catch(cause) { setError(cause instanceof Error?cause.message:"تعذر تأكيد البريد."); } finally {setLoading(false);} }
  async function resend(){setLoading(true);setError("");setNotice("");try{const response=await fetch("/api/auth/resend-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const data=await response.json();if(!response.ok)throw new Error(data.error||"تعذر إرسال الرمز.");setNotice(data.message||"تم إرسال الرمز.");}catch(cause){setError(cause instanceof Error?cause.message:"تعذر إرسال الرمز.");}finally{setLoading(false);}}
  return <main dir="rtl" style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:20,background:"var(--canvas,#f4f7f9)"}}><section className="portal-card" style={{width:"min(100%,440px)",padding:28}}><h1 style={{fontSize:22,margin:"0 0 8px"}}>تأكيد البريد الإلكتروني</h1><p style={{fontSize:13,color:"#71808d",lineHeight:1.8}}>أدخل رمز التأكيد المكوّن من 6 أرقام المرسل إلى بريدك الإلكتروني.</p><form onSubmit={submit} style={{display:"grid",gap:13}}><label style={{display:"grid",gap:6,fontSize:12}}>البريد الإلكتروني<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{padding:12,border:"1px solid #dce5e9",borderRadius:9}}/></label><label style={{display:"grid",gap:6,fontSize:12}}>رمز التأكيد<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} style={{padding:12,border:"1px solid #dce5e9",borderRadius:9,textAlign:"center",letterSpacing:8,fontSize:22}}/></label>{error&&<p role="alert" style={{color:"#b64b48",fontSize:12}}>{error}</p>}{notice&&<p role="status" style={{color:"#287b61",fontSize:12}}>{notice}</p>}<button className="portal-button" disabled={loading} style={{justifyContent:"center"}}>{loading?"جارٍ التنفيذ...":"تأكيد البريد"}</button><button type="button" className="portal-button secondary" disabled={loading||!email} onClick={()=>void resend()} style={{justifyContent:"center"}}>إعادة إرسال الرمز</button></form></section></main>;
}
export default function VerifyEmailPage(){return <Suspense fallback={<main className="portal-root"/>}><VerifyContent/></Suspense>;}
