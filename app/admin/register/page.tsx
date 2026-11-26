"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, KeyRound, Mail, ShieldCheck, UserRoundPlus } from "lucide-react";

type Registration = { name: string; email: string; password: string; confirmPassword: string };

export default function FirstAdminRegistrationPage() {
  const router = useRouter();
  const [form, setForm] = useState<Registration>({ name: "", email: "", password: "", confirmPassword: "" });
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"details" | "verify">("details");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key: keyof Registration, value: string) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (form.password !== form.confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/admin-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنشاء حساب المدير.");
      setStage("verify");
      setNotice(data.message || "أرسلنا رمز التأكيد إلى بريدك الإلكتروني.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء حساب المدير.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/admin-verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تأكيد البريد الإلكتروني.");
      setNotice(data.message || "تم إنشاء حساب المدير.");
      router.replace("/platform-admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تأكيد البريد الإلكتروني.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="etzan-auth-page" dir="rtl">
      <section className="portal-card etzan-auth-card">
        <div className="etzan-auth-brand">
          <span className="portal-brand-mark"><ShieldCheck size={23}/></span>
          <div>
            <strong>اتزان | ETZAN</strong>
            <small>إعداد حساب مدير النظام</small>
          </div>
        </div>

        {stage === "details" ? (
          <>
            <div className="etzan-auth-heading">
              <span className="etzan-auth-kicker">إعداد الإدارة لأول مرة</span>
              <h1>إنشاء حساب مدير النظام</h1>
              <p>أنشئ حساب المدير الأول للمنصة. سنرسل رمز تأكيد إلى بريدك، وبعد تأكيده ستنتقل مباشرة إلى لوحة الإدارة.</p>
            </div>
            <form onSubmit={submitDetails} className="etzan-auth-form">
              <label>الاسم الكامل
                <input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={event => update("name", event.target.value)} placeholder="الاسم الكامل"/>
              </label>
              <label>البريد الإلكتروني
                <input required type="email" autoComplete="email" value={form.email} onChange={event => update("email", event.target.value)} placeholder="name@example.com"/>
              </label>
              <label>كلمة المرور
                <input required type="password" minLength={12} maxLength={256} autoComplete="new-password" value={form.password} onChange={event => update("password", event.target.value)} placeholder="12 حرفاً على الأقل"/>
              </label>
              <label>تأكيد كلمة المرور
                <input required type="password" minLength={12} maxLength={256} autoComplete="new-password" value={form.confirmPassword} onChange={event => update("confirmPassword", event.target.value)} placeholder="أعد كتابة كلمة المرور"/>
              </label>
              {error && <p className="etzan-auth-error" role="alert">{error}</p>}
              <button className="portal-button etzan-auth-submit" type="submit" disabled={loading}>
                <UserRoundPlus size={17}/>{loading ? "جارٍ إنشاء الحساب..." : "إنشاء حساب المدير"}
              </button>
            </form>
            <div className="etzan-auth-security"><KeyRound size={15}/> التسجيل العام متاح لإعداد مدير النظام الأول فقط. بعد إنشائه، تُدار حسابات الإدارة من داخل المنصة.</div>
          </>
        ) : (
          <>
            <div className="etzan-auth-heading">
              <span className="etzan-auth-kicker"><CheckCircle2 size={14}/> تم إنشاء طلب المدير</span>
              <h1>تأكيد البريد الإلكتروني</h1>
              <p>أدخل رمز التأكيد المكوّن من 6 أرقام الذي أرسلناه إلى <strong>{form.email}</strong>. بعد التأكيد ستُفتح لوحة الإدارة تلقائياً.</p>
            </div>
            <form onSubmit={verifyEmail} className="etzan-auth-form">
              <label>رمز التأكيد
                <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\\D/g, "").slice(0, 6))} placeholder="000000" className="etzan-auth-code"/>
              </label>
              {error && <p className="etzan-auth-error" role="alert">{error}</p>}
              {notice && <p className="etzan-auth-notice" role="status">{notice}</p>}
              <button className="portal-button etzan-auth-submit" type="submit" disabled={loading || code.length !== 6}>
                <Mail size={17}/>{loading ? "جارٍ التأكيد..." : "تأكيد وفتح لوحة الإدارة"}
              </button>
              <button type="button" className="etzan-auth-back" onClick={() => { setStage("details"); setCode(""); setError(""); setNotice(""); }} disabled={loading}>العودة لتعديل البيانات</button>
            </form>
          </>
        )}

        <div className="etzan-auth-links">
          <Link href="/login"><ArrowRight size={14}/> العودة إلى تسجيل الدخول</Link>
          <Link href="/admin/login">دخول الإدارة</Link>
        </div>
      </section>
    </main>
  );
}
