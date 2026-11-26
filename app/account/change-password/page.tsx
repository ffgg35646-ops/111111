"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (!response.ok) router.replace("/login?next=/account/change-password");
        else if (!data.user?.mustChangePassword) router.replace("/");
        setChecking(false);
      })
      .catch(() => {
        if (active) { setChecking(false); router.replace("/login"); }
      });
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) { setError("كلمتا المرور غير متطابقتين."); return; }
    if (newPassword.length < 12) { setError("استخدم 12 حرفاً على الأقل."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحديث كلمة المرور.");
      setSuccess("تم تحديث كلمة المرور. جارٍ فتح المنصة...");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      window.setTimeout(() => router.replace("/dashboard"), 700);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث كلمة المرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--canvas, #f4f7f9)" }}>
      <section className="portal-card" style={{ width: "min(100%, 460px)", padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <span className="portal-brand-mark"><ShieldCheck size={22}/></span>
          <div><strong style={{ display: "block", fontSize: 18 }}>تغيير كلمة المرور</strong><small style={{ color: "#71808d" }}>خطوة أمان مطلوبة عند أول دخول</small></div>
        </div>
        {checking ? <p>جارٍ التحقق من الجلسة...</p> : <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 12 }}>كلمة المرور المؤقتة<input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} style={{ padding: 11, border: "1px solid #dce5e9", borderRadius: 8 }}/></label>
          <label style={{ display: "grid", gap: 5, fontSize: 12 }}>كلمة المرور الجديدة<input required minLength={12} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} style={{ padding: 11, border: "1px solid #dce5e9", borderRadius: 8 }}/></label>
          <label style={{ display: "grid", gap: 5, fontSize: 12 }}>تأكيد كلمة المرور الجديدة<input required minLength={12} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} style={{ padding: 11, border: "1px solid #dce5e9", borderRadius: 8 }}/></label>
          {error && <p role="alert" style={{ color: "#b64b48", fontSize: 12 }}>{error}</p>}
          {success && <p role="status" style={{ color: "#287b61", fontSize: 12 }}>{success}</p>}
          <button className="portal-button" disabled={loading} style={{ justifyContent: "center" }}><KeyRound size={15}/>{loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}</button>
        </form>}
      </section>
    </main>
  );
}
