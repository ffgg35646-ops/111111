"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck, UserRoundPlus } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تسجيل الدخول.");
      if (!["admin", "platform_manager"].includes(data.user?.role)) {
        await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => undefined);
        throw new Error("هذا الحساب ليس حساب إدارة. استخدم صفحة دخول الطلاب.");
      }
      setPassword("");
      router.replace(data.user?.mustChangePassword
        ? "/account/change-password?next=%2Fplatform-admin"
        : "/platform-admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تسجيل دخول الإدارة.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="etzan-auth-page" dir="rtl">
      <section className="portal-card etzan-auth-card">
        <div className="etzan-auth-brand">
          <span className="portal-brand-mark"><ShieldCheck size={24}/></span>
          <div><strong>اتزان | ETZAN</strong><small>بوابة الإدارة المستقلة</small></div>
        </div>
        <div className="etzan-auth-heading">
          <span className="etzan-auth-kicker">دخول مخصص للإدارة</span>
          <h1>تسجيل دخول المدير</h1>
          <p>هذه الصفحة مخصصة لمدير النظام ومديري المنصة فقط. حسابات الطلاب لا يمكنها الدخول إلى لوحة الإدارة.</p>
        </div>
        <form onSubmit={submit} className="etzan-auth-form">
          <label>البريد الإلكتروني
            <input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="admin@example.com"/>
          </label>
          <label>كلمة المرور
            <input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="كلمة مرور الإدارة"/>
          </label>
          {error && <p className="etzan-auth-error" role="alert">{error}</p>}
          <button className="portal-button etzan-auth-submit" type="submit" disabled={loading}>
            <LockKeyhole size={17}/>{loading ? "جارٍ التحقق من الحساب..." : "دخول لوحة الإدارة"}
          </button>
        </form>
        <div className="etzan-auth-links">
          <Link href="/admin/register"><UserRoundPlus size={15}/> إنشاء حساب مدير النظام الأول</Link>
          <Link href="/forgot-password">نسيت كلمة المرور؟</Link>
        </div>
        <Link href="/" className="etzan-auth-back"><ArrowRight size={14}/> العودة إلى المنصة</Link>
        <div className="etzan-auth-security"><ShieldCheck size={15}/> دخول محمي بجلسة آمنة. لا تشارك بيانات حساب الإدارة مع أي مستخدم آخر.</div>
      </section>
    </main>
  );
}
