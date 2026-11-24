"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, Video } from "lucide-react";

type Slot = { slotId: string; providerUserId: string; providerName: string; startsAt: string; durationMinutes: number };
type Provider = { userId: string; name: string };

function localDateValue() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export default function ConsultationBookingForm({ serviceId, title }: { serviceId: string; title: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerUserId, setProviderUserId] = useState("");
  const [date, setDate] = useState(localDateValue());
  const [slotId, setSlotId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [manageUrl, setManageUrl] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ serviceId, date, timezoneOffset: String(new Date().getTimezoneOffset()) });
    if (providerUserId) query.set("providerUserId", providerUserId);
    fetch("/api/platform/consultation-slots?" + query.toString(), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل المواعيد.");
        if (!active) return;
        const availableProviders = Array.isArray(data.providers) ? data.providers : [];
        setProviders(availableProviders);
        if (!providerUserId && availableProviders.length) {
          setProviderUserId(availableProviders[0].userId);
          return;
        }
        const availableSlots = Array.isArray(data.slots) ? data.slots : [];
        setSlots(availableSlots);
        setSlotId((current) => availableSlots.some((slot: Slot) => slot.slotId === current) ? current : availableSlots[0]?.slotId || "");
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المواعيد."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [serviceId, date, providerUserId, refreshKey]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent) { setError("يلزم الموافقة على استخدام بيانات التواصل."); return; }
    if (!slotId) { setError("اختر موعداً متاحاً قبل إرسال الطلب."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/platform/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "consultation", serviceId, slotId, name, email, phone, requestNote: note, consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إرسال الحجز.");
      const url = new URL("/my-consultations", window.location.origin);
      url.searchParams.set("requestId", data.requestId);
      url.searchParams.set("email", email);
      setManageUrl(url.pathname + url.search);
      setSuccess(data.requestId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إرسال الحجز.");
    } finally {
      setBusy(false);
    }
  }

  if (success) return (
    <div className="request-success" role="status">
      <strong>تم استلام طلب الاستشارة بنجاح</strong>
      <p>رقم المتابعة: <b>{success}</b></p>
      <p>سيتم اعتماد قيمة الاستشارة أولاً، ثم يمكنك إتمام الدفع المسبق. الموعد محجوز مؤقتاً لمدة 90 دقيقة.</p>
      <Link className="portal-button" href={manageUrl}>متابعة الطلب والدفع وإدارة الموعد</Link>
      <button type="button" onClick={() => { setSuccess(""); setManageUrl(""); setName(""); setEmail(""); setPhone(""); setNote(""); void Promise.resolve(); }}>طلب موعد آخر</button>
    </div>
  );

  return (
    <form className="platform-request-form" onSubmit={submit}>
      <div className="request-form-heading">
        <strong>{title}</strong>
        <p>اختر مقدم الخدمة والتاريخ والوقت المناسب. لا يصبح الحجز نهائياً إلا بعد اعتماد السعر والدفع المسبق.</p>
      </div>
      <div className="request-form-grid">
        <label>مقدم الخدمة
          <select required value={providerUserId} onChange={(event) => { const value = event.target.value; setLoading(true); setError(""); setSlots([]); setSlotId(""); setProviderUserId(value); }} disabled={loading || !providers.length}>
            <option value="">{loading ? "جارٍ تحميل مقدمي الخدمة..." : "لا يوجد مقدم خدمة متاح لهذا المجال"}</option>
            {providers.map((provider) => <option key={provider.userId} value={provider.userId}>{provider.name}</option>)}
          </select>
        </label>
        <label><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CalendarDays size={14}/> تاريخ الاستشارة</span>
          <input required type="date" min={localDateValue()} value={date} onChange={(event) => { setLoading(true); setError(""); setSlots([]); setSlotId(""); setDate(event.target.value); }} />
        </label>
        <label className="request-field-wide"><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Clock3 size={14}/> الوقت المتاح</span>
          <select required value={slotId} onChange={(event) => setSlotId(event.target.value)} disabled={loading || !slots.length}>
            <option value="">{loading ? "جارٍ تحميل الأوقات..." : "لا توجد أوقات متاحة في هذا اليوم"}</option>
            {slots.map((slot) => <option key={slot.slotId} value={slot.slotId}>{new Date(slot.startsAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })} — {slot.durationMinutes} دقيقة</option>)}
          </select>
        </label>
        <div className="request-field-wide portal-callout" style={{ margin: 0 }}><Video size={16}/> نوع التنفيذ: استشارة مرئية عبر Zoom. يظهر رابط الدخول بعد تأكيد الدفع.</div>
        <label>الاسم الكامل<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>البريد الإلكتروني<input required type="email" maxLength={180} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>رقم التواصل<input type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <label className="request-field-wide">ملاحظة تنظيمية اختيارية<textarea maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="لا تكتب بيانات مرضى أو تفاصيل صحية حساسة." /></label>
        <label className="request-checkbox"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>أوافق على استخدام بيانات التواصل لمراجعة الطلب وتنسيق الموعد وفق سياسة الخصوصية.</span></label>
      </div>
      {error && <p role="alert" className="request-error">{error}</p>}
      <button className="request-submit" disabled={busy || loading || !slots.length || !slotId}>{busy ? "جارٍ إرسال الطلب..." : "إرسال طلب الحجز"}</button>
      <button type="button" className="portal-button secondary" onClick={() => { setLoading(true); setError(""); setRefreshKey((value) => value + 1); }}>إعادة تحميل خيارات الحجز</button>
    </form>
  );
}
