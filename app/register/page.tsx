"use client";
import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: "", fatherName: "", username: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  function update(key: keyof typeof form, value: string) { setForm(current => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (form.password !== form.confirmPassword) { setError("كلمتا المرور غير متطابقتين."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "تعذر إنشاء الحساب.");
      router.push("/verify-email?email=" + encodeURIComponent(form.email.trim().toLowerCase()));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إنشاء الحساب."); }
    finally { setLoading(false); }
  }
  const field = (label: string, key: keyof typeof form, type = "text", props: InputHTMLAttributes<HTMLInputElement> = {}) => <label style={{ display: "grid", gap: 6, fontSize: 12 }}>{label}<input required type={type} value={form[key]} onChange={event => update(key, event.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #dce5e9", borderRadius: 9, background: "#fff" }} {...props}/></label>;
  return <main dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "var(--canvas,#f4f7f9)" }}><section className="portal-card" style={{ width: "min(100%,520px)", padding: 28 }}><h1 style={{ margin: "0 0 6px", fontSize: 22 }}>إنشاء حساب طالب</h1><p style={{ color: "#71808d", fontSize: 13, margin: "0 0 20px" }}>أدخل بياناتك لإنشاء حساب جديد.</p><form onSubmit={submit} style={{ display: "grid", gap: 13 }}><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>{field("الاسم","firstName","text",{minLength:2,autoComplete:"given-name"})}{field("اسم الأب","fatherName","text",{minLength:2})}</div>{field("اسم المستخدم","username","text",{minLength:3,maxLength:30,pattern:"[A-Za-z0-9_]+",autoComplete:"username"})}{field("البريد الإلكتروني","email","email",{autoComplete:"email"})}{field("كلمة المرور","password","password",{minLength:12,autoComplete:"new-password"})}{field("تأكيد كلمة المرور","confirmPassword","password",{minLength:12,autoComplete:"new-password"})}{error && <p role="alert" style={{ color: "#b64b48", fontSize:12, margin:0 }}>{error}</p>}<button className="portal-button" type="submit" disabled={loading} style={{ justifyContent:"center", minHeight:44 }}>{loading ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}</button></form><p style={{ marginTop:18, fontSize:12, color:"#71808d" }}>لديك حساب؟ <Link href="/login" style={{ color:"#167f79" }}>تسجيل الدخول</Link></p></section></main>;
}
