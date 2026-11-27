"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookOpen, Clock3, CreditCard, GraduationCap, HelpCircle, LockKeyhole, Tag } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { courses } from "@/lib/platform-catalog";

type CourseDetails = {
  id: string;
  title: string;
  summary: string;
  category: string;
  level: string;
  duration: string;
  mode: "recorded" | "live" | "hybrid";
  contentType?: "course" | "program";
  lessons: Array<{ id?: string; title: string }>;
};

type CoursePrice = {
  courseId: string;
  price: number | null;
  currency: string;
  active: boolean;
};

const modeLabels: Record<CourseDetails["mode"], string> = {
  recorded: "مسجلة",
  live: "مباشرة",
  hybrid: "مباشرة ومسجلة",
};

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: currency || "SAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export default function CourseOrderDetailsPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = String(params.courseId || "");
  const staticCourse = courses.find((item) => item.id === courseId);
  const [dynamicCourse, setDynamicCourse] = useState<CourseDetails | null>(null);
  const [loadedCourseId, setLoadedCourseId] = useState("");
  const [courseError, setCourseError] = useState<{ id: string; message: string } | null>(null);
  const [prices, setPrices] = useState<CoursePrice[]>([]);
  const [couponCode, setCouponCode] = useState("");

  const course: CourseDetails | null = staticCourse
    ? {
        ...staticCourse,
        contentType: "course",
        lessons: staticCourse.lessons.map((title, index) => ({ id: String(index + 1), title })),
      }
    : dynamicCourse?.id === courseId
      ? dynamicCourse
      : null;

  useEffect(() => {
    if (staticCourse || !courseId) return;
    let active = true;
    fetch("/api/academy/courses/" + encodeURIComponent(courseId), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.course) {
          throw new Error(data.error || "الكورس غير موجود أو لم يتم نشره بعد.");
        }
        return data.course as CourseDetails;
      })
      .then((item) => {
        if (active) {
          setDynamicCourse(item);
          setCourseError(null);
        }
      })
      .catch((cause) => {
        if (active) {
          setCourseError({
            id: courseId,
            message: cause instanceof Error ? cause.message : "تعذر تحميل بيانات الكورس.",
          });
        }
      })
      .finally(() => {
        if (active) setLoadedCourseId(courseId);
      });
    return () => { active = false; };
  }, [courseId, staticCourse]);

  useEffect(() => {
    let active = true;
    fetch("/api/platform/commerce/course-prices", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل الأسعار.");
        return Array.isArray(data.courses) ? data.courses as CoursePrice[] : [];
      })
      .then((rows) => { if (active) setPrices(rows); })
      .catch(() => { if (active) setPrices([]); });
    return () => { active = false; };
  }, []);

  const activePrice = prices.find((item) => item.courseId === courseId && item.active === true && typeof item.price === "number");
  const amount = activePrice && typeof activePrice.price === "number" ? activePrice.price : null;
  const currency = activePrice?.currency || "SAR";
  const lessonCount = course?.lessons.length || 0;
  const loading = !staticCourse && loadedCourseId !== courseId;

  return (
    <PlatformLayout
      title="إنشاء طلب جديد"
      description="راجع بيانات الكورس المختار وملخص الطلب ووسائل الدفع المتاحة."
    >
      {loading && <div className="portal-card order-state">جارٍ تحميل بيانات الكورس...</div>}
      {!loading && !course && (
        <div className="portal-card order-state" role="alert">
          {courseError?.id === courseId ? courseError.message : "الكورس غير موجود أو لم يتم نشره بعد."}
          <div><Link className="portal-link-button secondary" href="/academy">العودة إلى الكورسات</Link></div>
        </div>
      )}

      {!loading && course && (
        <main className="course-order-main">
          <div className="course-order-grid">
            <section className="portal-card course-order-card course-order-summary">
              <h2><BookOpen size={18} /> ملخص الطلب (1)</h2>

              <div className="course-order-item">
                <div className="course-order-image" aria-label="صورة تعريفية للكورس">
                  <GraduationCap size={34} />
                  <span>{course.contentType === "program" ? "برنامج تدريبي" : "كورس اتزان"}</span>
                </div>
                <div className="course-order-info">
                  <h3>{course.title}</h3>
                  <p>{course.summary}</p>
                  <div className="course-order-meta">
                    <span><BookOpen size={13} /> {lessonCount} درس</span>
                    <span><Clock3 size={13} /> {course.duration || "المدة غير محددة"}</span>
                    <span><GraduationCap size={13} /> {modeLabels[course.mode]}</span>
                    {amount !== null && <span className="course-order-price-tag"><Tag size={12} /> {formatMoney(amount, currency)}</span>}
                  </div>
                </div>
              </div>

              <hr />
              <div className="course-order-row">
                <span>سعر الكورس</span>
                <b>{amount !== null ? formatMoney(amount, currency) : "لم يحدد السعر بعد"}</b>
              </div>
              <hr />
              <div className="course-order-row total">
                <span>المجموع</span>
                <b>{amount !== null ? formatMoney(amount, currency) : "يحدد بعد اعتماد السعر"}</b>
              </div>
              <p className="course-order-admin-note">السعر المعروض هو السعر النشط الذي اعتمدته إدارة المنصة لهذا الكورس.</p>
            </section>

            <aside className="portal-card course-order-card course-order-payment">
              <h2><CreditCard size={18} /> طريقة الدفع</h2>

              <div className="course-order-method">
                <div className="course-order-method-icon"><LockKeyhole size={20} /></div>
                <div>
                  <strong>الدفع الإلكتروني الآمن</strong>
                  <p>تُعرض وسائل الدفع المتاحة عبر بوابة الدفع المعتمدة عند تفعيل خطوة إتمام الطلب.</p>
                  <div className="course-payment-brands"><span>مدى</span><span>VISA</span><span>Mastercard</span></div>
                </div>
              </div>

              <div className="course-order-coupon">
                <h3><Tag size={15} /> هل لديك كود خصم؟</h3>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40))}
                  placeholder="أدخل كود الخصم هنا"
                  aria-label="كود الخصم"
                />
                <small>سيتم تطبيق الكود عند استكمال آلية الاشتراك والدفع.</small>
              </div>

              <button className="course-order-pay-button" type="button" disabled>
                الدفع الآن
              </button>
              <p className="course-order-pending-note">خطوة إتمام الاشتراك والدفع لم يتم تفعيلها بعد.</p>

              <div className="course-order-help">
                <p><HelpCircle size={15} /> هل تحتاج مساعدة؟</p>
                <Link href="/support">تواصل مع الدعم الفني</Link>
              </div>

              <p className="course-order-terms">
                باستخدامك للمنصة فإنك توافق على <Link href="/privacy-policy">سياسة الخصوصية</Link>.
              </p>
            </aside>
          </div>
        </main>
      )}

      <style jsx>{`
        .course-order-main{width:100%;padding:4px 0 22px}
        .course-order-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,1fr);gap:24px;width:100%;max-width:1120px;margin:0 auto;align-items:start}
        .course-order-card{padding:22px 20px;border-radius:14px;box-shadow:0 2px 14px rgba(0,0,0,.045)}
        .course-order-card h2{display:flex;align-items:center;gap:9px;font-size:17px;font-weight:800;margin:0 0 20px;color:#263c4b}
        .course-order-card h2 svg{color:#2b9cc5}
        .course-order-item{display:flex;align-items:flex-start;gap:16px;background:#f8fafc;border-radius:10px;padding:17px 15px}
        .course-order-image{width:160px;min-height:112px;flex-shrink:0;border-radius:8px;background:linear-gradient(135deg,#315d91,#1598b6);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:10px}
        .course-order-image span{font-size:11px;font-weight:800}
        .course-order-info{min-width:0;flex:1}
        .course-order-info h3{font-size:15px;font-weight:800;margin:0 0 8px;color:#243a4a;line-height:1.7}
        .course-order-info p{font-size:12px;color:#64748b;line-height:1.8;margin:0 0 12px}
        .course-order-meta{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;color:#475569;font-size:10px}
        .course-order-meta span{display:inline-flex;align-items:center;gap:5px}
        .course-order-meta svg{flex:none}
        .course-order-meta .course-order-price-tag{color:#0b9670;font-weight:800}
        .course-order-card hr{border:0;border-top:1px solid #e2e8f0;margin:22px 0 0}
        .course-order-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:18px 0;font-size:13px;color:#475569}
        .course-order-row b{font-size:13px;color:#1e293b;direction:ltr;text-align:left}
        .course-order-row.total{padding:17px 0 4px;font-size:16px;font-weight:800;color:#1e293b}
        .course-order-row.total b{font-size:16px}
        .course-order-admin-note{margin-top:13px;font-size:10px;line-height:1.8;color:#89979f}
        .course-order-method{display:flex;align-items:flex-start;gap:12px;border:1px solid #9dd5e6;background:#f1faff;border-radius:10px;padding:14px 13px;margin-bottom:20px}
        .course-order-method-icon{width:40px;height:40px;border-radius:9px;background:#279fc3;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .course-order-method strong{font-size:13px;color:#263f50}
        .course-order-method p{font-size:10px;color:#64748b;line-height:1.8;margin:5px 0 9px}
        .course-payment-brands{display:flex;gap:6px;flex-wrap:wrap}
        .course-payment-brands span{padding:4px 7px;border-radius:5px;background:#fff;border:1px solid #dbe8ee;color:#526878;font-size:9px;font-weight:800}
        .course-order-coupon{border:1px dashed #cbd5e1;background:#f8fafc;border-radius:10px;padding:16px 14px;margin-bottom:18px}
        .course-order-coupon h3{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;margin:0 0 11px;color:#334155}
        .course-order-coupon h3 svg{color:#2b9cc5}
        .course-order-coupon input{width:100%;padding:11px 12px;border:1px solid #e2e8f0;border-radius:8px;font:inherit;font-size:11px;background:#fff;color:#334155;outline:none}
        .course-order-coupon input:focus{border-color:#7fc4d9}
        .course-order-coupon small{display:block;margin-top:8px;color:#94a3b8;font-size:9px;line-height:1.7}
        .course-order-pay-button{display:block;width:100%;border:0;border-radius:8px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:13px;font:inherit;font-size:14px;font-weight:700;margin-bottom:8px;opacity:.55;cursor:not-allowed}
        .course-order-pending-note{text-align:center;font-size:9px;color:#94a3b8;margin:0 0 15px}
        .course-order-help{border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:13px;text-align:center;margin-bottom:13px}
        .course-order-help p{display:flex;justify-content:center;align-items:center;gap:6px;font-size:11px;color:#475569;margin:0 0 8px}
        .course-order-help a{font-size:11px;color:#0b7fa8;font-weight:700}
        .course-order-terms{font-size:10px;color:#64748b;text-align:center;line-height:1.8}
        .course-order-terms a{color:#268bb1}
        .order-state{max-width:760px;margin:0 auto;padding:22px}
        @media(max-width:900px){.course-order-grid{grid-template-columns:1fr}.course-order-payment{order:2}}
        @media(max-width:560px){.course-order-card{padding:16px 14px}.course-order-item{flex-direction:column}.course-order-image{width:100%;min-height:140px}.course-order-row{font-size:12px}}
      `}</style>
    </PlatformLayout>
  );
}
