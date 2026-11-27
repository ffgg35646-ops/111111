"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ChevronDown, LockKeyhole, PlayCircle,
  ShieldCheck, Video, GraduationCap,
} from "lucide-react";
import { courses, learningTracks } from "@/lib/platform-catalog";
import "./details.css";

type Lesson = { id: string; title: string; videoReady?: boolean };
type CourseDetails = {
  id: string;
  title: string;
  summary: string;
  category: string;
  trackId: string;
  level: string;
  duration: string;
  mode: "recorded" | "live" | "hybrid";
  contentType: "course" | "program";
  lessons: Lesson[];
  outcomes: string[];
};
type PriceRow = { courseId: string; price: number | null; currency: string; active: boolean };

const modeLabels: Record<CourseDetails["mode"], string> = {
  recorded: "مسجلة",
  live: "مباشرة",
  hybrid: "مباشرة ومسجلة",
};

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: currency || "SAR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2) + " " + (currency || "SAR");
  }
}

function CourseDetailsContent() {
  const params = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const courseId = String(params.courseId || "");
  const accountEntry = searchParams.get("source") === "account";
  const staticCourse = courses.find((item) => item.id === courseId);

  const [dynamicCourse, setDynamicCourse] = useState<CourseDetails | null>(null);
  const [loadedCourseId, setLoadedCourseId] = useState("");
  const [courseError, setCourseError] = useState("");
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [selectedLesson, setSelectedLesson] = useState("");
  const [contentOpen, setContentOpen] = useState(true);
  const [branding, setBranding] = useState({ clinicName: "اتزان", logoName: "ETZAN", logoImage: "/etzan-symbol.svg" });
  const [trackNames, setTrackNames] = useState<Record<string, string>>(() => Object.fromEntries(learningTracks.map((item) => [item.id, item.title])));

  const course: CourseDetails | null = staticCourse
    ? {
        id: staticCourse.id,
        title: staticCourse.title,
        summary: staticCourse.summary,
        category: staticCourse.category,
        trackId: staticCourse.trackId,
        level: staticCourse.level,
        duration: staticCourse.duration,
        mode: staticCourse.mode,
        contentType: "course",
        lessons: staticCourse.lessons.map((title, index) => ({ id: String(index + 1), title })),
        outcomes: staticCourse.outcomes,
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
        if (!response.ok || !data.course) throw new Error(data.error || "الكورس غير موجود أو لم يتم نشره بعد.");
        return data.course as CourseDetails;
      })
      .then((item) => {
        if (active) {
          setDynamicCourse(item);
          setCourseError("");
        }
      })
      .catch((error) => {
        if (active) setCourseError(error instanceof Error ? error.message : "تعذر تحميل بيانات الكورس.");
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
        if (!response.ok) throw new Error("تعذر تحميل أسعار الدورات.");
        return Array.isArray(data.courses) ? data.courses as PriceRow[] : [];
      })
      .then((rows) => { if (active) setPrices(rows); })
      .catch(() => { if (active) setPrices([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/specialist-tracks", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.tracks)) return [];
        return data.tracks as Array<{ id: string; title: string }>;
      })
      .then((rows) => {
        if (active) {
          setTrackNames((current) => ({
            ...current,
            ...Object.fromEntries(rows.map((item) => [String(item.id), String(item.title)])),
          }));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/site-branding", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active && data) {
          setBranding({
            clinicName: String(data.clinicName || "اتزان"),
            logoName: String(data.logoName || "ETZAN"),
            logoImage: String(data.logoImage || "/etzan-symbol.svg"),
          });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const activePrice = prices.find((item) => item.courseId === courseId && item.active === true && typeof item.price === "number");
  const amount = activePrice && typeof activePrice.price === "number" ? activePrice.price : null;
  const currency = activePrice?.currency || "SAR";
  const trackTitle = course ? trackNames[course.trackId] || course.category : "";
  const requestPath = "/academy/" + encodeURIComponent(courseId) + "/request";
  const joinHref = accountEntry ? requestPath : "/login?next=" + encodeURIComponent(requestPath);
  const loading = !staticCourse && loadedCourseId !== courseId;
  const activeLesson = course?.lessons.find((lesson) => lesson.id === selectedLesson);

  return (
    <main className="course-public-page" dir="rtl">
      <header className="course-nav">
        <Link className="course-logo" href="/">
          <span className="course-logo-image"><img src={branding.logoImage} alt="" /></span>
          <span><b>{branding.clinicName}</b><small>{branding.logoName} · من المعرفة إلى الممارسة</small></span>
        </Link>
        <nav aria-label="التنقل الرئيسي">
          <Link href="/">الرئيسية</Link>
          <Link className="active" href="/academy">الكورسات</Link>
          <Link href="/classrooms">الجلسات المباشرة</Link>
          <Link href="/books">المكتبة</Link>
          <Link href="/articles">المدونة</Link>
          <Link href="/contact">تواصل معنا</Link>
        </nav>
        <div className="course-nav-actions">
          {accountEntry ? (
            <Link className="course-account-link" href="/dashboard">العودة إلى حسابي</Link>
          ) : (
            <>
              <Link className="course-login-link" href="/login">تسجيل الدخول</Link>
              <Link className="course-register-link" href="/register">إنشاء حساب</Link>
            </>
          )}
        </div>
      </header>

      {loading && <div className="course-state">جارٍ تحميل بيانات الكورس...</div>}
      {!loading && !course && (
        <div className="course-state" role="alert">
          {courseError || "الكورس غير موجود أو لم يتم نشره بعد."}
          <div><Link className="course-back-link" href="/academy">العودة إلى الكورسات</Link></div>
        </div>
      )}

      {!loading && course && (
        <>
          <section className="course-hero">
            <span className="course-hero-kicker">تفاصيل الدورة</span>
            <h1>{course.title}</h1>
            <p>{course.summary}</p>
            <div className="course-tags">
              <span>{trackTitle}</span>
              <span>{course.contentType === "program" ? "برنامج تدريبي" : "كورس تدريبي"}</span>
              <span>{course.level}</span>
              <span>{modeLabels[course.mode]}</span>
            </div>
            <Link className="course-join-button" href={joinHref}>
              <span><ShieldCheck size={17} /> اشترك الآن</span>
              <b>{amount !== null ? money(amount, currency) : "السعر يحدد بعد مراجعة الطلب"}</b>
              <ArrowLeft size={17} />
            </Link>
            <div className="course-hero-decoration circle-one" />
            <div className="course-hero-decoration circle-two" />
          </section>

          <div className="course-details-wrap">
            <div className="course-details-grid">
              <aside className="course-content-panel">
                <h2>محتوى الكورس</h2>
                <button className={"course-content-toggle" + (contentOpen ? " open" : "")} type="button" onClick={() => setContentOpen((value) => !value)} aria-expanded={contentOpen}>
                  <ChevronDown size={17} />
                  <b>المحتوى التعليمي</b>
                  <span>{course.lessons.length} دروس</span>
                </button>
                {contentOpen && (
                  <div className="course-lessons">
                    {course.lessons.map((lesson, index) => (
                      <button
                        type="button"
                        className={"course-lesson" + (selectedLesson === lesson.id ? " selected" : "")}
                        key={lesson.id || index}
                        onClick={() => setSelectedLesson(lesson.id)}
                      >
                        <span className="course-lesson-icon"><PlayCircle size={15} /></span>
                        <b>{lesson.title}</b>
                        <LockKeyhole size={13} className="course-lesson-lock" />
                      </button>
                    ))}
                    {!course.lessons.length && <p className="course-empty-lessons">لم تتم إضافة دروس لهذا الكورس بعد.</p>}
                  </div>
                )}
              </aside>

              <section className="course-preview-panel">
                <div className="course-preview-icon"><Video size={48} /></div>
                <h2>{activeLesson ? activeLesson.title : "معاينة محتوى الكورس"}</h2>
                <p>{activeLesson ? "هذا الدرس مقفل للمشاهدة، ويمكن الوصول إلى محتوى الكورس بعد الاشتراك." : "اختر درساً من القائمة لمعاينته"}</p>
                <div className="course-preview-note">
                  <span>i</span>
                  <div><b>يمكنك مشاهدة الدروس المجانية فقط.</b><small>اشترك للوصول إلى جميع الدروس ومحتوى الدورة.</small></div>
                </div>
              </section>
            </div>

            {course.outcomes.length > 0 && (
              <section className="course-outcomes-panel">
                <h2><GraduationCap size={19} /> نواتج التعلم</h2>
                <div>{course.outcomes.map((outcome) => <span key={outcome}>{outcome}</span>)}</div>
              </section>
            )}
          </div>
        </>
      )}

      <footer className="course-footer">
        <div className="course-footer-grid">
          <section>
            <h2>{branding.clinicName}</h2>
            <p>منصة تدريب مهني متكاملة تنقلك من المعرفة إلى الممارسة، عبر محتوى تدريبي وتطبيق عملي وإشراف مهني.</p>
          </section>
          <section>
            <h3>روابط سريعة</h3>
            <Link href="/about">من نحن</Link>
            <Link href="/academy">الأكاديمية والكورسات</Link>
            <Link href="/articles">المدونة</Link>
            <Link href="/books">المكتبة</Link>
          </section>
          <section>
            <h3>تواصل معنا</h3>
            <Link href="/contact">صفحة التواصل</Link>
            <Link href="/privacy-policy">سياسة الخصوصية</Link>
            <Link href="/terms">الشروط والأحكام</Link>
          </section>
        </div>
        <div className="course-footer-copy">© {new Date().getFullYear()} {branding.clinicName} جميع الحقوق محفوظة</div>
      </footer>
    </main>
  );
}

export default function CourseDetailsPage() {
  return (
    <Suspense fallback={<div className="course-state">جارٍ تحميل تفاصيل الكورس...</div>}>
      <CourseDetailsContent />
    </Suspense>
  );
}
