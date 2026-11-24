"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Award, BadgeCheck, Download, ExternalLink, Printer, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Certificate = {
  serial: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
  certificateType?: string;
  status: string;
  revokedAt?: string;
};

export function CertificateVerificationPage() {
  const [code, setCode] = useState("");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verifyCode = useCallback(async (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      setError("أدخل الرقم التسلسلي للشهادة.");
      return;
    }
    setLoading(true);
    setError("");
    setCertificate(null);
    setValid(false);
    try {
      const response = await fetch("/api/platform/certificates?code=" + encodeURIComponent(normalized), { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.certificate) {
        throw new Error(result.error || "لم يتم العثور على الشهادة.");
      }
      setCertificate(result.certificate as Certificate);
      setValid(result.valid === true);
      if (result.valid !== true) setError(result.error || "هذه الشهادة غير سارية.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر التحقق من الشهادة.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialCode = new URLSearchParams(window.location.search).get("code");
    if (!initialCode) return;
    setCode(initialCode);
    void verifyCode(initialCode);
  }, [verifyCode]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void verifyCode(code);
  };

  const verificationUrl = certificate && typeof window !== "undefined"
    ? window.location.origin + "/certificates/verify?code=" + encodeURIComponent(certificate.serial)
    : "";

  const downloadCertificate = () => {
    const source = document.querySelector<SVGSVGElement>("[data-certificate-svg='true']");
    if (!source || !certificate || !valid) return;
    const copy = source.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serialized = new XMLSerializer().serializeToString(copy);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ETZAN-Certificate-" + certificate.serial + ".svg";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const certificateTitle = certificate?.certificateType === "completion"
    ? "شهادة إتمام"
    : certificate?.certificateType === "participation"
      ? "شهادة مشاركة"
      : "شهادة شكر وتقدير";

  return (
    <PlatformLayout
      title="التحقق من الشهادات"
      description="صفحة عامة للتحقق من صحة الشهادات الصادرة عن منصة اتزان باستخدام الرقم التسلسلي أو رمز QR."
    >
      <section className="certificate-verify-card">
        <div>
          <ShieldCheck size={24} />
          <h2>التحقق من شهادة إلكترونية</h2>
          <p>أدخل الرقم التسلسلي المطبوع على الشهادة أو افتح الرابط المرفق برمز QR.</p>
        </div>
        <form onSubmit={submit}>
          <input
            required
            aria-label="الرقم التسلسلي"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="ETZ-2026-XXXXXXXXXXXX"
            dir="ltr"
            autoComplete="off"
          />
          <button type="submit" disabled={loading}>
            <Search size={15} /> {loading ? "جارٍ التحقق..." : "تحقق من الشهادة"}
          </button>
        </form>
        {error && (
          <p className={certificate && !valid ? "certificate-error" : "certificate-error"} role="status">
            {certificate && !valid ? <ShieldAlert size={15} /> : null} {error}
          </p>
        )}
      </section>

      {certificate && (
        <section className={"certificate-result " + (valid ? "is-valid" : "is-revoked")} aria-live="polite">
          <div className={"certificate-status-banner " + (valid ? "valid" : "revoked")}>
            {valid ? <BadgeCheck size={19} /> : <ShieldAlert size={19} />}
            <div>
              <strong>{valid ? "الشهادة صحيحة وسارية" : "الشهادة ملغاة وغير صالحة"}</strong>
              <span>{valid ? "تم العثور على سجل مطابق في قاعدة بيانات منصة اتزان." : "سجل الشهادة موجود، لكن تم إلغاؤها من إدارة المنصة."}</span>
            </div>
          </div>

          {valid && (
            <div className="certificate-document-frame">
              <svg
                data-certificate-svg="true"
                className="certificate-svg"
                viewBox="0 0 1200 850"
                role="img"
                aria-label={certificateTitle + " باسم " + certificate.learnerName}
              >
                <defs>
                  <linearGradient id="etzanCertificateGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#c9ab72" />
                    <stop offset="50%" stopColor="#e3d1a4" />
                    <stop offset="100%" stopColor="#a9874f" />
                  </linearGradient>
                  <linearGradient id="etzanCertificateTeal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#174e4c" />
                    <stop offset="100%" stopColor="#2a8177" />
                  </linearGradient>
                </defs>
                <rect width="1200" height="850" fill="#fbfaf6" />
                <rect x="24" y="24" width="1152" height="802" rx="20" fill="#fff" stroke="url(#etzanCertificateGold)" strokeWidth="8" />
                <rect x="44" y="44" width="1112" height="762" rx="12" fill="none" stroke="#1f625c" strokeWidth="2" />
                <path d="M72 170 V72 H170 M1030 72 H1128 V170 M72 680 V778 H170 M1030 778 H1128 V680" fill="none" stroke="url(#etzanCertificateGold)" strokeWidth="7" />
                <circle cx="600" cy="100" r="29" fill="#eff6f2" stroke="#c5a46c" strokeWidth="2" />
                <path d="M586 100 l10 10 20 -23" fill="none" stroke="#1f7169" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <text x="600" y="160" textAnchor="middle" direction="rtl" fontSize="25" fontWeight="700" fill="#1d5c56">اتزان | ETZAN</text>
                <text x="600" y="196" textAnchor="middle" direction="rtl" fontSize="17" fill="#9a8055">من المعرفة إلى الممارسة</text>
                <line x1="300" y1="220" x2="900" y2="220" stroke="#dfd2b8" strokeWidth="2" />
                <text x="600" y="292" textAnchor="middle" direction="rtl" fontSize="50" fontWeight="700" fill="#254d49">{certificateTitle}</text>
                <text x="600" y="350" textAnchor="middle" direction="rtl" fontSize="22" fill="#687d78">تشهد منصة اتزان بأن</text>
                <text
                  x="600"
                  y="425"
                  textAnchor="middle"
                  direction="rtl"
                  unicodeBidi="plaintext"
                  fontSize={certificate.learnerName.length > 30 ? "36" : "46"}
                  fontWeight="700"
                  fill="#1d6c63"
                >
                  {certificate.learnerName}
                </text>
                <line x1="270" y1="448" x2="930" y2="448" stroke="#c8a976" strokeWidth="2" />
                <text x="600" y="492" textAnchor="middle" direction="rtl" fontSize="20" fill="#647a75">قد أتم بنجاح متطلبات البرنامج التدريبي</text>
                <text
                  x="600"
                  y="540"
                  textAnchor="middle"
                  direction="rtl"
                  unicodeBidi="plaintext"
                  fontSize={certificate.courseTitle.length > 52 ? "25" : "32"}
                  fontWeight="700"
                  fill="#254d49"
                >
                  {certificate.courseTitle}
                </text>
                <text x="600" y="580" textAnchor="middle" direction="rtl" fontSize="17" fill="#87928b">
                  تاريخ الإصدار: {new Date(certificate.issuedAt).toLocaleDateString("ar-EG")}
                </text>
                <g transform="translate(530 610)">
                  <QRCodeSVG value={verificationUrl} size={140} level="H" bgColor="#ffffff" fgColor="#173f3b" />
                </g>
                <text x="600" y="775" textAnchor="middle" direction="ltr" fontSize="18" fontWeight="700" fill="#315d57">
                  {certificate.serial}
                </text>
                <text x="600" y="800" textAnchor="middle" direction="rtl" fontSize="13" fill="#81908a">
                  امسح رمز QR للتحقق من صحة الشهادة إلكترونياً
                </text>
              </svg>
            </div>
          )}

          <div className="certificate-public-details">
            <div><span>اسم المستفيد</span><strong>{certificate.learnerName}</strong></div>
            <div><span>البرنامج التدريبي</span><strong>{certificate.courseTitle}</strong></div>
            <div><span>الرقم التسلسلي</span><strong dir="ltr">{certificate.serial}</strong></div>
            <div><span>تاريخ الإصدار</span><strong>{new Date(certificate.issuedAt).toLocaleDateString("ar-EG")}</strong></div>
            {!valid && certificate.revokedAt && (
              <div><span>تاريخ الإلغاء</span><strong>{new Date(certificate.revokedAt).toLocaleDateString("ar-EG")}</strong></div>
            )}
          </div>

          {valid && (
            <div className="certificate-actions">
              <button type="button" className="portal-button" onClick={downloadCertificate}>
                <Download size={15} /> تنزيل الشهادة (SVG)
              </button>
              <button type="button" className="portal-button secondary" onClick={() => window.print()}>
                <Printer size={15} /> طباعة / حفظ PDF
              </button>
            </div>
          )}
          <p className="certificate-disclaimer">
            الشهادة إثبات إتمام للبرنامج المسجل فقط، ولا تمثل ترخيصاً مهنياً أو مؤهلاً أكاديمياً مستقلاً.
          </p>
        </section>
      )}

      <div className="portal-callout certificate-public-note">
        <Award size={16} /> خدمة التحقق متاحة للجميع دون تسجيل الدخول. لا تظهر في صفحة التحقق بيانات الحساب أو معلومات المتدرب الأخرى.
      </div>
    </PlatformLayout>
  );
}
