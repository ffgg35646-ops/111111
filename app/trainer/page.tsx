"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Award, BookOpen, CalendarCheck, BarChart3, ClipboardList,
  FileBarChart, GraduationCap, LoaderCircle, RefreshCw, Save, Users, Video,
} from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Course = {
  id: string; title: string; summary: string; category: string; trackId: string; mode: "recorded" | "live" | "hybrid";
  duration: string; lessonCount: number; assignmentStatus: "available" | "mine" | "assigned"; trainerName: string | null;
};
type Person = {
  userId: string; name: string; email: string; paymentStatus: string; completedLessons: number; totalLessons: number;
  preQuizChecked: boolean; preQuizScore: number | null; preQuizTotal: number; quizChecked: boolean; quizScore: number | null; quizTotal: number; quizPassed: boolean; attendanceStatus: string;
  lastActivityAt: string | null; certificateSerial: string | null; certificateStatus: string | null;
};
type QuizQuestion = { q: string; options: string[]; correct: number; why: string };
type Certificate = {
  serial: string; userId: string; learnerName: string; courseTitle: string; issuedAt: string; status: string;
  revokedAt?: string; quizScore?: number; quizTotal?: number;
};
type CourseAssignment = { assignmentId: string; title: string; description: string; dueAt?: string; createdAt: string };
type AssignmentSubmission = { submissionId: string; assignmentId: string; userId: string; studentName: string; studentEmail: string; answer: string; status: string; score?: number; feedback?: string; submittedAt: string };
type Detail = {
  course: { id: string; title: string; category: string; trackId: string; mode: Course["mode"]; duration: string; lessons: string[] };
  roster: Person[]; quiz: QuizQuestion[]; preQuiz: QuizQuestion[]; postQuiz: QuizQuestion[]; quizUpdatedAt: string | null; certificates: Certificate[];
  assignments: CourseAssignment[]; submissions: AssignmentSubmission[];
  report: {
    enrolledCount: number; completedCount: number; completionRate: number; quizAttempts: number; quizPassCount: number;
    quizPassRate: number; averageQuizScore: number; attendanceCount: number; attendanceRate: number | null; certificateCount: number;
    courseAverageRating: number | null; courseReviewCount: number; trainerAverageRating: number | null; trainerReviewCount: number;
  };
};
type Tab = "courses" | "trainees" | "tests" | "assignments" | "attendance" | "results" | "certificates" | "reports";

const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "courses", label: "إدارة الدورات", icon: BookOpen },
  { id: "trainees", label: "المتدربون", icon: Users },
  { id: "tests", label: "الاختبارات", icon: ClipboardList },
  { id: "assignments", label: "الواجبات", icon: FileBarChart },
  { id: "attendance", label: "الحضور", icon: CalendarCheck },
  { id: "results", label: "النتائج", icon: GraduationCap },
  { id: "certificates", label: "الشهادات", icon: Award },
  { id: "reports", label: "تقارير الأداء", icon: BarChart3 },
];
const modeLabel = (mode: Course["mode"]) => mode === "recorded" ? "مسجلة" : mode === "live" ? "مباشرة" : "هجينة";
const attendanceLabel = (status: string) => status === "attended" ? "حاضر" : status === "absent" ? "غائب" : "لم يسجل";
const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—";
const emptyQuestion = (): QuizQuestion => ({ q: "", options: ["", "", ""], correct: 0, why: "" });

export default function TrainerWorkspacePage() {
  const router = useRouter();
  const [trainerName, setTrainerName] = useState("المدرب");
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("courses");
  const [quizDraft, setQuizDraft] = useState<QuizQuestion[]>([]);
  const [assessmentType, setAssessmentType] = useState<"pre" | "post">("post");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [gradeDrafts, setGradeDrafts] = useState<Record<string,{score:string;feedback:string}>>({});
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const assignedCourses = useMemo(() => courses.filter((course) => course.assignmentStatus === "mine"), [courses]);
  const activeCourse = courses.find((course) => course.id === courseId) || null;

  async function loadCourses(chooseFirst = false) {
    const response = await fetch("/api/trainer", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر تحميل الدورات.");
    const rows = Array.isArray(data.courses) ? data.courses as Course[] : [];
    setCourses(rows);
    setTrainerName(data.trainer?.name || "المدرب");
    if (chooseFirst && !courseId) {
      const first = rows.find((course) => course.assignmentStatus === "mine");
      if (first) {
        setCourseId(first.id);
        await loadCourse(first.id);
      }
    }
  }

  async function loadCourse(id: string) {
    if (!id) return;
    setDetailLoading(true);
    try {
      const response = await fetch("/api/trainer?courseId=" + encodeURIComponent(id), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل تفاصيل الدورة.");
      setDetail(data as Detail);
      const selectedQuiz = assessmentType === "pre" ? data.preQuiz : (data.postQuiz || data.quiz);
      setQuizDraft((selectedQuiz || []).map((question: QuizQuestion) => ({
        q: question.q, options: [...question.options], correct: question.correct, why: question.why || "",
      })));
      const assignmentResponse = await fetch("/api/learning/assignments?courseId=" + encodeURIComponent(id), { cache: "no-store" });
      const assignmentData = await assignmentResponse.json();
      if (assignmentResponse.ok) {
        setAssignments(assignmentData.assignments || []);
        setSubmissions(assignmentData.submissions || []);
        setGradeDrafts(Object.fromEntries((assignmentData.submissions || []).map((item: AssignmentSubmission) => [item.submissionId, { score: String(item.score ?? ""), feedback: item.feedback || "" }])));
      }
    } catch (cause) {
      setDetail(null);
      setError(cause instanceof Error ? cause.message : "تعذر تحميل بيانات الدورة.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
        const session = await sessionResponse.json();
        if (!active) return;
        if (!sessionResponse.ok || !session.authenticated) {
          router.replace("/login?next=/trainer");
          return;
        }
        if (session.user?.mustChangePassword) {
          router.replace("/account/change-password");
          return;
        }
        if (session.user?.role !== "trainer") {
          router.replace("/dashboard");
          return;
        }
        setTrainerName(session.user.name || "المدرب");
        const response = await fetch("/api/trainer", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر تحميل الدورات.");
        if (!active) return;
        const rows = Array.isArray(data.courses) ? data.courses as Course[] : [];
        setCourses(rows);
        const first = rows.find((course) => course.assignmentStatus === "mine");
        if (first) {
          setCourseId(first.id);
          const detailResponse = await fetch("/api/trainer?courseId=" + encodeURIComponent(first.id), { cache: "no-store" });
          const detailData = await detailResponse.json();
          if (!detailResponse.ok) throw new Error(detailData.error || "تعذر تحميل تفاصيل الدورة.");
          if (active) {
            setDetail(detailData as Detail);
            const selectedQuiz = assessmentType === "pre" ? detailData.preQuiz : (detailData.postQuiz || detailData.quiz);
            setQuizDraft((selectedQuiz || []).map((question: QuizQuestion) => ({
              q: question.q, options: [...question.options], correct: question.correct, why: question.why || "",
            })));
            const assignmentResponse = await fetch("/api/learning/assignments?courseId=" + encodeURIComponent(first.id), { cache: "no-store" });
            const assignmentData = await assignmentResponse.json();
            if (assignmentResponse.ok) {
              setAssignments(assignmentData.assignments || []);
              setSubmissions(assignmentData.submissions || []);
              setGradeDrafts(Object.fromEntries((assignmentData.submissions || []).map((item: AssignmentSubmission) => [item.submissionId, { score: String(item.score ?? ""), feedback: item.feedback || "" }])));
            }
          }
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل لوحة المدرب.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [router]);

  async function selectCourse(id: string) {
    setError(""); setNotice("");
    setCourseId(id);
    const selected = courses.find((course) => course.id === id);
    if (selected?.assignmentStatus !== "mine") {
      setDetail(null);
      setTab("courses");
      return;
    }
    await loadCourse(id);
  }

  async function claimCourse(course: Course) {
    setBusy(course.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/trainer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_course", courseId: course.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إسناد الدورة.");
      setNotice("تم إسناد الدورة إلى حسابك وأصبحت متاحة لإدارة المتدربين والاختبارات والحضور.");
      const listResponse = await fetch("/api/trainer", { cache: "no-store" });
      const listData = await listResponse.json();
      if (!listResponse.ok) throw new Error(listData.error || "تم الإسناد لكن تعذر تحديث قائمة الدورات.");
      setCourses(listData.courses || []);
      setCourseId(course.id);
      await loadCourse(course.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إسناد الدورة.");
    } finally {
      setBusy("");
    }
  }

  async function refresh() {
    setError(""); setNotice("");
    try {
      await loadCourses();
      if (courseId && activeCourse?.assignmentStatus === "mine") await loadCourse(courseId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث البيانات.");
    }
  }

  async function saveQuiz() {
    if (!detail) return;
    setBusy("quiz"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/trainer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_quiz", courseId: detail.course.id, assessmentType, questions: quizDraft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ الاختبار.");
      setNotice("تم حفظ " + (assessmentType === "pre" ? "الاختبار القبلي" : "الاختبار البعدي") + " ونشر النسخة المحدّثة للمتدربين.");
      await loadCourse(detail.course.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ الاختبار.");
    } finally {
      setBusy("");
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || busy) return;
    setBusy("assignment-create"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/learning/assignments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_assignment", courseId: detail.course.id, title: assignmentTitle, description: assignmentDescription, dueAt: assignmentDueAt || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر نشر الواجب.");
      setAssignmentTitle(""); setAssignmentDescription(""); setAssignmentDueAt("");
      setNotice("تم نشر الواجب وأصبح ظاهراً للمتدربين المسجلين.");
      await loadCourse(detail.course.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر نشر الواجب.");
    } finally { setBusy(""); }
  }

  async function gradeSubmission(submission: AssignmentSubmission) {
    const draft = gradeDrafts[submission.submissionId] || { score: "", feedback: "" };
    setBusy(submission.submissionId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/learning/assignments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: submission.submissionId, score: Number(draft.score), feedback: draft.feedback }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ التقييم.");
      setNotice("تم حفظ درجة الواجب وملاحظات المدرب.");
      await loadCourse(detail?.course.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ التقييم.");
    } finally { setBusy(""); }
  }

  async function markAttendance(userId: string, status: "attended" | "absent") {
    if (!detail) return;
    setBusy(userId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/attendance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: detail.course.id, userId, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تسجيل الحضور.");
      setNotice("تم حفظ حالة الحضور.");
      await loadCourse(detail.course.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تسجيل الحضور.");
    } finally {
      setBusy("");
    }
  }

  function updateQuestion(index: number, patch: Partial<QuizQuestion>) {
    setQuizDraft((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function selectAssessment(type: "pre" | "post") {
    setAssessmentType(type);
    if (!detail) return;
    const questions = type === "pre" ? detail.preQuiz : (detail.postQuiz || detail.quiz);
    setQuizDraft((questions || []).map((question) => ({
      q: question.q, options: [...question.options], correct: question.correct, why: question.why || "",
    })));
  }

  if (loading) {
    return <PlatformLayout title="لوحة المدرب" description="مساحة العمل التدريبية"><div className="portal-empty"><LoaderCircle size={16} /> جارٍ تحميل لوحة المدرب...</div></PlatformLayout>;
  }

  return (
    <PlatformLayout title="لوحة المدرب" description="إدارة الدورات المسندة إليك، ومتابعة المتدربين والاختبارات والحضور والنتائج والشهادات وتقارير الأداء.">
      <section className="trainer-welcome portal-card">
        <div><span>مساحة المدرب</span><h2>{trainerName}</h2><p>{assignedCourses.length} دورة مسندة إلى حسابك · بيانات المتدربين محصورة في دوراتك فقط.</p></div>
        <button className="portal-button secondary" onClick={() => void refresh()} disabled={detailLoading}><RefreshCw size={14}/> تحديث البيانات</button>
      </section>

      {error && <div className="portal-callout trainer-alert" role="alert">{error}</div>}
      {notice && <div className="portal-callout trainer-notice" role="status">{notice}</div>}

      <div className="trainer-tabs" role="tablist" aria-label="أقسام لوحة المدرب">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      {tab === "courses" && (
        <section>
          <div className="portal-section-title"><div><h2>الدورات التدريبية</h2><p>استلم إدارة دورة غير مسندة، أو افتح دورة مسندة إليك لمتابعة تشغيلها.</p></div><span className="portal-chip">{assignedCourses.length} مسندة إليك</span></div>
          {detail?.course && <article className="portal-card trainer-current-course">
            <div><span className="portal-chip">الدورة المحددة</span><h3>{detail.course.title}</h3><p>{detail.course.duration} · {detail.course.lessons.length} وحدات · {modeLabel(detail.course.mode)}</p></div>
            <div className="trainer-course-actions"><button className="portal-button" onClick={() => setTab("trainees")}><Users size={14}/> المتدربون</button><Link className="portal-button secondary" href="/platform-admin/classrooms"><Video size={14}/> إدارة الفصول</Link></div>
          </article>}
          <div className="trainer-course-grid">
            {courses.map((course) => <article className="portal-card trainer-course-card" key={course.id}>
              <div className="trainer-course-card-top"><span className={"course-mode " + course.mode}>{modeLabel(course.mode)}</span><span className="portal-chip">{course.lessonCount} وحدات</span></div>
              <h3>{course.title}</h3><p>{course.summary}</p>
              <small>{course.category} · {course.duration}</small>
              {course.assignmentStatus === "mine" ? (
                <button className="portal-button" onClick={() => { void selectCourse(course.id); setTab("trainees"); }}>فتح إدارة الدورة</button>
              ) : course.assignmentStatus === "assigned" ? (
                <span className="trainer-assignment-state">مسندة إلى {course.trainerName || "مدرب آخر"}</span>
              ) : (
                <button className="portal-button secondary" disabled={busy === course.id} onClick={() => void claimCourse(course)}>
                  {busy === course.id ? "جارٍ الإسناد..." : "استلام إدارة الدورة"}
                </button>
              )}
            </article>)}
          </div>
          {!courses.length && <div className="portal-empty">لا توجد دورات في الكتالوج التدريبي حالياً.</div>}
        </section>
      )}

      {detailLoading && <div className="portal-empty"><LoaderCircle size={15}/> جارٍ تحميل بيانات الدورة المحددة...</div>}
      {tab !== "courses" && !detail && !detailLoading && (
        <div className="portal-card trainer-empty-state"><BookOpen size={22}/><h3>اختر دورة مسندة إليك أولاً</h3><p>من قسم إدارة الدورات، استلم دورة متاحة أو افتح إحدى دوراتك الحالية.</p><button className="portal-button" onClick={() => setTab("courses")}>الانتقال إلى إدارة الدورات</button></div>
      )}

      {tab !== "courses" && detail && (
        <section className="trainer-workspace-panel">
          <div className="trainer-selected-course">
            <div><span>الدورة المحددة</span><strong>{detail.course.title}</strong></div>
            <select value={detail.course.id} onChange={(event) => void selectCourse(event.target.value)}>
              {assignedCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </div>

          {tab === "trainees" && <>
            <div className="portal-section-title"><div><h2><Users size={17}/> المتدربون المسجلون</h2><p>{detail.roster.length} تسجيل معتمد مرتبط بالدورة المحددة.</p></div></div>
            <div className="trainer-table-wrap"><table className="trainer-table"><thead><tr><th>المتدرب</th><th>البريد</th><th>التقدم</th><th>الاختبار القبلي</th><th>الاختبار البعدي</th><th>الحضور</th></tr></thead><tbody>
              {detail.roster.map((person) => <tr key={person.userId}><td>{person.name}</td><td dir="ltr">{person.email}</td><td>{person.completedLessons}/{person.totalLessons}</td><td>{person.preQuizChecked ? person.preQuizScore + "/" + person.preQuizTotal : "لم يؤد بعد"}</td><td>{person.quizChecked ? person.quizScore + "/" + person.quizTotal : "لم يؤد بعد"}</td><td>{detail.course.mode === "recorded" ? "غير مطلوب" : attendanceLabel(person.attendanceStatus)}</td></tr>)}
            </tbody></table></div>
            {!detail.roster.length && <div className="portal-empty">لا توجد تسجيلات معتمدة مرتبطة بهذه الدورة حتى الآن.</div>}
          </>}

          {tab === "tests" && <>
            <div className="portal-section-title"><div><h2><ClipboardList size={17}/> الاختبارات القبلية والبعدية</h2><p>{quizDraft.length} سؤالاً · حد الاجتياز {Math.ceil(quizDraft.length * 2 / 3)} إجابات صحيحة.</p></div><button className="portal-button secondary" onClick={() => setQuizDraft((rows) => rows.length < 12 ? [...rows, emptyQuestion()] : rows)} disabled={quizDraft.length >= 12}>إضافة سؤال</button></div>
            <div className="trainer-tabs" role="group" aria-label="اختيار نوع الاختبار">
              <button type="button" className={assessmentType === "pre" ? "active" : ""} onClick={() => selectAssessment("pre")}>الاختبار القبلي</button>
              <button type="button" className={assessmentType === "post" ? "active" : ""} onClick={() => selectAssessment("post")}>الاختبار البعدي</button>
            </div>
            <div className="trainer-test-note">التغييرات هنا تُنشر على اختبار المتدربين لهذه الدورة فقط. يُطلب من المتدرب إعادة محاولة الاختبار بعد تحديثه.</div>
            <div className="trainer-questions">
              {quizDraft.map((question, index) => <article className="portal-card trainer-question" key={index}>
                <div className="trainer-question-heading"><strong>السؤال {index + 1}</strong>{quizDraft.length > 3 && <button type="button" className="trainer-remove" onClick={() => setQuizDraft((rows) => rows.filter((_, itemIndex) => itemIndex !== index))}>حذف</button>}</div>
                <label>نص السؤال<textarea value={question.q} maxLength={240} onChange={(event) => updateQuestion(index, { q: event.target.value })} placeholder="اكتب سؤالاً واضحاً ومباشراً"/></label>
                <div className="trainer-answer-grid">{question.options.map((option, optionIndex) => <label key={optionIndex}><span>الخيار {optionIndex + 1}</span><input value={option} maxLength={180} onChange={(event) => updateQuestion(index, { options: question.options.map((value, itemIndex) => itemIndex === optionIndex ? event.target.value : value) })}/><span className="trainer-correct-choice"><input type="radio" name={"correct-" + index} checked={question.correct === optionIndex} onChange={() => updateQuestion(index, { correct: optionIndex })}/> إجابة صحيحة</span></label>)}</div>
                <label>تفسير الإجابة<textarea value={question.why} maxLength={500} onChange={(event) => updateQuestion(index, { why: event.target.value })} placeholder="تغذية راجعة تعليمية تظهر بعد الإجابة"/></label>
              </article>)}
            </div>
            <button className="portal-button" onClick={() => void saveQuiz()} disabled={busy === "quiz" || quizDraft.length < 3}>{busy === "quiz" ? <LoaderCircle size={14}/> : <Save size={14}/>} حفظ ونشر {assessmentType === "pre" ? "الاختبار القبلي" : "الاختبار البعدي"}</button>
          </>}

          {tab === "assignments" && <>
            <div className="portal-section-title"><div><h2><FileBarChart size={17}/> واجبات الدورة وتسليمات المتدربين</h2><p>انشر تكليفاً جديداً، ثم راجع التسليمات وسجل الدرجة والتغذية الراجعة.</p></div></div>
            <form className="portal-card" onSubmit={(event) => void createAssignment(event)} style={{display:"grid",gap:10,marginBottom:14}}>
              <label style={{display:"grid",gap:6}}>عنوان الواجب<input required minLength={4} maxLength={160} value={assignmentTitle} onChange={event=>setAssignmentTitle(event.target.value)} placeholder="مثال: تطبيق نموذج تقدير الحالة"/></label>
              <label style={{display:"grid",gap:6}}>تعليمات الواجب<textarea required minLength={10} maxLength={3000} rows={4} value={assignmentDescription} onChange={event=>setAssignmentDescription(event.target.value)} placeholder="اشرح المطلوب ومعايير التسليم..."/></label>
              <label style={{display:"grid",gap:6}}>آخر موعد للتسليم (اختياري)<input type="datetime-local" value={assignmentDueAt} onChange={event=>setAssignmentDueAt(event.target.value)}/></label>
              <div><button className="portal-button" disabled={busy==="assignment-create"}>{busy==="assignment-create"?"جارٍ النشر...":"نشر الواجب"}</button></div>
            </form>
            {assignments.map(assignment=><article className="portal-card" key={assignment.assignmentId} style={{display:"grid",gap:10,marginBottom:12}}>
              <div><strong>{assignment.title}</strong><p>{assignment.description}</p><small>عدد التسليمات: {submissions.filter(item=>item.assignmentId===assignment.assignmentId).length}</small></div>
              {submissions.filter(item=>item.assignmentId===assignment.assignmentId).map(submission=><div key={submission.submissionId} style={{borderTop:"1px solid #e8eeee",paddingTop:12,display:"grid",gap:8}}>
                <div><strong>{submission.studentName}</strong> <small>{submission.studentEmail} · {dateLabel(submission.submittedAt)}</small></div>
                <div style={{whiteSpace:"pre-wrap",fontSize:11,lineHeight:1.9,color:"#526b74"}}>{submission.answer}</div>
                <div style={{display:"grid",gridTemplateColumns:"minmax(100px,150px) minmax(0,1fr)",gap:8}}>
                  <label style={{display:"grid",gap:5}}>الدرجة من 100<input type="number" min="0" max="100" step="1" value={(gradeDrafts[submission.submissionId]||{score:"",feedback:""}).score} onChange={event=>setGradeDrafts(current=>({...current,[submission.submissionId]:{...(current[submission.submissionId]||{score:"",feedback:""}),score:event.target.value}}))}/></label>
                  <label style={{display:"grid",gap:5}}>ملاحظات التصحيح<textarea rows={2} value={(gradeDrafts[submission.submissionId]||{score:"",feedback:""}).feedback} onChange={event=>setGradeDrafts(current=>({...current,[submission.submissionId]:{...(current[submission.submissionId]||{score:"",feedback:""}),feedback:event.target.value}}))}/></label>
                </div>
                <div><button type="button" className="portal-button secondary" disabled={busy===submission.submissionId} onClick={()=>void gradeSubmission(submission)}>{busy===submission.submissionId?"جارٍ الحفظ...":submission.status==="graded"?"تحديث التقييم":"حفظ التقييم"}</button>{submission.status==="graded"&&<small> · تم تصحيحه: {submission.score}/100</small>}</div>
              </div>)}
              {!submissions.some(item=>item.assignmentId===assignment.assignmentId)&&<div className="portal-empty">لم تصل تسليمات لهذا الواجب بعد.</div>}
            </article>)}
            {!assignments.length&&<div className="portal-empty">لم تنشر واجبات لهذه الدورة حتى الآن.</div>}
          </>}

          {tab === "attendance" && <>
            <div className="portal-section-title"><div><h2><CalendarCheck size={17}/> سجل الحضور</h2><p>تسجيل الحضور شرط لإصدار شهادة الدورات المباشرة والهجينة.</p></div></div>
            {detail.course.mode === "recorded" ? <div className="portal-callout">هذه دورة مسجلة؛ لا يتطلب إتمامها تسجيل حضور.</div> : <div className="trainer-attendance-list">
              {detail.roster.map((person) => <article className="portal-card trainer-person-row" key={person.userId}>
                <div><strong>{person.name}</strong><small>{person.email}</small><span className="portal-chip">{attendanceLabel(person.attendanceStatus)}</span></div>
                <div><button className="portal-button" disabled={busy === person.userId} onClick={() => void markAttendance(person.userId, "attended")}>حاضر</button><button className="portal-button secondary" disabled={busy === person.userId} onClick={() => void markAttendance(person.userId, "absent")}>غائب</button></div>
              </article>)}
              {!detail.roster.length && <div className="portal-empty">لا يوجد متدربون معتمدون لتسجيل حضورهم.</div>}
            </div>}
          </>}

          {tab === "results" && <>
            <div className="portal-section-title"><div><h2><GraduationCap size={17}/> نتائج المتدربين</h2><p>نتائج اختبار الدورة ومستوى إكمال الوحدات.</p></div></div>
            <div className="trainer-table-wrap"><table className="trainer-table"><thead><tr><th>المتدرب</th><th>الوحدات المكتملة</th><th>الاختبار القبلي</th><th>الاختبار البعدي</th><th>الحالة</th><th>آخر نشاط</th></tr></thead><tbody>
              {detail.roster.map((person) => <tr key={person.userId}><td>{person.name}</td><td>{person.completedLessons}/{person.totalLessons}</td><td>{person.preQuizChecked ? person.preQuizScore + " / " + person.preQuizTotal : "لم يؤد بعد"}</td><td>{person.quizChecked ? person.quizScore + " / " + person.quizTotal : "لم يؤد بعد"}</td><td><span className={"trainer-result-state " + (person.quizPassed ? "passed" : "pending")}>{person.quizPassed ? "اجتاز" : person.quizChecked ? "لم يجتز" : "قيد الانتظار"}</span></td><td>{dateLabel(person.lastActivityAt)}</td></tr>)}
            </tbody></table></div>
            {!detail.roster.length && <div className="portal-empty">ستظهر النتائج هنا بعد التحاق المتدربين بالدورة.</div>}
          </>}

          {tab === "certificates" && <>
            <div className="portal-section-title"><div><h2><Award size={17}/> شهادات الدورة</h2><p>عرض الشهادات الصادرة تلقائياً للدورة المحددة والتحقق من حالتها.</p></div></div>
            <div className="trainer-table-wrap"><table className="trainer-table"><thead><tr><th>المستفيد</th><th>الرقم التسلسلي</th><th>تاريخ الإصدار</th><th>الحالة</th><th>التحقق</th></tr></thead><tbody>
              {detail.certificates.map((certificate) => <tr key={certificate.serial}><td>{certificate.learnerName}</td><td dir="ltr">{certificate.serial}</td><td>{dateLabel(certificate.issuedAt)}</td><td>{certificate.status === "issued" ? "سارية" : "ملغاة"}</td><td><Link href={"/certificates/verify?code=" + encodeURIComponent(certificate.serial)}>فتح التحقق</Link></td></tr>)}
            </tbody></table></div>
            {!detail.certificates.length && <div className="portal-empty">لم تصدر شهادات لهذه الدورة بعد. تصدر الشهادة تلقائياً بعد استيفاء جميع الشروط.</div>}
          </>}

          {tab === "reports" && <>
            <div className="portal-section-title"><div><h2><FileBarChart size={17}/> تقرير أداء الدورة</h2><p>مؤشرات مستمدة من التقدم والاختبارات والحضور والشهادات المسجلة.</p></div></div>
            <div className="trainer-report-grid">
              <article><span>المتدربون المسجلون</span><strong>{detail.report.enrolledCount}</strong></article>
              <article><span>أكملوا الدورة</span><strong>{detail.report.completedCount}</strong></article>
              <article><span>معدل الإكمال</span><strong>{detail.report.completionRate}%</strong></article>
              <article><span>محاولات الاختبار</span><strong>{detail.report.quizAttempts}</strong></article>
              <article><span>معدل اجتياز الاختبار</span><strong>{detail.report.quizPassRate}%</strong></article>
              <article><span>متوسط الإجابات الصحيحة</span><strong>{detail.report.averageQuizScore}/{detail.roster[0]?.quizTotal || detail.quiz.length}</strong></article>
              {detail.report.attendanceRate !== null && <article><span>معدل الحضور</span><strong>{detail.report.attendanceRate}%</strong></article>}
              <article><span>الشهادات السارية</span><strong>{detail.report.certificateCount}</strong></article>
              <article><span>متوسط تقييم الدورة</span><strong>{detail.report.courseAverageRating ?? "—"}/5</strong><small>{detail.report.courseReviewCount} تقييم</small></article>
              <article><span>متوسط تقييمك كمدرب</span><strong>{detail.report.trainerAverageRating ?? "—"}/5</strong><small>{detail.report.trainerReviewCount} تقييم</small></article>
            </div>
            <div className="portal-card trainer-report-summary"><strong>ملخص الدورة</strong><p>عدد الوحدات: {detail.course.lessons.length} · نمط الدورة: {modeLabel(detail.course.mode)} · عدد أسئلة الاختبار: {detail.quiz.length}. تعتمد هذه المؤشرات على البيانات المسجلة داخل المنصة، ولا تتضمن تقديرات خارجية غير موثقة.</p></div>
            <Link className="portal-link-button secondary" href="/platform-admin/activities"><FileBarChart size={14}/> مراجعة تقارير المحاكاة الإشرافية</Link>
          </>}
        </section>
      )}
    </PlatformLayout>
  );
}
