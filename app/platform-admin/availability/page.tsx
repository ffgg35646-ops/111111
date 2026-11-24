"use client";

import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, RefreshCw, Video } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

const options = [
  ["social-consultation", "استشارة في الخدمة الاجتماعية"],
  ["professional-consultation", "استشارة مهنية للأخصائيين"],
  ["family-guidance", "إرشاد أسري"],
  ["cbt-consultation", "جلسة CBT"],
];
type Slot = { slotId: string; providerName: string; startsAt: string; durationMinutes: number; status: string; serviceIds: string[] };
type Provider = { userId: string; name: string; email: string };
type Appointment = {
  requestId: string; name: string; email: string; serviceId: string; providerName: string;
  preferredAt: string; durationMinutes: number; status: string; paymentStatus: string;
  zoomMeeting?: { joinUrl?: string };
};

export default function AvailabilityPage() {
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDuration] = useState("50");
  const [serviceIds, setServices] = useState<string[]>([options[0][0]]);
  const [providerUserId, setProviderUserId] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/platform/consultation-slots?manage=1", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر تحميل المواعيد.");
    setSlots(data.slots || []);
    setAppointments(data.appointments || []);
    setProviders(data.providers || []);
    if (!providerUserId && data.providers?.length) setProviderUserId(data.providers[0].userId);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/platform/consultation-slots?manage=1", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل المواعيد.");
        if (active) {
          setSlots(data.slots || []);
          setAppointments(data.appointments || []);
          setProviders(data.providers || []);
          if (data.providers?.length) setProviderUserId(data.providers[0].userId);
        }
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المواعيد."); });
    return () => { active = false; };
  }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/consultation-slots", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: new Date(startsAt).toISOString(), durationMinutes: Number(durationMinutes), serviceIds, providerUserId: providerUserId || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر نشر الموعد.");
      setNotice("تم نشر الموعد المتاح.");
      setStartsAt("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر نشر الموعد."); }
    finally { setBusy(false); }
  }

  async function cancelSlot(slotId: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/consultation-slots", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slotId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إلغاء الموعد.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إلغاء الموعد."); }
    finally { setBusy(false); }
  }

  async function appointmentAction(item: Appointment, action: "cancel" | "complete") {
    const message = action === "cancel" ? "إرسال طلب إلغاء الموعد إلى الإدارة لمراجعة الاسترداد؟" : "تأكيد تسجيل اكتمال الاستشارة؟";
    if (!window.confirm(message)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/consultation-appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: item.requestId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحديث الموعد.");
      setNotice(action === "cancel" ? "تم إرسال طلب الإلغاء للمراجعة المالية." : "تم تسجيل اكتمال الاستشارة.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث الموعد."); }
    finally { setBusy(false); }
  }

  const statusLabel = (status: string) => ({
    awaiting_payment: "بانتظار الدفع",
    approved: "مؤكد ومدفوع",
    cancellation_requested: "إلغاء بانتظار الاسترداد",
    completed: "مكتمل",
  }[status] || status);

  return (
    <PlatformLayout title="إتاحة مواعيد الاستشارات" description="إدارة تقويم مقدم الخدمة، ومراجعة الحجوزات المؤكدة، ومتابعة الجلسات المرئية والإلغاء.">
      <form className="portal-card" onSubmit={create} style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>نشر موعد متاح</h2>
        {providers.length > 0 && <label>مقدم الاستشارة المسؤول<select required value={providerUserId} onChange={(event) => setProviderUserId(event.target.value)}>{providers.map((provider) => <option key={provider.userId} value={provider.userId}>{provider.name} — {provider.email}</option>)}</select></label>}
        <label>تاريخ ووقت الموعد<input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label>مدة الجلسة بالدقائق<select value={durationMinutes} onChange={(event) => setDuration(event.target.value)}><option value="30">30</option><option value="50">50</option><option value="60">60</option><option value="90">90</option><option value="120">120</option></select></label>
        <fieldset style={{ border: "1px solid #dce5e9", borderRadius: 8, padding: 12 }}>
          <legend>مجالات الاستشارة</legend>
          {options.map(([id, label]) => <label key={id} style={{ display: "flex", gap: 8, margin: 8 }}><input type="checkbox" checked={serviceIds.includes(id)} onChange={(event) => setServices((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} />{label}</label>)}
        </fieldset>
        <button className="portal-button" disabled={busy || !startsAt || !serviceIds.length || (providers.length > 0 && !providerUserId)}>نشر الموعد المتاح</button>
      </form>
      {error && <p role="alert" style={{ color: "#b64b48" }}>{error}</p>}
      {notice && <p role="status" className="portal-callout">{notice}</p>}
      <div className="portal-section-title"><div><h2>مواعيدي المنشورة</h2><p>{slots.length} موعداً</p></div><button className="portal-button secondary" onClick={() => void load()}><RefreshCw size={14}/> تحديث</button></div>
      <div style={{ display: "grid", gap: 10 }}>
        {slots.map((slot) => <article className="portal-card" key={slot.slotId}>
          <strong>{new Date(slot.startsAt).toLocaleString("ar-SA")}</strong>
          <p>{slot.providerName} · {slot.durationMinutes} دقيقة · {slot.serviceIds.map((id) => options.find((option) => option[0] === id)?.[1] || id).join("، ")}</p>
          <span className="portal-chip">{slot.status === "open" ? "متاح" : slot.status === "reserved" ? "محجوز مؤقتاً" : slot.status === "booked" ? "محجوز ومدفوع" : "ملغي"}</span>
          {slot.status === "open" && <button className="portal-button secondary" disabled={busy} onClick={() => void cancelSlot(slot.slotId)}>إلغاء الموعد المنشور</button>}
        </article>)}
      </div>
      <div className="portal-section-title"><div><h2>حجوزات الاستشارات</h2><p>{appointments.length} حجزاً في جدول مقدمي الخدمة</p></div><CalendarDays size={20}/></div>
      <div style={{ display: "grid", gap: 10 }}>
        {appointments.map((item) => <article className="portal-card" key={item.requestId}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <strong>{item.name}</strong><span className="portal-chip">{statusLabel(item.status)}</span>
          </div>
          <p>{options.find((option) => option[0] === item.serviceId)?.[1] || item.serviceId}</p>
          <p>{new Date(item.preferredAt).toLocaleString("ar-SA")} · {item.durationMinutes} دقيقة · {item.providerName}</p>
          <small>{item.email} · {item.paymentStatus === "paid" ? "مدفوع" : "بانتظار الدفع"}</small>
          {item.status === "approved" && item.paymentStatus === "paid" && item.zoomMeeting?.joinUrl && <a className="portal-button secondary" href={item.zoomMeeting.joinUrl} target="_blank" rel="noreferrer"><Video size={14}/> فتح رابط Zoom</a>}
          {item.status === "approved" && item.paymentStatus === "paid" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="portal-button" disabled={busy} onClick={() => void appointmentAction(item, "complete")}><CheckCircle2 size={14}/> تسجيل اكتمال الجلسة</button>
            <button className="portal-button secondary" disabled={busy} onClick={() => void appointmentAction(item, "cancel")}>طلب إلغاء الموعد</button>
          </div>}
        </article>)}
        {!appointments.length && <div className="portal-card">لا توجد حجوزات استشارة مرتبطة بهذا الجدول حتى الآن.</div>}
      </div>
      <div className="portal-callout" style={{ marginTop: 18 }}>إلغاء الموعد المدفوع يرسل طلباً لمراجعة الاسترداد. لا يُعاد فتح الوقت في التقويم إلا بعد نجاح الاسترداد المالي.</div>
    </PlatformLayout>
  );
}
