"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, ArrowUpLeft, Award, BookOpen, Brain, CalendarDays,
  ClipboardCheck, GraduationCap, PlayCircle, TrendingUp, Video,
  type LucideIcon,
} from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { HomeHeroSlider } from "@/components/home-hero-slider";

type DashboardData = {
  user: { name: string; email: string };
  summary: {
    enrolledCourses: number; completedCourses: number; completedLessons: number; totalLessons: number;
    progressPercent: number; certificates: number; payments: number; upcomingAppointments: number;
    simulations: number; assessmentAttempts: number;
  };
  courses: Array<{
    id: string; title: string; trackId: string; trackTitle: string; mode: string; status: string;
    paymentStatus: string; paid: boolean; completedLessons: number; totalLessons: number;
    progressPercent: number; updatedAt?: string | null;
  }>;
  tracks: Array<{ id: string; title: string; summary: string; enrolledCount: number }>;
  certificates: Array<{ serial: string; courseTitle: string; issuedAt: string; status: string }>;
  payments: Array<{ providerPaymentId: string; requestId: string; amountMajor: number | null; currency: string; status: string; paymentMethod?: string; paidAt?: string; createdAt?: string }>;
  appointments: Array<{ requestId: string; status: string; serviceId?: string; providerName?: string; preferredAt?: string; durationMinutes?: number; paymentStatus?: string; quotedAmount?: number; currency?: string; zoomMeeting?: { joinUrl?: string } }>;
  sessions: Array<{ sessionId: string; courseTitle: string; topic: string; startTime: string; durationMinutes: number; joinUrl: string; recordingUrl?: string }>;
  simulations: Array<{ activityId: string; caseTitle: string; score: number; completedAt: string; aiReviewStatus?: string; supervisorReview?: { overallScore?: number }; clinicalFormulation?: { reviewStatus?: string } }>;
  assessmentAttempts: Array<{ attemptId: string; title: string; score: number; total: number; percentage: number; passed?: boolean; kind?: string; createdAt: string }>;
};

const money = (amount: number | null, currency: string) =>
  amount === null ? "القيمة غير متاحة" : new Intl.NumberFormat("ar-SA", { style: "currency", currency: currency || "SAR", maximumFractionDigits: 2 }).format(amount);
const dateTime = (value?: string) => value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "لم يحدد الموعد";
const stateLabel: Record<string, string> = {
  pending_review: "قيد المراجعة", awaiting_payment: "بانتظار الدفع", approved: "معتمد",
  paid: "مدفوع", payment_due: "مستحق الدفع", payment_required: "يلزم الدفع",
  cancellation_requested: "طلب إلغاء قيد المراجعة", cancelled: "ملغي", completed: "مكتمل",
  rejected: "غير معتمد", refunded: "مسترد", issued: "سارية", revoked: "ملغاة",
};

function SectionHeading({ title, description, href, linkLabel }: { title: string; description: string; href?: string; linkLabel?: string }) {
  return <div className="portal-section-title"><div><h2>{title}</h2><p>{description}</p></div>{href && <Link className="portal-link-button secondary" href={href}>{linkLabel || "عرض الكل"} <ArrowUpLeft size={14}/></Link>}</div>;
}

function Metric({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: number | string; hint: string }) {
  return <article className="portal-card trainee-metric-card" style={{ padding: 18, minHeight: 126 }}>
    <span className="track-icon"><Icon size={19}/></span>
    <div style={{ fontSize: 25, fontWeight: 800, marginTop: 10, lineHeight: 1.2 }}>{value}</div>
    <strong style={{ display: "block", marginTop: 5 }}>{label}</strong>
    <small style={{ color: "#7c8a92" }}>{hint}</small>
  </article>;
}

export function TraineeDashboard({ name, email }: { name: string; email: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clinicName, setClinicName] = useState("اتزان");
  const [heroSlides, setHeroSlides] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/site-branding", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(brand => { if (active && brand) setClinicName(String(brand.clinicName || "اتزان")); }).catch(() => {});
    fetch("/api/platform/admin/site-pages?slug=home", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(result => { if (active && Array.isArray(result?.page?.content?.heroSlides)) setHeroSlides(result.page.content.heroSlides.map(String)); }).catch(() => {});
    fetch("/api/trainee/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "تعذر تحميل بيانات لوحة المتدرب.");
        if (active) setData(result as DashboardData);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل البيانات."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const totalActivities = data?.summary.simulations || 0;
  return <PlatformLayout title="لوحة المتدرب" description="مساحة موحدة لدوراتك ومساراتك واختباراتك وشهاداتك ومدفوعاتك ومواعيدك وتقدمك العملي.">
    <div className="trainee-dashboard">
    <section className="trainee-hero-banner"><div className="trainee-hero-copy"><span className="trainee-hero-kicker">مساحتك للتعلم والدعم النفسي</span><h2>أهلاً بك في {clinicName}</h2><p>واصل رحلتك، طوّر مهاراتك، واستفد من البرامج والمسارات المهنية في بيئة تعلم آمنة.</p><div><Link className="portal-button" href="/academy">استكشف الدورات <GraduationCap size={15}/></Link><span className="trainee-hero-user">{name}</span></div></div><div className="trainee-hero-media"><HomeHeroSlider images={heroSlides}/></div></section>

    {error && <div className="portal-callout" role="alert">{error}</div>}
    {loading && <div className="portal-grid trainee-metrics-grid" aria-busy="true" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 12 }}>{[0,1,2,3,4,5].map((item)=><section className="portal-card" key={item}><div className="portal-skeleton" style={{width:38,height:38,borderRadius:11,marginBottom:14}}/><div className="portal-skeleton" style={{width:"58%",height:11,marginBottom:12}}/><div className="portal-skeleton" style={{width:"38%",height:24,marginBottom:10}}/><div className="portal-skeleton" style={{width:"78%",height:9}}/></section>)}</div>}
    {data && <>
      <div className="portal-grid trainee-metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 12 }}>
        <Metric icon={BookOpen} label="دوراتي النشطة" value={data.summary.enrolledCourses} hint={"منها " + data.summary.completedCourses + " مكتملة"}/>
        <Metric icon={TrendingUp} label="تقدم التعلم" value={data.summary.progressPercent + "%"} hint={data.summary.completedLessons + " من " + data.summary.totalLessons + " وحدة"}/>
        <Metric icon={Award} label="الشهادات السارية" value={data.summary.certificates} hint="شهادات إتمام موثقة"/>
        <Metric icon={CalendarDays} label="المواعيد القادمة" value={data.summary.upcomingAppointments} hint="استشارات وفصول مباشرة"/>
        <Metric icon={ClipboardCheck} label="الاختبارات" value={data.summary.assessmentAttempts} hint="محاولات محفوظة"/>
        <Metric icon={Brain} label="المحاكاة" value={totalActivities} hint="جلسات تدريب مسجلة"/>
      </div>

      <section style={{ marginTop: 24 }}>
        <SectionHeading title="دوراتي" description="الدورات التي تقدمت للالتحاق بها وحالة التسجيل والتقدم." href="/academy" linkLabel="كتالوج الدورات"/>
        <div className="portal-grid">
          {data.courses.map((course) => <article className="portal-card trainee-course-card" key={course.id}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}><span className="portal-chip">{course.trackTitle}</span><span className="portal-chip">{course.paid ? "ملتحق" : stateLabel[course.status] || "قيد الإجراء"}</span></div>
            <h3>{course.title}</h3>
            <p>{course.mode === "recorded" ? "تعلم ذاتي مسجل" : course.mode === "hybrid" ? "تعلم مباشر ومسجل" : "تعلم مباشر"}</p>
            <div style={{ height: 8, background: "#edf1f3", borderRadius: 20, overflow: "hidden", margin: "12px 0 7px" }}><div style={{ width: course.progressPercent + "%", height: "100%", background: "#168b86", borderRadius: 20 }}/></div>
            <small style={{ color: "#758493" }}>{course.completedLessons} من {course.totalLessons} وحدة · {course.progressPercent}%</small>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}><Link className="portal-button" href={"/academy/" + course.id}>{course.paid ? "متابعة التعلم" : "تفاصيل الدورة"}</Link>{!course.paid && <span className="portal-chip">{stateLabel[course.paymentStatus] || "بانتظار اعتماد الالتحاق"}</span>}</div>
          </article>)}
          {!data.courses.length && <div className="portal-empty">لم تسجل في دورة بعد. استعرض الأكاديمية واختر دورة للبدء.</div>}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <SectionHeading title="المسارات التخصصية" description="المجالات المهنية المتاحة، مع تمييز المسارات التي بدأت فيها." href="/specialties" linkLabel="كل المسارات"/>
        <div className="portal-grid">
          {data.tracks.map((track) => <article className="portal-card trainee-track-card" key={track.id}>
            <span className="track-icon"><GraduationCap size={18}/></span><h3>{track.title}</h3><p>{track.summary}</p>
            <small style={{ color: "#758493" }}>{track.enrolledCount ? "بدأت هذا المسار في " + track.enrolledCount + " دورة" : "لم تبدأ هذا المسار بعد"}</small>
            <div style={{ marginTop: 12 }}><Link className="portal-link-button secondary" href={"/academy?track=" + encodeURIComponent(track.id)}>استعراض دورات المسار</Link></div>
          </article>)}
        </div>
      </section>

      <div className="portal-grid" style={{ marginTop: 24 }}>
        <section className="portal-card">
          <SectionHeading title="الاختبارات" description="اختبارات الفهم والمحاولات التي تم حفظها." href="/assessments" linkLabel="دخول الاختبارات"/>
          {data.assessmentAttempts.slice(0, 4).map((attempt) => <div key={attempt.attemptId} style={{ padding: "10px 0", borderBottom: "1px solid #edf1f3" }}><strong>{attempt.title}</strong><p style={{ margin: "4px 0", color: "#758493", fontSize: 12 }}>{attempt.score}/{attempt.total} · {attempt.percentage}%{attempt.passed===true?" · ناجح":attempt.passed===false?" · يحتاج إعادة المحاولة":""} · {dateTime(attempt.createdAt)}</p></div>)}
          {!data.assessmentAttempts.length && <p style={{ color: "#758493" }}>لم تحفظ أي محاولة بعد. أكمل اختبار المقاييس واحفظ نتيجتك لتظهر هنا.</p>}
        </section>
        <section className="portal-card">
          <SectionHeading title="تقدم التعلم" description="مؤشر الوحدات المنجزة في الدورات المدفوعة." href="/academy" linkLabel="استكمال التعلم"/>
          <div style={{ fontSize: 34, fontWeight: 800, color: "#168b86" }}>{data.summary.progressPercent}%</div>
          <div style={{ height: 10, background: "#edf1f3", borderRadius: 20, overflow: "hidden", margin: "8px 0 12px" }}><div style={{ width: data.summary.progressPercent + "%", height: "100%", background: "#168b86" }}/></div>
          <p style={{ color: "#758493", fontSize: 13 }}>{data.summary.completedLessons} وحدة مكتملة من أصل {data.summary.totalLessons} وحدة في الدورات النشطة.</p>
          {data.courses.filter((course) => course.paid && course.progressPercent < 100).slice(0, 3).map((course) => <p key={course.id}><Link href={"/academy/" + course.id}>{course.title}</Link> · {course.progressPercent}%</p>)}
        </section>
      </div>

      <section style={{ marginTop: 24 }}>
        <SectionHeading title="الشهادات" description="الشهادات الصادرة لحسابك وحالة صلاحيتها." href="/certificates/mine" linkLabel="كل الشهادات"/>
        <div className="portal-grid">
          {data.certificates.slice(0, 4).map((certificate) => <article className="portal-card" key={certificate.serial}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><Award size={20} color="#168b86"/><span className="portal-chip">{stateLabel[certificate.status] || certificate.status}</span></div><h3>{certificate.courseTitle}</h3><small>{dateTime(certificate.issuedAt)}</small><p dir="ltr" style={{ fontSize: 11, overflowWrap: "anywhere" }}>{certificate.serial}</p><Link className="portal-link-button secondary" href={"/certificates/verify?code=" + encodeURIComponent(certificate.serial)}>فتح الشهادة والتحقق</Link></article>)}
          {!data.certificates.length && <div className="portal-empty">لا توجد شهادات صادرة حتى الآن. ستظهر هنا عند استيفاء متطلبات الإتمام.</div>}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <SectionHeading title="المدفوعات" description="عمليات الدفع المسجلة لحسابك لدى مزود الدفع." href="/membership" linkLabel="العضويات"/>
        <div className="portal-grid">
          {data.payments.slice(0, 6).map((payment) => <article className="portal-card" key={payment.providerPaymentId}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{money(payment.amountMajor, payment.currency || "SAR")}</strong><span className="portal-chip">{stateLabel[payment.status] || payment.status}</span></div><p style={{ color: "#758493", fontSize: 12 }}>{payment.paymentMethod || "وسيلة دفع إلكترونية"} · {dateTime(payment.paidAt || payment.createdAt)}</p><small dir="ltr">{payment.providerPaymentId}</small></article>)}
          {!data.payments.length && <div className="portal-empty">لا توجد عمليات دفع مسجلة لهذا الحساب.</div>}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <SectionHeading title="المواعيد والفصول المباشرة" description="مواعيد الاستشارات وجلسات الدورات المرتبطة بتسجيلك." href="/my-consultations" linkLabel="إدارة المواعيد"/>
        <div className="portal-grid">
          {data.appointments.slice(0, 4).map((appointment) => <article className="portal-card" key={appointment.requestId}><span className="portal-chip">{stateLabel[appointment.status] || appointment.status}</span><h3>استشارة مهنية</h3><p>{appointment.providerName || "مقدم الخدمة"}</p><small>{dateTime(appointment.preferredAt)}</small><div style={{ marginTop: 10 }}><Link className="portal-link-button secondary" href={"/my-consultations?requestId=" + encodeURIComponent(appointment.requestId) + "&email=" + encodeURIComponent(email)}>تفاصيل الموعد</Link>{appointment.zoomMeeting?.joinUrl && <a className="portal-link-button" href={appointment.zoomMeeting.joinUrl} target="_blank" rel="noreferrer">دخول الجلسة <Video size={14}/></a>}</div></article>)}
          {data.sessions.slice(0, 4).map((session) => <article className="portal-card" key={session.sessionId}><span className="portal-chip">فصل مباشر</span><h3>{session.courseTitle}</h3><p>{session.topic}</p><small>{dateTime(session.startTime)} · {session.durationMinutes} دقيقة</small><div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}><a className="portal-link-button" href={session.joinUrl} target="_blank" rel="noreferrer">دخول Zoom <Video size={14}/></a>{session.recordingUrl && <a className="portal-link-button secondary" href={session.recordingUrl} target="_blank" rel="noreferrer">التسجيل <PlayCircle size={14}/></a>}</div></article>)}
          {!data.appointments.length && !data.sessions.length && <div className="portal-empty">لا توجد مواعيد أو فصول مباشرة مرتبطة بحسابك حالياً.</div>}
        </div>
      </section>

      <div className="portal-grid" style={{ marginTop: 24 }}>
        <section className="portal-card">
          <SectionHeading title="المحاكاة والتقييمات" description="سجل جلسات الحالات الافتراضية ونتائج الأداء." href="/simulation" linkLabel="بدء محاكاة"/>
          {data.simulations.slice(0, 5).map((activity) => <div key={activity.activityId} style={{ padding: "10px 0", borderBottom: "1px solid #edf1f3" }}><strong>{activity.caseTitle}</strong><p style={{ margin: "4px 0", color: "#758493", fontSize: 12 }}>نتيجة الحالة: {activity.score}% · {dateTime(activity.completedAt)}</p><small>{activity.supervisorReview?.overallScore !== undefined ? "التقييم الإشرافي: " + activity.supervisorReview.overallScore + "/5" : activity.clinicalFormulation?.reviewStatus === "supervisor_reviewed" ? "تمت المراجعة الإشرافية" : "بانتظار مراجعة المشرف"}</small></div>)}
          {!data.simulations.length && <p style={{ color: "#758493" }}>لم تسجل جلسات محاكاة بعد. ابدأ حالة تدريبية ليظهر تقريرك هنا.</p>}
        </section>
        <section className="portal-card">
          <SectionHeading title="التقييم المهني والكفاءات" description="تابع مهاراتك وملف الكفاءات المهنية." href="/competencies" linkLabel="ملف الكفاءات"/>
          <p>بعد كل محاكاة، راجع الملاحظات ومجالات التحسين ثم عد إلى التدريب لتطوير أدائك.</p>
          <Link className="portal-link-button secondary" href="/competencies">فتح تقارير الكفاءات <Activity size={14}/></Link>
        </section>
      </div>
    </>}
    </div>
  </PlatformLayout>;
}
