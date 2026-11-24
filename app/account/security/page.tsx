"use client";

import { useEffect, useState } from "react";
import { Laptop, LogOut, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type DeviceSession = { sessionId: string; deviceLabel: string; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean };
export default function AccountSecurityPage() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [maxDevices, setMaxDevices] = useState(2);
  const [activeDevices, setActiveDevices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/devices", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الأجهزة.");
      setSessions(data.sessions || []); setMaxDevices(data.maxDevices || 2); setActiveDevices(data.activeDevices || 0);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل الأجهزة."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function revoke(sessionId: string) {
    setBusy(sessionId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/auth/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إنهاء الجلسة.");
      setNotice("تم إنهاء جلسة الجهاز المحدد."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إنهاء الجلسة."); }
    finally { setBusy(""); }
  }
  return <PlatformLayout title="أمان الحساب والأجهزة" description="راقب الجلسات المفتوحة وأنهِ أي جلسة لا تعرفها. تسجيل الدخول مقيد افتراضياً بجهازين نشطين لكل حساب.">
    <div className="portal-callout"><ShieldCheck size={16}/> الأجهزة النشطة: {activeDevices} من {maxDevices}. تغيير كلمة المرور ينهي الجلسات الأخرى، ويمكنك إنهاء أي جهاز من هذه القائمة.</div>
    {error && <p role="alert" style={{ color: "#a33" }}>{error}</p>}
    {notice && <p role="status" style={{ color: "#18745e" }}>{notice}</p>}
    <div className="portal-section-title"><div><h2>جلسات حسابك</h2><p>تُنهى الجلسة عند تسجيل الخروج أو الإلغاء أو انتهاء صلاحيتها بعد 8 ساعات.</p></div><button className="portal-button secondary" disabled={loading} onClick={() => void load()}><RefreshCw size={14}/> تحديث</button></div>
    {loading && <div className="portal-empty">جارٍ تحميل الجلسات...</div>}
    {!loading && <div style={{ display: "grid", gap: 10 }}>
      {sessions.map((session) => <article className="portal-card" key={session.sessionId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="track-icon">{/iPhone|Android/i.test(session.deviceLabel) ? <Smartphone size={20}/> : <Laptop size={20}/>}</span>
          <div><strong>{session.deviceLabel} {session.current && <span className="portal-chip">هذا الجهاز</span>}</strong><p style={{ margin: "4px 0", color: "#7b8990", fontSize: 11 }}>آخر نشاط: {new Date(session.lastSeenAt).toLocaleString("ar-EG")}</p><small style={{ color: "#89969c" }}>بدء الجلسة: {new Date(session.createdAt).toLocaleString("ar-EG")} · تنتهي: {new Date(session.expiresAt).toLocaleString("ar-EG")}</small></div>
        </div>
        {!session.current && <button className="portal-button secondary" disabled={busy === session.sessionId} onClick={() => void revoke(session.sessionId)}><LogOut size={14}/>{busy === session.sessionId ? "جارٍ الإنهاء..." : "إنهاء الجلسة"}</button>}
      </article>)}
      {!sessions.length && <div className="portal-empty">لا توجد جلسات نشطة.</div>}
    </div>}
  </PlatformLayout>;
}
