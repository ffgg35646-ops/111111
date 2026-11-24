"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Database, LockKeyhole, ShieldCheck, Video } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type EventRow = { eventId: string; action: string; actorUserId?: string; targetId?: string; route?: string; userAgent?: string; metadata?: Record<string, unknown>; createdAt: string };
const labels: Record<string, string> = {
  login_succeeded: "تسجيل دخول ناجح", login_failed: "محاولة دخول فاشلة",
  login_blocked_device_limit: "رفض الدخول بسبب حد الأجهزة", logout: "تسجيل خروج",
  password_changed: "تغيير كلمة المرور", password_change_failed: "فشل تغيير كلمة المرور",
  device_session_revoked: "إنهاء جلسة جهاز", classroom_join_accessed: "فتح رابط فصل مباشر",
  classroom_recording_accessed: "فتح رابط تسجيل محاضرة", course_video_started: "بدء تشغيل فيديو دورة",
  protected_course_media_saved: "تحديث وسيط دورة", protected_course_media_disabled: "تعطيل وسيط دورة",
};

export default function PlatformSecurityPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/platform/security/audit", { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); if (active) setEvents(d.events || []); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "تعذر تحميل سجل الأمان."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <PlatformLayout title="الأمان والخصوصية" description="مراجعة أحداث الدخول والجلسات والوسائط المحمية، مع متطلبات التشغيل والامتثال التي تحتاج إعداداً مؤسسياً.">
    <div className="portal-grid">
      <article className="portal-card"><LockKeyhole size={20}/><h3>الجلسات والأجهزة</h3><p>جلسات موقعة وقابلة للإلغاء، وحد افتراضي جهازان نشطان لكل حساب.</p></article>
      <article className="portal-card"><Video size={20}/><h3>المحتوى المرئي</h3><p>روابط داخلية قصيرة الصلاحية لتسجيلات Zoom، وبث ملفات الدورة عبر نقطة تحقق وصلاحيات الخادم.</p></article>
      <article className="portal-card"><ShieldCheck size={20}/><h3>سجل التدقيق</h3><p>توثيق الدخول والخروج وتغيير كلمة المرور وإلغاء الأجهزة والوصول إلى الوسائط.</p></article>
      <article className="portal-card"><Database size={20}/><h3>النسخ والتشفير</h3><p>التطبيق يفرض TLS لاتصالات قاعدة البيانات غير المحلية. النسخ الاحتياطي المشفر والاستعادة يجب تفعيلهما في مزود MongoDB.</p></article>
    </div>
    <section className="portal-card" style={{ marginTop: 18 }}>
      <h2>متطلبات خارج التطبيق قبل اعتماد الامتثال</h2>
      <ul style={{ lineHeight: 2, color: "#637781", fontSize: 13 }}>
        <li>تفعيل MongoDB Atlas Cloud Backup/Continuous Backup وتحديد سياسة احتفاظ واختبار استعادة موثق.</li>
        <li>التحقق من منطقة الاستضافة ومواقع النسخ الاحتياطية ومعالجي البيانات، وتقييم النقل خارج المملكة عند انطباقه.</li>
        <li>تأكيد تشفير البيانات المخزنة لدى مزود قاعدة البيانات والتخزين، وإدارة الأسرار من لوحة الاستضافة لا من Git.</li>
        <li>اعتماد إشعار الخصوصية وأغراض المعالجة والأساس النظامي وفترات الاحتفاظ ومسار طلبات أصحاب البيانات.</li>
        <li>تسمية مسؤول داخلي للاستجابة للحوادث وتقييم بلاغات خرق البيانات ضمن المهلة النظامية عند انطباقها.</li>
        <li>مراجعة اتفاقيات معالجي البيانات، والتحكم بصلاحيات الدعم والمشرفين وتدريب العاملين.</li>
      </ul>
    </section>
    {error && <p role="alert" style={{ color: "#a33" }}>{error}</p>}
    {loading && <div className="portal-empty">جارٍ تحميل سجل الأمان...</div>}
    {!loading && !error && <section className="portal-card" style={{ marginTop: 18 }}>
      <div className="portal-section-title"><div><h2><Activity size={18}/> سجل أحداث الأمان</h2><p>{events.length} أحداث حديثة</p></div></div>
      <div style={{ display: "grid", gap: 9 }}>
        {events.map((event) => <article key={event.eventId} style={{ padding: 12, border: "1px solid #e8eef0", borderRadius: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{labels[event.action] || event.action}</strong><small>{new Date(event.createdAt).toLocaleString("ar-SA")}</small></div>
          <p style={{ margin: "5px 0", color: "#7a8a91", fontSize: 11 }}>{event.route || "عملية داخلية"} · {event.actorUserId || "زائر غير مسجل"}</p>
          {event.targetId && <small dir="ltr">{event.targetId}</small>}
          {event.userAgent && <small style={{ display: "block", color: "#89969c", overflowWrap: "anywhere" }}>{event.userAgent}</small>}
        </article>)}
        {!events.length && <div className="portal-empty">لم تسجل أحداث أمان بعد.</div>}
      </div>
    </section>}
  </PlatformLayout>;
}
