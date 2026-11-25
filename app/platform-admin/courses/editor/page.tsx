"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type LessonDraft = { id: string; title: string; videoId: string; videoName: string; videoSize: number; uploadStatus: string; progress: number; error: string };
type CourseDraft = { courseId: string; title: string; description: string; trackId: string; level: string; duration: string; price: string; lessons: LessonDraft[] };
const tracks = [
  ["social-work","الخدمة الاجتماعية"],["mental-health","علم النفس"],["cbt","العلاج المعرفي السلوكي"],["family-guidance","الإرشاد والعلاج الأسري"],["developmental","الاضطرابات النمائية"],["autism","طيف التوحد"],["psychometrics","التقييم والقياس النفسي"],["clinical-practice","الممارسة الإكلينيكية"],["professional-development","التطوير المهني"],
] as const;
const newLesson = (): LessonDraft => ({ id: "lesson-" + crypto.randomUUID(), title: "", videoId: "", videoName: "", videoSize: 0, uploadStatus: "not_uploaded", progress: 0, error: "" });
const emptyCourse = (): CourseDraft => ({ courseId: "", title: "", description: "", trackId: "social-work", level: "مبتدئ", duration: "", price: "", lessons: [newLesson()] });
const formatSize = (bytes: number) => bytes >= 1024 ** 3 ? (bytes / 1024 ** 3).toFixed(2) + " GB" : (bytes / 1024 ** 2).toFixed(0) + " MB";
const makeCourseId = () => "course-" + crypto.randomUUID().replaceAll("-", "").slice(0, 24);

export default function CourseEditorPage() {
  const params = useSearchParams();
  const editId = params.get("id") || "";
  const [course, setCourse] = useState<CourseDraft>(() => emptyCourse());
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!editId) return;
    let active = true;
    fetch("/api/platform/admin/course-content?courseId=" + encodeURIComponent(editId), { cache: "no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "تعذر تحميل الكورس."); return data.course; })
      .then(item => { if (active && item) setCourse({ courseId: item.courseId, title: item.title || "", description: item.description || item.summary || "", trackId: item.trackId || "social-work", level: item.level || "مبتدئ", duration: item.duration || "", price: String(item.price ?? ""), lessons: (item.lessons || []).map((lesson: Record<string, unknown>) => ({ id: String(lesson.id), title: String(lesson.title || ""), videoId: String(lesson.videoId || ""), videoName: String(lesson.videoName || ""), videoSize: Number(lesson.videoSize || 0), uploadStatus: String(lesson.uploadStatus || "not_uploaded"), progress: 100, error: "" })) }); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل الكورس."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editId]);

  const totalSize = useMemo(() => course.lessons.reduce((sum, lesson) => sum + lesson.videoSize, 0), [course.lessons]);
  useEffect(() => {
    const pending = course.lessons.filter(lesson => lesson.uploadStatus === "processing" && lesson.videoId);
    if (!pending.length) return;
    let active = true;
    const check = async () => {
      for (const lesson of pending) {
        try {
          const response = await fetch("/api/platform/admin/course-video/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: lesson.videoId }) });
          const data = await response.json();
          if (active && response.ok && data.isReady) setCourse(current => ({ ...current, lessons: current.lessons.map(item => item.id === lesson.id ? { ...item, uploadStatus: "uploaded", progress: 100, error: "" } : item) }));
        } catch { /* keep checking while the admin page remains open */ }
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 12000);
    return () => { active = false; window.clearInterval(timer); };
  }, [course.lessons]);
  function patchCourse(patch: Partial<CourseDraft>) { setCourse(current => ({ ...current, ...patch })); }
  function patchLesson(id: string, patch: Partial<LessonDraft>) { setCourse(current => ({ ...current, lessons: current.lessons.map(lesson => lesson.id === id ? { ...lesson, ...patch } : lesson) })); }
  function addLesson() { setCourse(current => ({ ...current, lessons: [...current.lessons, newLesson()] })); }
  function removeLesson(id: string) { setCourse(current => ({ ...current, lessons: current.lessons.length > 1 ? current.lessons.filter(lesson => lesson.id !== id) : current.lessons })); }

  async function uploadLesson(lesson: LessonDraft, file?: File) {
    if (!file) return;
    if (!lesson.title.trim()) { patchLesson(lesson.id, { error: "اكتب اسم الدرس قبل اختيار الفيديو." }); return; }
    if (!file.type.startsWith("video/")) { patchLesson(lesson.id, { error: "اختر ملف فيديو صالحاً." }); return; }
    const courseId = course.courseId || makeCourseId();
    if (!course.courseId) patchCourse({ courseId });
    patchLesson(lesson.id, { error: "", uploadStatus: "uploading", progress: 0, videoName: file.name, videoSize: file.size, videoId: "" });
    try {
      const sessionResponse = await fetch("/api/platform/admin/course-video/upload-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId: lesson.id, lessonTitle: lesson.title, fileName: file.name, fileSize: file.size }),
      });
      const session = await sessionResponse.json();
      if (!sessionResponse.ok) throw new Error(session.error || "تعذر بدء الرفع.");
      const endpoint = session.uploadEndpoint as string;
      const metadata = ["filetype " + btoa(file.type || "application/octet-stream"), "title " + btoa(unescape(encodeURIComponent(lesson.title))), "filename " + btoa(unescape(encodeURIComponent(file.name)))].join(",");
      const headers = { "Tus-Resumable": "1.0.0", "Upload-Length": String(file.size), "Upload-Metadata": metadata, "AuthorizationSignature": session.signature, "AuthorizationExpire": String(session.expiresAt), "VideoId": session.videoId, "LibraryId": String(session.libraryId) };
      const created = await fetch(endpoint, { method: "POST", headers });
      if (!created.ok) throw new Error("تعذر إنشاء جلسة الرفع لدى خدمة الفيديو (" + created.status + ").");
      const location = created.headers.get("Location");
      if (!location) throw new Error("خدمة الفيديو لم تُرجع رابط جلسة الرفع.");
      const uploadUrl = new URL(location, endpoint).toString();
      const chunkSize = 32 * 1024 * 1024;
      let offset = 0;
      while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
        let attempt = 0;
        while (true) {
          try {
            const response = await fetch(uploadUrl, { method: "PATCH", headers: { ...headers, "Content-Type": "application/offset+octet-stream", "Upload-Offset": String(offset) }, body: chunk });
            if (!response.ok) throw new Error("فشل جزء من الرفع (" + response.status + ").");
            const nextOffset = Number(response.headers.get("Upload-Offset"));
            offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : offset + chunk.size;
            patchLesson(lesson.id, { progress: Math.min(100, Math.round(offset / file.size * 100)) });
            break;
          } catch (cause) {
            attempt += 1;
            if (attempt > 3) throw cause;
            await new Promise(resolve => setTimeout(resolve, 1200 * attempt));
            const head = await fetch(uploadUrl, { method: "HEAD", headers });
            if (head.ok) offset = Number(head.headers.get("Upload-Offset") || offset);
          }
        }
      }
      patchLesson(lesson.id, { videoId: session.videoId, videoName: file.name, videoSize: file.size, uploadStatus: "processing", progress: 100, error: "اكتمل نقل الملف، وجارٍ تجهيز الفيديو والجودات للمشاهدة." });
    } catch (cause) {
      patchLesson(lesson.id, { uploadStatus: "failed", error: cause instanceof Error ? cause.message : "فشل رفع الفيديو." });
    }
  }

  async function save(publish: boolean) {
    setError(""); setNotice("");
    if (!course.title.trim() || !course.description.trim() || !course.duration.trim() || !course.price.trim()) { setError("أكمل اسم الكورس والوصف والمدة والسعر."); return; }
    if (course.lessons.some(lesson => !lesson.title.trim())) { setError("اكتب اسم كل درس."); return; }
    if (course.lessons.some(lesson => lesson.uploadStatus === "uploading" || lesson.uploadStatus === "failed")) { setError("انتظر اكتمال رفع الفيديوهات أو أعد محاولة الفيديو الذي فشل."); return; }
    if (publish && course.lessons.some(lesson => lesson.uploadStatus !== "uploaded" || !lesson.videoId)) { setError("لا يمكن نشر الكورس قبل رفع فيديو لكل درس. احفظه كمسودة إذا كنت ستكمل الرفع لاحقاً."); return; }
    const courseId = course.courseId || makeCourseId();
    if (!course.courseId) patchCourse({ courseId });
    setSaving(true); setPublishing(publish);
    try {
      const response = await fetch("/api/platform/admin/course-content", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, title: course.title, description: course.description, trackId: course.trackId, level: course.level, duration: course.duration, price: Number(course.price), lessons: course.lessons.map(({ id, title, videoId, videoName, videoSize, uploadStatus }) => ({ id, title, videoId, videoName, videoSize, uploadStatus })), publish }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ الكورس.");
      setCourse(current => ({ ...current, courseId }));
      setNotice(publish ? "تم حفظ الكورس ونشره في الأكاديمية. أصبح متاحاً للطلاب بعد اعتماد الالتحاق والدفع." : "تم حفظ مسودة الكورس والدروس بنجاح.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ الكورس."); }
    finally { setSaving(false); setPublishing(false); }
  }

  return <PlatformLayout title={editId ? "تحرير الكورس والدروس" : "إضافة كورس جديد"} description="بيانات الكورس مرة واحدة، ثم أضف لكل درس اسماً وفيديو مستقلاً. الرفع المباشر يدعم الملفات الكبيرة عبر جلسات TUS.">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <Link href="/platform-admin/courses" className="portal-link-button secondary"><ArrowRight size={14}/> العودة لإدارة الدورات</Link>
      <span className="portal-chip">رفع مباشر · ملفات كبيرة</span>
    </div>
    {error && <div className="portal-callout" role="alert" style={{ borderColor: "#e7b4ad", color: "#a33" }}>{error}</div>}
    {notice && <div className="portal-callout" role="status">{notice}</div>}
    {loading ? <div className="portal-empty">جارٍ تحميل بيانات الكورس...</div> : <>
      <section className="portal-card" style={{ display: "grid", gap: 14 }}>
        <div className="portal-section-title"><div><h2><BookOpen size={17}/> بيانات الكورس الأساسية</h2><p>تُكتب مرة واحدة وتظهر في كتالوج الدورات</p></div></div>
        <label style={{ display: "grid", gap: 6 }}>اسم الكورس<input value={course.title} onChange={e => patchCourse({ title: e.target.value })} placeholder="مثال: أساسيات الإدارة المهنية" maxLength={180}/></label>
        <label style={{ display: "grid", gap: 6 }}>وصف الكورس<textarea value={course.description} onChange={e => patchCourse({ description: e.target.value })} placeholder="اكتب وصفاً واضحاً لأهداف الكورس ومحتواه..." rows={4} maxLength={3000}/></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>المسار<select value={course.trackId} onChange={e => patchCourse({ trackId: e.target.value })}>{tracks.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label style={{ display: "grid", gap: 6 }}>المستوى<select value={course.level} onChange={e => patchCourse({ level: e.target.value })}>{["مبتدئ","مبتدئ إلى متوسط","متوسط","متقدم","جميع المستويات"].map(x => <option key={x}>{x}</option>)}</select></label>
          <label style={{ display: "grid", gap: 6 }}>مدة الكورس<input value={course.duration} onChange={e => patchCourse({ duration: e.target.value })} placeholder="مثال: 12 ساعة تعليمية"/></label>
          <label style={{ display: "grid", gap: 6 }}>سعر الكورس (ريال سعودي)<input type="number" min="0" max="1000000" step="0.01" value={course.price} onChange={e => patchCourse({ price: e.target.value })} placeholder="0 للدورة المجانية"/></label>
        </div>
      </section>

      <div className="portal-section-title" style={{ marginTop: 20 }}><div><h2>دروس الكورس</h2><p>{course.lessons.length} درس · إجمالي الفيديوهات المرفقة {formatSize(totalSize)}</p></div><button className="portal-button" type="button" onClick={addLesson}><Plus size={15}/> إضافة درس</button></div>
      <div style={{ display: "grid", gap: 12 }}>
        {course.lessons.map((lesson, index) => <article className="portal-card" key={lesson.id} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <strong>الدرس {index + 1}</strong>
            <button type="button" className="portal-button secondary" onClick={() => removeLesson(lesson.id)} disabled={course.lessons.length === 1}><Trash2 size={14}/> حذف الدرس</button>
          </div>
          <label style={{ display: "grid", gap: 6 }}>اسم الدرس<input value={lesson.title} onChange={e => patchLesson(lesson.id, { title: e.target.value })} placeholder={"مثال: الدرس " + (index + 1) + " - المقدمة"} maxLength={180}/></label>
          <label onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadLesson(lesson, file); }} style={{ display: "grid", gap: 8, border: "1px dashed #80b9b2", borderRadius: 12, padding: 18, background: "#f6fbfa", textAlign: "center", cursor: "pointer" }}>
            <UploadCloud size={28} style={{ margin: "0 auto", color: "#16877d" }}/>
            <strong>{lesson.videoName || "اسحب ملف الفيديو إلى هنا أو اضغط لاختياره"}</strong>
            <span style={{ color: "#71848a", fontSize: 11 }}>MP4 أو MOV أو WebM · حتى 25GB للملف الواحد · رفع مباشر مجزأ</span>
            <input type="file" accept="video/*" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadLesson(lesson, file); e.currentTarget.value = ""; }}/>
          </label>
          {lesson.uploadStatus === "uploading" && <div style={{ display: "grid", gap: 6 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}><span>جارٍ رفع الفيديو</span><strong>{lesson.progress}%</strong></div><div style={{ height: 8, borderRadius: 20, background: "#e8efee", overflow: "hidden" }}><div style={{ height: "100%", width: lesson.progress + "%", background: "#16877d", transition: "width .2s" }}/></div><span style={{ fontSize: 10, color: "#71848a" }}>{formatSize(lesson.videoSize)} · اترك الصفحة مفتوحة حتى يكتمل الرفع</span></div>}
          {lesson.uploadStatus === "processing" && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a36a18", fontSize: 11 }}><LoaderCircle size={15}/> اكتمل رفع {lesson.videoName} · {formatSize(lesson.videoSize)} · جارٍ تجهيز الفيديو، سيتم تحديث الحالة تلقائياً</div>}{lesson.uploadStatus === "uploaded" && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#16805e", fontSize: 11 }}><Check size={15}/> الفيديو جاهز للمشاهدة: {lesson.videoName} · {formatSize(lesson.videoSize)}</div>}
          {lesson.error && <div role="alert" style={{ color: "#a33", fontSize: 11 }}>{lesson.error}</div>}
          {lesson.uploadStatus === "failed" && <button className="portal-button secondary" type="button" onClick={() => document.getElementById("retry-" + lesson.id)?.click()}><UploadCloud size={14}/> إعادة اختيار الفيديو</button>}
          <input id={"retry-" + lesson.id} type="file" accept="video/*" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void uploadLesson(lesson, file); e.currentTarget.value = ""; }}/>
        </article>)}
      </div>
      <div className="portal-card" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "#71848a", fontSize: 11 }}>احفظ كمسودة أثناء تجهيز المحتوى، أو انشر الكورس بعد التأكد من أسماء الدروس ورفع الفيديوهات.</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="portal-button secondary" disabled={saving} onClick={() => void save(false)}><Save size={14}/> {saving && !publishing ? "جارٍ الحفظ..." : "حفظ كمسودة"}</button>
          <button className="portal-button" disabled={saving} onClick={() => void save(true)}><Check size={14}/> {saving && publishing ? "جارٍ النشر..." : "حفظ ونشر الكورس"}</button>
        </div>
      </div>
    </>}
  </PlatformLayout>;
}
