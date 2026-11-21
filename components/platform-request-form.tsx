"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";

export type RequestField = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "datetime-local" | "number" | "textarea" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  options?: {value:string;label:string}[];
  min?: number;
  max?: number;
};

type Props = {
  kind: "course_enrollment" | "classroom_registration" | "consultation" | "room_rental" | "book_order";
  title: string;
  description?: string;
  fields: RequestField[];
  initialData?: Record<string,string|number|boolean>;
  submitLabel?: string;
};

export default function PlatformRequestForm({
  kind,title,description,fields,initialData={},submitLabel="إرسال الطلب",
}:Props) {
  const [values,setValues] = useState<Record<string,string|boolean>>({});
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [phone,setPhone] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState("");

  const submit = async (event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    setLoading(true);setError("");setSuccess("");
    const payload:Record<string,unknown> = {
      ...initialData,
      ...values,
      kind,
      name,
      email,
      phone,
    };
    if (typeof payload.preferredAt === "string" && payload.preferredAt) {
      const date = new Date(payload.preferredAt);
      if (Number.isNaN(date.getTime())) {
        setLoading(false);setError("صيغة الموعد غير صحيحة.");return;
      }
      payload.preferredAt = date.toISOString();
    }
    if (typeof payload.durationMinutes === "string") payload.durationMinutes = Number(payload.durationMinutes);
    if (typeof payload.attendees === "string") payload.attendees = Number(payload.attendees);

    try {
      const response=await fetch("/api/platform/requests",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        credentials:"same-origin",
        body:JSON.stringify(payload),
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"تعذر إرسال الطلب.");
      setSuccess(result.requestId);
      setValues({});
    } catch(cause) {
      setError(cause instanceof Error?cause.message:"تعذر إرسال الطلب.");
    } finally {
      setLoading(false);
    }
  };

  if(success) return <div className="request-success"><CheckCircle2 size={25}/><strong>تم استلام طلبك</strong><p>رقم المتابعة: <b>{success}</b></p><small>حالة الطلب: قيد المراجعة. سيتم التواصل عبر بيانات الاتصال المدخلة.</small><button onClick={()=>setSuccess("")}>إرسال طلب آخر</button></div>;

  return <form className="platform-request-form" onSubmit={submit}>
    <div className="request-form-heading"><strong>{title}</strong>{description&&<p>{description}</p>}</div>
    <div className="request-form-grid">
      <label>الاسم الكامل<input required minLength={2} maxLength={100} value={name} onChange={event=>setName(event.target.value)} placeholder="الاسم المسجل"/></label>
      <label>البريد الإلكتروني<input required type="email" maxLength={180} value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com"/></label>
      <label>رقم التواصل (اختياري)<input type="tel" maxLength={40} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="رقم الهاتف"/></label>
      {fields.map(field=>{
        const value=values[field.name] ?? (field.type==="checkbox"?false:"");
        if(field.type==="checkbox") return <label className="request-checkbox" key={field.name}><input type="checkbox" checked={Boolean(value)} onChange={event=>setValues(current=>({...current,[field.name]:event.target.checked}))}/><span>{field.label}</span></label>;
        if(field.type==="textarea") return <label className="request-field-wide" key={field.name}>{field.label}<textarea required={field.required} maxLength={500} rows={3} value={String(value)} onChange={event=>setValues(current=>({...current,[field.name]:event.target.value}))} placeholder={field.placeholder}/></label>;
        if(field.type==="select") return <label key={field.name}>{field.label}<select required={field.required} value={String(value)} onChange={event=>setValues(current=>({...current,[field.name]:event.target.value}))}><option value="">اختر</option>{field.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
        return <label key={field.name}>{field.label}<input type={field.type} required={field.required} min={field.min} max={field.max} maxLength={field.type==="text"||field.type==="tel"?180:undefined} value={String(value)} onChange={event=>setValues(current=>({...current,[field.name]:event.target.value}))} placeholder={field.placeholder}/></label>;
      })}
    </div>
    {error&&<p className="request-error" role="alert">{error}</p>}
    <button className="request-submit" type="submit" disabled={loading}>{loading?<><LoaderCircle className="spin" size={15}/> جارٍ الإرسال</>:<><Send size={15}/>{submitLabel}</>}</button>
    <small className="request-privacy">يرسل النموذج طلباً أولياً للمراجعة ولا يؤكد التسجيل أو الحجز أو تقديم الخدمة حتى تتم الموافقة.</small>
  </form>;
}
