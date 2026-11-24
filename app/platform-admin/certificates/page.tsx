"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Award, ExternalLink, RefreshCw, Search, ShieldCheck, UserX } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Certificate = {
  serial: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
  status: string;
  certificateType?: string;
  source?: string;
  revokedAt?: string;
  quizScore?: number;
  quizTotal?: number;
  attendanceVerified?: boolean;
};

export default function CertificateAdminPage() {
  const [items, setItems] = useState<Certificate[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [completionVerified, setCompletionVerified] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "issued" | "revoked">("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    const response = await fetch("/api/platform/certificates?admin=1", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر تحميل الشهادات.");
    setItems(data.certificates || []);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/platform/certificates?admin=1", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل الشهادات.");
        if (active) setItems(data.certificates || []);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل الشهادات.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch = !query || [item.serial, item.learnerName, item.courseTitle]
        .some((value) => String(value || "").toLocaleLowerCase("ar").includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [items, search, statusFilter]);

  const issuedCount = items.filter((item) => item.status === "issued").length;
  const revokedCount = items.filter((item) => item.status === "revoked").length;

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssuing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/platform/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerName, courseTitle, certificateType: "completion", completionVerified }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إصدار الشهادة.");
      setNotice("تم إصدار الشهادة بنجاح. الرقم التسلسلي: " + data.certificate.serial);
      setLearnerName("");
      setCourseTitle("");
      setCompletionVerified(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إصدار الشهادة.");
    } finally {
      setIssuing(false);
    }
  }

  async function revoke(serial: string) {
    if (!window.confirm("هل تريد إلغاء هذه الشهادة؟ سيظهر الإلغاء مباشرة في صفحة التحقق العامة.")) return;
    setBusy(serial);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/platform/certificates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serial }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إلغاء الشهادة.");
      setNotice("تم إلغاء الشهادة " + serial + " وتحديث حالتها في التحقق العام.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إلغاء الشهادة.");
    } finally {
      setBusy("");
    }
  }

  return (
    <PlatformLayout
      title="إدارة الشهادات"
      description="متابعة الشهادات التلقائية واليدوية، ومراجعة بياناتها، والتحقق منها، وإلغاء الشهادات غير الصحيحة."
    >
      <div className="portal-callout">
        <ShieldCheck size={16} /> تصدر الشهادة التدريبية تلقائياً عند استكمال جميع الوحدات واجتياز الاختبار واعتماد الحضور للدورات المباشرة والهجينة. ويظل للإدارة حق مراجعة السجلات وإلغاء الشهادات المخالفة.
      </div>

      {error && <p role="alert" className="certificate-error">{error}</p>}
      {notice && <p role="status" className="certificate-admin-notice">{notice}</p>}

      <div className="certificate-admin-stats">
        <article><span>إجمالي السجلات المحملة</span><strong>{items.length}</strong></article>
        <article><span>شهادات سارية</span><strong>{issuedCount}</strong></article>
        <article><span>شهادات ملغاة</span><strong>{revokedCount}</strong></article>
      </div>

      <section className="portal-card certificate-admin-issue">
        <div className="portal-section-title">
          <div><h2><Award size={17} /> إصدار شهادة يدوياً</h2><p>للحالات التي تعتمدها الإدارة خارج مسار الإكمال التلقائي.</p></div>
        </div>
        <form onSubmit={issue}>
          <label>اسم المستفيد<input required minLength={2} maxLength={100} value={learnerName} onChange={(event) => setLearnerName(event.target.value)} placeholder="الاسم كما سيظهر في الشهادة" /></label>
          <label>اسم الدورة أو البرنامج<input required minLength={3} maxLength={180} value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} placeholder="اسم البرنامج التدريبي" /></label>
          <label className="certificate-confirm"><input type="checkbox" checked={completionVerified} onChange={(event) => setCompletionVerified(event.target.checked)} /> أؤكد مراجعة إتمام المتطلبات واعتماد الإصدار.</label>
          <button className="portal-button" disabled={issuing || !completionVerified}>{issuing ? "جارٍ الإصدار..." : "إصدار الشهادة"}</button>
        </form>
      </section>

      <div className="portal-section-title certificate-list-heading">
        <div><h2><Award size={17} /> سجل الشهادات</h2><p>{filteredItems.length} سجل مطابق للبحث والتصفية</p></div>
        <button className="portal-button secondary" onClick={() => load().catch((cause) => setError(cause.message))} disabled={loading}>
          <RefreshCw size={13} /> تحديث السجل
        </button>
      </div>

      <div className="certificate-list-tools">
        <label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالاسم أو الدورة أو الرقم التسلسلي" /></label>
        <div>
          <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>الكل</button>
          <button type="button" className={statusFilter === "issued" ? "active" : ""} onClick={() => setStatusFilter("issued")}>سارية</button>
          <button type="button" className={statusFilter === "revoked" ? "active" : ""} onClick={() => setStatusFilter("revoked")}>ملغاة</button>
        </div>
      </div>

      {loading ? <div className="portal-empty">جارٍ تحميل سجل الشهادات...</div> : (
        <div className="certificate-admin-list">
          {filteredItems.map((item) => (
            <article className="portal-card certificate-admin-row" key={item.serial}>
              <div className="certificate-admin-main">
                <div className="certificate-admin-row-top">
                  <strong>{item.learnerName}</strong>
                  <span className={"portal-chip " + (item.status === "issued" ? "certificate-chip-valid" : "certificate-chip-revoked")}>{item.status === "issued" ? "سارية" : "ملغاة"}</span>
                </div>
                <p>{item.courseTitle}</p>
                <small dir="ltr">{item.serial}</small>
                <div className="certificate-admin-meta">
                  <span>{new Date(item.issuedAt).toLocaleDateString("ar-EG")}</span>
                  <span>{item.source === "automatic" ? "إصدار تلقائي" : "إصدار إداري"}</span>
                  {typeof item.quizScore === "number" && <span>نتيجة الاختبار {item.quizScore}/{item.quizTotal || 3}</span>}
                  {item.attendanceVerified && <span>الحضور معتمد</span>}
                </div>
              </div>
              <div className="certificate-admin-actions">
                <a className="portal-link-button secondary" href={"/certificates/verify?code=" + encodeURIComponent(item.serial)} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} /> التحقق / عرض
                </a>
                {item.status === "issued" && (
                  <button className="portal-button secondary" disabled={busy === item.serial} onClick={() => revoke(item.serial)}>
                    <UserX size={13} /> {busy === item.serial ? "جارٍ الإلغاء..." : "إلغاء الشهادة"}
                  </button>
                )}
              </div>
            </article>
          ))}
          {filteredItems.length === 0 && <div className="portal-empty">لا توجد شهادات تطابق البحث أو حالة التصفية المحددة.</div>}
        </div>
      )}
    </PlatformLayout>
  );
}
