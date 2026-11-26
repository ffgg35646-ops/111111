"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

export default function LoginPage() {
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
      if (["admin", "platform_manager"].includes(data.user?.role)) {
        await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => undefined);
        throw new Error("هذا حساب إدارة. استخدم صفحة دخول الإدارة المنفصلة.");
      }
      setPassword("");
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const destination = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
        && !requestedNext.startsWith("/platform-admin")
        ? requestedNext : "/dashboard";
      if (data.user?.mustChangePassword) {
        router.replace("/account/change-password?next=" + encodeURIComponent(destination));
      } else {
        router.replace(destination);
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تسجيل الدخول.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--canvas, #f4f7f9)" }}>
      <section className="portal-card" style={{ width: "min(100%, 440px)", padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span className="portal-brand-mark"><ShieldCheck size={22}/></span>
          <div><strong style={{ display: "block", fontSize: 18 }}>تسجيل دخول الطلاب</strong><small style={{ color: "#788894" }}>منصة التدريب والمحاكاة السريرية</small></div>
        </div>
        <p style={{ color: "#71808d", fontSize: 13, lineHeight: 1.8 }}>أدخل البريد الإلكتروني وكلمة المرور للدخول إلى حسابك.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 13, marginTop: 20 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12 }}>البريد الإلكتروني
            <input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" style={{ width: "100%", padding: 12, border: "1px solid #dce5e9", borderRadius: 9, background: "#fff" }}/>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 12 }}>كلمة المرور
            <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} style={{ width: "100%", padding: 12, border: "1px solid #dce5e9", borderRadius: 9, background: "#fff" }}/>
          </label>
          {error && <p role="alert" style={{ margin: 0, color: "#b64b48", fontSize: 12 }}>{error}</p>}
          <button className="portal-button" type="submit" disabled={loading} style={{ justifyContent: "center", minHeight: 44 }}>
            <LockKeyhole size={16}/>{loading ? "جارٍ التحقق..." : "دخول"}
          </button>
        </form>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 18, fontSize: 12 }}>
          <Link href="/forgot-password" style={{ color: "#167f79" }}>نسيت كلمة المرور؟</Link>
          <Link href="/register" style={{ color: "#167f79" }}>إنشاء حساب طالب</Link>
        </div>
        <Link href="/" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 18, color: "#167f79", fontSize: 12 }}><ArrowRight size={14}/> العودة إلى المنصة</Link>
      </section>
    </main>
  );
}
