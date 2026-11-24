"use client";

import { useEffect, useState } from "react";
import { Award, ExternalLink, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Certificate = {
  serial: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
  status: string;
};

export default function MyCertificatesPage() {
  const [items, setItems] = useState<Certificate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/platform/certificates?mine=1", { cache: "no-store" })
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

  return (
    <PlatformLayout
      title="شهاداتي"
      description="كل الشهادات المسجلة لحسابك، مع رابط التحقق العام والتنزيل والطباعة."
    >
      <div className="portal-callout"><ShieldCheck size={16} /> تظهر الشهادة بعد استيفاء شروط الدورة واعتماد الحضور عند الحاجة. يمكنك مشاركة رابط التحقق مع جهة العمل أو التدريب.</div>
      {error && <p role="alert" className="certificate-error">{error}</p>}
      {loading ? <div className="portal-empty">جارٍ تحميل شهاداتك...</div> : (
        <div className="my-certificates-list">
          {items.map((certificate) => (
            <article className="portal-card my-certificate-card" key={certificate.serial}>
              <div className="my-certificate-icon"><Award size={21} /></div>
              <div className="my-certificate-details">
                <div className="my-certificate-title">
                  <h3>{certificate.courseTitle}</h3>
                  <span className={"portal-chip " + (certificate.status === "issued" ? "certificate-chip-valid" : "certificate-chip-revoked")}>{certificate.status === "issued" ? "سارية" : "ملغاة"}</span>
                </div>
                <p>{certificate.learnerName} · {new Date(certificate.issuedAt).toLocaleDateString("ar-EG")}</p>
                <small dir="ltr">{certificate.serial}</small>
                <a href={"/certificates/verify?code=" + encodeURIComponent(certificate.serial)}>
                  <ExternalLink size={14} /> {certificate.status === "issued" ? "فتح الشهادة وتنزيلها أو طباعتها" : "عرض حالة الشهادة"}
                </a>
              </div>
            </article>
          ))}
          {items.length === 0 && <div className="portal-empty">لا توجد شهادات صادرة لحسابك حتى الآن.</div>}
        </div>
      )}
    </PlatformLayout>
  );
}
