"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Brain, CheckCircle2, FileQuestion, LoaderCircle, Search, ShieldCheck, Sparkles } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { courses, learningTracks } from "@/lib/platform-catalog";

type Role = "admin" | "platform_manager" | "supervisor" | "trainer" | "trainee" | "consultant" | "content_manager" | "quality_manager";
type Task = "ask" | "explain" | "quiz" | "scenario";
type QuizQuestion = { q: string; options: string[]; correct: number; why: string };
type Source = { type: string; title: string; href: string };
type QuizDraft = { draftId: string; courseTitle: string; questions: QuizQuestion[] };
type ScenarioDraft = { scenarioId: string; title: string; track: string; status: string };

const canAuthor = (role: Role | null) => Boolean(role && ["admin", "platform_manager", "supervisor", "trainer"].includes(role));

export default function AssistantPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [task, setTask] = useState<Task>("ask");
  const [prompt, setPrompt] = useState("");
  const [courseId, setCourseId] = useState("");
  const [trackId, setTrackId] = useState(learningTracks[0]?.id || "");
  const [courseOptions, setCourseOptions] = useState(courses);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [quizDraft, setQuizDraft] = useState<QuizDraft | null>(null);
  const [scenarioDraft, setScenarioDraft] = useState<ScenarioDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.authenticated || data.user?.mustChangePassword) {
          router.replace("/login?next=/assistant");
          return;
        }
        const currentRole = String(data.user?.role || "") as Role;
        if (!["admin", "platform_manager", "supervisor", "trainer", "trainee", "consultant", "content_manager", "quality_manager"].includes(currentRole)) {
          router.replace("/dashboard");
          return;
        }
        if (!active) return;
        setRole(currentRole);
        if (currentRole === "trainer") {
          const trainerResponse = await fetch("/api/trainer", { cache: "no-store" });
          const trainerData = await trainerResponse.json();
          if (!trainerResponse.ok) throw new Error(trainerData.error || "تعذر تحميل دورات المدرب.");
          const assignedIds = new Set((Array.isArray(trainerData.courses) ? trainerData.courses : [])
            .filter((item: { assignmentStatus?: string }) => item.assignmentStatus === "mine")
            .map((item: { id: string }) => item.id));
          const allowedCourses = courses.filter((course) => assignedIds.has(course.id));
          if (active) {
            setCourseOptions(allowedCourses);
            setCourseId(allowedCourses[0]?.id || "");
          }
        } else {
          setCourseId(courses[0]?.id || "");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "تعذر تجهيز مساعد اتزان.");
      }
    })();
    return () => { active = false; };
  }, [router]);

  const selectedCourse = useMemo(() => courseOptions.find((course) => course.id === courseId), [courseOptions, courseId]);

  async function runAssistant() {
    setBusy(true); setError(""); setNotice(""); setAnswer(""); setSources([]); setQuizDraft(null); setScenarioDraft(null);
    try {
      const response = await fetch("/api/platform/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, prompt, courseId, trackId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تنفيذ الطلب.");
      if (task === "ask" || task === "explain") {
        setAnswer(String(data.answer || ""));
        setSources(Array.isArray(data.sources) ? data.sources as Source[] : []);
      } else if (task === "quiz") {
        setQuizDraft({ draftId: data.draftId, courseTitle: data.courseTitle, questions: data.questions || [] });
      } else {
        setScenarioDraft({ scenarioId: data.scenarioId, title: data.title, track: data.track, status: data.status });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "حدث خطأ أثناء تنفيذ الطلب.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewQuiz(action: "approve_quiz" | "reject_quiz") {
    if (!quizDraft) return;
    setReviewBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/ai/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: quizDraft.draftId, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذرت مراجعة المسودة.");
      setNotice(action === "approve_quiz"
        ? "تم اعتماد الأسئلة وإدراجها في اختبار المقرر."
        : "تم رفض المسودة وحفظ قرار المراجعة.");
      setQuizDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذرت مراجعة المسودة.");
    } finally {
      setReviewBusy(false);
    }
  }

  return <PlatformLayout title="مساعد اتزان الذكي" eyebrow="ETZAN · AI LEARNING ASSISTANT" description="ابحث داخل مواد المنصة، افهم المفاهيم، أو جهّز مسودات تدريبية تخضع للمراجعة قبل اعتمادها.">
    <div className="portal-callout" style={{ marginBottom: 16 }}>
      <ShieldCheck size={17} /> يستخدم المساعد المحتوى المنشور وفهرس المقررات المتاح له فقط. لا يطّلع على الملفات الخاصة غير المصرح بها ولا يقدم تشخيصاً أو علاجاً لحالات حقيقية.
    </div>
    <section className="portal-card" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" className={task === "ask" ? "portal-button" : "portal-button secondary"} onClick={() => setTask("ask")}><Search size={16}/> البحث في المعرفة</button>
        <button type="button" className={task === "explain" ? "portal-button" : "portal-button secondary"} onClick={() => setTask("explain")}><BookOpen size={16}/> فهم وشرح المحتوى</button>
        {canAuthor(role) && <>
          <button type="button" className={task === "quiz" ? "portal-button" : "portal-button secondary"} onClick={() => setTask("quiz")}><FileQuestion size={16}/> إنشاء أسئلة</button>
          <button type="button" className={task === "scenario" ? "portal-button" : "portal-button secondary"} onClick={() => setTask("scenario")}><Brain size={16}/> إعداد سيناريو</button>
        </>}
      </div>
      {task === "quiz" && <label style={{ display: "grid", gap: 6 }}>المقرر التدريبي
        <select value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={!courseOptions.length}>
          {courseOptions.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        {!courseOptions.length && <small>لا توجد دورة مسندة إلى حساب المدرب حالياً. اطلب إسناد دورة من مدير المنصة.</small>}
      </label>}
      {task === "scenario" && <label style={{ display: "grid", gap: 6 }}>المسار المهني
        <select value={trackId} onChange={(event) => setTrackId(event.target.value)}>
          {learningTracks.map((track) => <option key={track.id} value={track.id}>{track.title}</option>)}
        </select>
      </label>}
      <label style={{ display: "grid", gap: 7 }}>
        {task === "ask" ? "ما الذي تبحث عنه داخل المنصة؟" : task === "explain" ? "ما المفهوم أو الجزء الذي تريد فهمه؟" : task === "quiz" ? "حدد الموضوع أو نواتج التعلم المطلوب تقويمها" : "صف موضوع الحالة والمهارة المهنية المستهدفة"}
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} maxLength={1200} placeholder={task === "ask" ? "مثال: ما المواد التي تشرح منهجية دراسة الحالة؟" : task === "explain" ? "مثال: اشرح الفرق بين الملاحظة والفرضية في دراسة الحالة." : task === "quiz" ? "مثال: أسئلة تطبيقية عن المقابلة المفتوحة وجمع المعلومات." : "مثال: سيناريو مقابلة مراجع متردد مع تدريب المتعلم على بناء العلاقة."} />
      </label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <small>{task === "quiz" ? "الأسئلة تحفظ كمسودة ولا تدخل الاختبار قبل الاعتماد." : task === "scenario" ? "السيناريو يحفظ غير مفعّل حتى يراجعه المدرب." : "تظهر المراجع التي عُثر عليها مع الإجابة."}</small>
        <button type="button" className="portal-button" onClick={runAssistant} disabled={busy || prompt.trim().length < 3 || (task === "quiz" && !selectedCourse)}>
          {busy ? <LoaderCircle size={16}/> : <Sparkles size={16}/>} {busy ? "جارٍ التنفيذ..." : "تنفيذ الطلب"}
        </button>
      </div>
      {error && <div className="portal-callout" role="alert">{error}</div>}
      {notice && <div className="portal-callout" role="status"><CheckCircle2 size={16}/> {notice}</div>}
    </section>

    {answer && <section className="portal-card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>إجابة المساعد</h2>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{answer}</div>
      {sources.length > 0 && <div style={{ marginTop: 18 }}>
        <h3>المصادر التي عُثر عليها</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {sources.map((source, index) => <Link key={index} className="portal-button secondary" href={source.href}>{source.type}: {source.title}</Link>)}
        </div>
      </div>}
    </section>}

    {quizDraft && <section className="portal-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>مسودة أسئلة: {quizDraft.courseTitle}</h2><small>راجع صياغة كل سؤال والإجابة والتغذية الراجعة قبل الاعتماد.</small></div>
        <span className="portal-chip">بانتظار المراجعة</span>
      </div>
      {quizDraft.questions.map((question, index) => <article key={index} style={{ borderTop: "1px solid var(--portal-border, #e5eaed)", marginTop: 14, paddingTop: 12 }}>
        <strong>{index + 1}. {question.q}</strong>
        <ol>{question.options.map((option, optionIndex) => <li key={optionIndex} style={{ fontWeight: optionIndex === question.correct ? 700 : 400 }}>{option}{optionIndex === question.correct ? " — الإجابة المقترحة" : ""}</li>)}</ol>
        <small>{question.why}</small>
      </article>)}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        <button type="button" className="portal-button" onClick={() => reviewQuiz("approve_quiz")} disabled={reviewBusy}>{reviewBusy ? "جارٍ الحفظ..." : "اعتماد الأسئلة في اختبار المقرر"}</button>
        <button type="button" className="portal-button secondary" onClick={() => reviewQuiz("reject_quiz")} disabled={reviewBusy}>رفض المسودة</button>
        <Link className="portal-button secondary" href="/trainer">فتح لوحة المدرب</Link>
      </div>
    </section>}

    {scenarioDraft && <section className="portal-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}><CheckCircle2 size={20}/><h2 style={{ margin: 0 }}>تم إنشاء مسودة السيناريو</h2></div>
      <p><strong>{scenarioDraft.title}</strong> · {scenarioDraft.track}</p>
      <p>حُفظ السيناريو بحالة غير مفعّلة؛ لن يظهر للمتدربين حتى يراجعه المدرب أو المشرف ويفعّله يدوياً.</p>
      <Link href="/simulation/manage" className="portal-button">مراجعة السيناريو وتفعيله</Link>
    </section>}
    <p style={{ marginTop: 16, fontSize: 13, opacity: 0.78 }}>ملاحظة: البحث الحالي يفهرس المقالات والكتب المنشورة وفهرس الدورات والمسارات والحالات المضافة في المنصة. لا يمثل بعد فهرسة دلالية كاملة لكل ملف أو مرفق.</p>
  </PlatformLayout>;
}
