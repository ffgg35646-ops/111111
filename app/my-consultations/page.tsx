"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, Video } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Appointment = {
  requestId: string; name: string; email: string; status: string; serviceId: string;
  preferredAt?: string; durationMinutes?: number; providerName?: string; providerUserId?: string;
  slotId?: string; deliveryMode?: string; videoPlatform?: string;
  zoomMeeting?: { meetingId?: string; joinUrl?: string; startTime?: string };
  quotedAmount?: number; currency?: string; paymentStatus?: string; paymentId?: string;
  adminNote?: string; cancellationRequestedAt?: string; cancellationRefundStatus?: string;
  cancelledAt?: string; rescheduledAt?: string;
};
type Provider = { userId: string; name: string };
type Slot = { slotId: string; providerUserId: string; providerName: string; startsAt: string; durationMinutes: number };
const serviceNames: Record<string, string> = {
  "social-consultation": "استشارة في الخدمة الاجتماعية",
  "professional-consultation": "استشارة مهنية للأخصائيين",
  "family-guidance": "إرشاد أسري وتوجيه الوالدين",
  "cbt-consultation": "جلسة CBT مع مختص",
};
function today() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
const statusLabels: Record<string, string> = {
  pending_review: "قيد مراجعة الطلب",
  awaiting_payment: "بانتظار الدفع المسبق",
  approved: "موعد مؤكد ومدفوع",
  cancellation_requested: "طلب الإلغاء قيد المراجعة المالية",
  cancelled: "تم إلغاء الموعد",
  refunded: "تم الاسترداد",
  rejected: "الطلب غير معتمد",
};

export default function MyConsultationsPage() {
  const [requestId, setRequestId] = useState("");
  const [email, setEmail] = useState("");
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [date, setDate] = useState(today());
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerUserId, setProviderUserId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [newSlotId, setNewSlotId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setRequestId(query.get("requestId") || "");
    setEmail(query.get("email") || "");
  }, []);

  async function lookup(id = requestId, mail = email) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const query = new URLSearchParams({ requestId: id, email: mail });
      const response = await fetch("/api/platform/consultations/manage?" + query.toString(), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر العثور على الموعد.");
      setAppointment(data);
    } catch (cause) {
      setAppointment(null);
      setError(cause instanceof Error ? cause.message : "تعذر تحميل الموعد.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!appointment || appointment.status !== "approved" || appointment.paymentStatus !== "paid") return;
    let active = true;
    const query = new URLSearchParams({ serviceId: appointment.serviceId, date });
    if (providerUserId) query.set("providerUserId", providerUserId);
    fetch("/api/platform/consultation-slots?" + query.toString(), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل التقويم.");
        if (!active) return;
        setProviders(data.providers || []);
        if (!providerUserId && data.providers?.length) {
          const currentProvider = data.providers.find((provider: Provider) => provider.userId === appointment.providerUserId);
          setProviderUserId(currentProvider?.userId || data.providers[0].userId);
          return;
        }
        const available = (data.slots || []).filter((slot: Slot) => slot.slotId !== appointment.slotId);
        setSlots(available);
        setNewSlotId((current) => available.some((slot: Slot) => slot.slotId === current) ? current : available[0]?.slotId || "");
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل التقويم."); });
    return () => { active = false; };
  }, [appointment?.requestId, appointment?.status, appointment?.paymentStatus, appointment?.serviceId, appointment?.providerUserId, appointment?.slotId, date, providerUserId]);

  async function manage(action: "cancel" | "reschedule") {
    if (action === "reschedule" && !newSlotId) { setError("اختر الموعد الجديد أولاً."); return; }
    const prompt = action === "cancel" ? "هل تريد إرسال طلب إلغاء هذا الموعد؟" : "تأكيد نقل الحجز المدفوع إلى الموعد الجديد؟";
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/platform/consultations/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, email, action, newSlotId: action === "reschedule" ? newSlotId : undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تنفيذ العملية.");
      setNotice(data.message || (action === "cancel" ? "تم إرسال طلب الإلغاء." : "تم تحديث موعدك ورابط الجلسة المرئية."));
      await lookup();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تنفيذ العملية.");
    } finally {
      setBusy(false);
    }
  }

  const canCancel = appointment && ["pending_review", "awaiting_payment", "approved"].includes(appointment.status);
  const canReschedule = appointment?.status === "approved" && appointment.paymentStatus === "paid";
  const paymentUrl = appointment ? "/pay-request?" + new URLSearchParams({ requestId: appointment.requestId, email: appointment.email }).toString() : "";

  return (
    <PlatformLayout title="مواعيدي والاستشارات" description="تابع طلب الاستشارة والدفع المسبق، وادخل إلى الجلسة المرئية، أو أرسل طلب إلغاء وإعادة جدولة.">
      <form className="portal-card" onSubmit={(event) => { event.preventDefault(); void lookup(); }} style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <strong>استعراض موعدك</strong>
        <label>رقم الطلب<input required value={requestId} onChange={(event) => setRequestId(event.target.value)} placeholder="أدخل رقم المتابعة" /></label>
        <label>البريد الإلكتروني المستخدم عند الحجز<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button className="portal-button" disabled={loading || !requestId || !email}>{loading ? "جارٍ البحث..." : "عرض الموعد"}</button>
      </form>
      {error && <p role="alert" style={{ color: "#b64b48" }}>{error}</p>}
      {notice && <p role="status" className="portal-callout">{notice}</p>}
      {appointment && (
        <section className="portal-card" style={{ display: "grid", gap: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div><span className="portal-chip">اتزان | ETZAN</span><h2 style={{ margin: "9px 0 4px", fontSize: 19 }}>{serviceNames[appointment.serviceId] || "استشارة"}</h2><small>رقم الطلب: {appointment.requestId}</small></div>
            <strong>{statusLabels[appointment.status] || appointment.status}</strong>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            <div><small>مقدم الخدمة</small><p>{appointment.providerName || "سيتم تحديده"}</p></div>
            <div><small>موعد الاستشارة</small><p>{appointment.preferredAt ? new Date(appointment.preferredAt).toLocaleString("ar-SA") : "بانتظار الاعتماد"}</p></div>
            <div><small>مدة الجلسة</small><p>{appointment.durationMinutes || 50} دقيقة</p></div>
            <div><small>قيمة الاستشارة</small><p>{appointment.quotedAmount ? appointment.quotedAmount + " " + (appointment.currency || "SAR") : "بانتظار التسعير"}</p></div>
            <div><small>حالة الدفع</small><p>{appointment.paymentStatus === "paid" ? "مدفوع" : appointment.paymentStatus === "payment_due" || appointment.paymentStatus === "payment_initiated" ? "بانتظار الدفع" : appointment.paymentStatus || "غير محدد"}</p></div>
          </div>
          {appointment.adminNote && <div className="portal-callout">ملاحظة فريق التنسيق: {appointment.adminNote}</div>}
          {appointment.status === "awaiting_payment" && appointment.paymentStatus !== "paid" && <Link href={paymentUrl} className="portal-button" style={{ textDecoration: "none", width: "fit-content" }}><CreditCard size={16} /> إتمام الدفع المسبق</Link>}
          {appointment.status === "approved" && appointment.paymentStatus === "paid" && appointment.zoomMeeting?.joinUrl && (
            <div className="portal-callout"><Video size={17} /><div><strong>الجلسة المرئية جاهزة عبر Zoom</strong><p>لا تشارك رابط الدخول مع أي شخص آخر.</p><a href={appointment.zoomMeeting.joinUrl} target="_blank" rel="noreferrer" className="portal-button" style={{ textDecoration: "none", width: "fit-content" }}>الدخول إلى الاستشارة المرئية</a></div></div>
          )}
          {appointment.status === "cancellation_requested" && <div className="portal-callout">طلب الإلغاء قيد مراجعة الاسترداد المالي. سيبقى الموعد محجوزاً حتى اكتمال الاسترداد.</div>}
          {canReschedule && (
            <div style={{ display: "grid", gap: 10, borderTop: "1px solid #e4e9ed", paddingTop: 14 }}>
              <h3 style={{ margin: 0 }}>إعادة جدولة الاستشارة</h3>
              <label>التاريخ الجديد<input type="date" min={today()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
              <label>مقدم الخدمة<select value={providerUserId} onChange={(event) => setProviderUserId(event.target.value)}>{providers.map((provider) => <option key={provider.userId} value={provider.userId}>{provider.name}</option>)}</select></label>
              <label>الموعد الجديد<select value={newSlotId} onChange={(event) => setNewSlotId(event.target.value)}><option value="">اختر موعداً متاحاً</option>{slots.map((slot) => <option key={slot.slotId} value={slot.slotId}>{new Date(slot.startsAt).toLocaleString("ar-SA")} · {slot.providerName}</option>)}</select></label>
              <button type="button" className="portal-button secondary" disabled={busy || !newSlotId} onClick={() => void manage("reschedule")}><CalendarDays size={15} /> تأكيد إعادة الجدولة</button>
              <small>يتم تحديث موعد Zoom الحالي تلقائياً دون إنشاء عملية دفع جديدة عند ثبات نوع الاستشارة.</small>
            </div>
          )}
          {canCancel && <button type="button" className="portal-button secondary" disabled={busy} onClick={() => void manage("cancel")}>إلغاء الموعد / إرسال طلب الإلغاء</button>}
          {appointment.status === "cancelled" && <p>تم إلغاء الموعد.</p>}
          {appointment.status === "refunded" && <p>تم إلغاء الموعد وإعادة المبلغ وفق حالة الاسترداد.</p>}
        </section>
      )}
      <div className="portal-callout" style={{ marginTop: 16 }}>للحفاظ على الخصوصية، لا ترسل بيانات صحية حساسة عبر نموذج الحجز أو البريد الإلكتروني. الاستشارات ليست خدمة طوارئ.</div>
    </PlatformLayout>
  );
}
