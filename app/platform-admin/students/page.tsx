"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, Users, UserRound, BookOpen, Clock3, Circle,
  Ban, CheckCircle2, Trash2, X, Mail,
} from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Student = {
  userId: string;
  name: string;
  email: string;
  status: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
  courses: { id: string; title: string }[];
  courseCount: number;
};
type Summary = { total: number; online: number; offline: number; blocked: number };
type Filter = "all" | "online" | "offline" | "blocked";

const dateLabel = (value: string | null) => value
  ? new Date(value).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" })
  : "—";
const dateTimeLabel = (value: string | null) => value
  ? new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })
  : "—";

export default function PlatformStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, online: 0, offline: 0, blocked: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/platform/admin/students", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) {
        window.location.assign("/login?next=/platform-admin/students");
        return;
      }
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الطلاب.");
      const nextStudents = Array.isArray(data.students) ? data.students as Student[] : [];
      setStudents(nextStudents);
      setSummary(data.summary || { total: 0, online: 0, offline: 0, blocked: 0 });
      setSelected((current) => current ? nextStudents.find((student) => student.userId === current.userId) || current : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحميل الطلاب.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    const refresh = window.setInterval(() => { void load(false); }, 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refresh);
    };
  }, [load]);

  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  const matching = useMemo(() => students.filter((student) => {
    const matchesQuery = !normalizedQuery ||
      student.name.toLocaleLowerCase("ar").includes(normalizedQuery) ||
      student.email.toLocaleLowerCase("en").includes(normalizedQuery);
    const matchesFilter = filter === "all" ||
      (filter === "blocked" ? student.status !== "active" :
        filter === "online" ? student.status === "active" && student.isOnline :
          student.status === "active" && !student.isOnline);
    return matchesQuery && matchesFilter;
  }).sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return sort === "newest" ? bTime - aTime : aTime - bTime;
  }), [students, normalizedQuery, filter, sort]);

  const suggestions = useMemo(() => normalizedQuery
    ? students.filter((student) =>
        student.name.toLocaleLowerCase("ar").includes(normalizedQuery) ||
        student.email.toLocaleLowerCase("en").includes(normalizedQuery),
      ).slice(0, 6)
    : [], [students, normalizedQuery]);

  async function changeStatus(student: Student) {
    const nextStatus = student.status === "active" ? "disabled" : "active";
    const message = nextStatus === "disabled" ? "حظر هذا الطالب؟ سيتم إنهاء جلساته الحالية." : "إلغاء حظر هذا الطالب؟";
    if (!window.confirm(message)) return;
    setBusyId(student.userId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: student.userId, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحديث حالة الطالب.");
      setNotice(nextStatus === "disabled" ? "تم حظر الطالب." : "تم إلغاء الحظر.");
      if (selected?.userId === student.userId) setSelected({ ...student, status: nextStatus, isOnline: false });
      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تحديث حالة الطالب.");
    } finally { setBusyId(""); }
  }

  async function deleteStudent(student: Student) {
    if (!window.confirm("حذف حساب الطالب وبيانات التقدم التعليمي والجلسات المرتبطة به؟ لا يمكن التراجع عن هذه العملية.")) return;
    setBusyId(student.userId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/platform/admin/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: student.userId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حذف بيانات الطالب.");
      setSelected(null);
      setNotice("تم حذف حساب الطالب وبيانات التقدم التعليمي.");
      await load(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حذف بيانات الطالب.");
    } finally { setBusyId(""); }
  }

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "الكل", count: summary.total },
    { value: "online", label: "متصل", count: summary.online },
    { value: "offline", label: "غير متصل", count: summary.offline },
    { value: "blocked", label: "محظور", count: summary.blocked },
  ];

  return (
    <PlatformLayout title="الطلاب" eyebrow="" description="">
      <section className="portal-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {[
            { label: "إجمالي الطلاب", value: summary.total, icon: Users },
            { label: "متصل الآن", value: summary.online, icon: Circle },
            { label: "غير متصل", value: summary.offline, icon: Clock3 },
            { label: "محظور", value: summary.blocked, icon: Ban },
          ].map((item) => {
            const Icon = item.icon;
            return <div key={item.label} style={{ border: "1px solid var(--portal-border, #e3e9ed)", borderRadius: 12, padding: 13 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--portal-muted, #74818b)", fontSize: 12 }}>
                <span>{item.label}</span><Icon size={16}/>
              </div>
              <strong style={{ display: "block", fontSize: 25, marginTop: 8, color: "var(--portal-text, #24333b)" }}>{item.value.toLocaleString("ar-EG")}</strong>
            </div>;
          })}
        </div>
      </section>

      <section className="portal-card" style={{ marginBottom: 14, position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", gap: 9, alignItems: "center", border: "1px solid #dce5e9", borderRadius: 10, padding: "0 12px", background: "var(--portal-surface, #fff)" }}>
          <Search size={17} color="#82919a"/>
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSuggestionsOpen(true); }}
            onFocus={() => setSuggestionsOpen(true)}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 150)}
            onKeyDown={(event) => { if (event.key === "Escape") setSuggestionsOpen(false); if (event.key === "Enter" && suggestions[0]) { setQuery(suggestions[0].name); setSuggestionsOpen(false); } }}
            placeholder="البحث بالاسم أو البريد الإلكتروني"
            aria-label="البحث بالاسم أو البريد الإلكتروني"
            autoComplete="off"
            style={{ width: "100%", minWidth: 0, padding: "13px 0", border: 0, outline: 0, background: "transparent", color: "inherit", font: "inherit" }}
          />
          {query && <button type="button" className="portal-button secondary" onClick={() => { setQuery(""); setSuggestionsOpen(false); }} aria-label="مسح البحث"><X size={15}/></button>}
        </div>
        {suggestionsOpen && suggestions.length > 0 && <div style={{ position: "absolute", top: "calc(100% - 8px)", right: 16, left: 16, background: "var(--portal-surface, #fff)", border: "1px solid #dce5e9", borderRadius: 10, boxShadow: "0 12px 28px #14232b18", overflow: "hidden" }}>
          {suggestions.map((student) => <button key={student.userId} type="button" onMouseDown={() => { setQuery(student.name); setSuggestionsOpen(false); }} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 10, padding: "11px 13px", border: 0, borderBottom: "1px solid #edf1f3", background: "transparent", color: "inherit", textAlign: "right", cursor: "pointer" }}>
            <strong style={{ fontSize: 12 }}>{student.name}</strong><span style={{ color: "#82919a", fontSize: 11 }}>{student.email}</span>
          </button>)}
        </div>}
      </section>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {filters.map((item) => <button key={item.value} type="button" className={"portal-button " + (filter === item.value ? "" : "secondary")} onClick={() => setFilter(item.value)} style={{ gap: 6 }}>
            {item.label}<span style={{ opacity: .75 }}>{item.count}</span>
          </button>)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select aria-label="ترتيب الطلاب" value={sort} onChange={(event) => setSort(event.target.value as "newest" | "oldest")} style={{ padding: 9, border: "1px solid #dce5e9", borderRadius: 9, background: "var(--portal-surface, #fff)", color: "inherit", font: "inherit", fontSize: 12 }}>
            <option value="newest">الأحدث أولاً</option>
            <option value="oldest">الأقدم أولاً</option>
          </select>
          <button type="button" className="portal-button secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> تحديث</button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: "#b64b48", fontSize: 12 }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#287b61", fontSize: 12 }}>{notice}</p>}
      {loading ? <div className="portal-grid" aria-busy="true">{[0,1,2].map((item)=><section className="portal-card" key={item} style={{display:"flex",alignItems:"center",gap:12}}><div className="portal-skeleton" style={{width:42,height:42,borderRadius:"50%",flex:"0 0 42px"}}/><div style={{flex:1}}><div className="portal-skeleton" style={{width:"42%",height:12,marginBottom:9}}/><div className="portal-skeleton" style={{width:"76%",height:9,marginBottom:7}}/><div className="portal-skeleton" style={{width:"58%",height:9}}/></div></section>)}</div> :
        matching.length === 0 ? <div className="portal-card" style={{ textAlign: "center", color: "#82919a", padding: 28 }}>لا توجد نتائج.</div> :
        <div style={{ display: "grid", gap: 9 }}>
          {matching.map((student) => <article className="portal-card" key={student.userId} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 12 }}>
            <button type="button" onClick={() => setSelected(student)} style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, border: 0, padding: 0, background: "transparent", color: "inherit", textAlign: "right", cursor: "pointer" }}>
              <span style={{ width: 42, height: 42, flex: "0 0 42px", borderRadius: "50%", background: "#edf2f4", color: "#40545e", display: "grid", placeItems: "center", fontWeight: 700 }}>{student.name.trim().charAt(0) || <UserRound size={18}/>}</span>
              <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <strong style={{ fontSize: 13 }}>{student.name}</strong>
                <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#82919a", fontSize: 11, overflowWrap: "anywhere" }}><Mail size={12}/>{student.email}</span>
                <span style={{ color: "#82919a", fontSize: 11 }}>التسجيل: {dateLabel(student.createdAt)} · {student.courseCount} دورة</span>
              </span>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", justifyContent: "end" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: student.status !== "active" ? "#b64b48" : student.isOnline ? "#287b61" : "#82919a" }}>
                <Circle size={8} fill="currentColor"/>{student.status !== "active" ? "محظور" : student.isOnline ? "متصل" : "غير متصل"}
              </span>
              <button type="button" className="portal-button secondary" onClick={() => setSelected(student)}>التفاصيل</button>
              <button type="button" className="portal-button secondary" disabled={busyId === student.userId} onClick={() => void changeStatus(student)}>
                {student.status === "active" ? <><Ban size={14}/> حظر</> : <><CheckCircle2 size={14}/> إلغاء الحظر</>}
              </button>
              <button type="button" className="portal-button secondary" disabled={busyId === student.userId} onClick={() => void deleteStudent(student)} aria-label={"حذف "+student.name}><Trash2 size={14}/></button>
            </div>
          </article>)}
        </div>
      }

      {selected && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }} style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 16, background: "#101b22a6" }}>
        <section role="dialog" aria-modal="true" aria-labelledby="student-details-title" className="portal-card" style={{ width: "min(620px,100%)", maxHeight: "85vh", overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h2 id="student-details-title" style={{ margin: 0, fontSize: 18 }}>بيانات الطالب</h2>
            <button type="button" className="portal-button secondary" onClick={() => setSelected(null)} aria-label="إغلاق"><X size={16}/></button>
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
            <div><strong>{selected.name}</strong><div style={{ color: "#82919a", fontSize: 12, marginTop: 4 }}>{selected.email}</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9 }}>
              <div className="portal-card"><small>تاريخ التسجيل</small><strong style={{ display: "block", marginTop: 6 }}>{dateTimeLabel(selected.createdAt)}</strong></div>
              <div className="portal-card"><small>آخر تسجيل دخول</small><strong style={{ display: "block", marginTop: 6 }}>{dateTimeLabel(selected.lastLoginAt)}</strong></div>
              <div className="portal-card"><small>آخر ظهور</small><strong style={{ display: "block", marginTop: 6 }}>{dateTimeLabel(selected.lastSeenAt)}</strong></div>
              <div className="portal-card"><small>الدورات</small><strong style={{ display: "block", marginTop: 6 }}>{selected.courseCount}</strong></div>
            </div>
            <div>
              <strong style={{ fontSize: 13 }}>الدورات المسجل بها</strong>
              <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
                {selected.courses.length ? selected.courses.map((course) => <div key={course.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: 10, borderRadius: 9, background: "var(--portal-soft, #f3f6f7)" }}><BookOpen size={15}/><span style={{ fontSize: 12 }}>{course.title}</span></div>) : <span style={{ color: "#82919a", fontSize: 12 }}>لا توجد دورات مسجلة.</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "end", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
            <button type="button" className="portal-button secondary" disabled={busyId === selected.userId} onClick={() => void changeStatus(selected)}>{selected.status === "active" ? "حظر الطالب" : "إلغاء الحظر"}</button>
            <button type="button" className="portal-button secondary" disabled={busyId === selected.userId} onClick={() => void deleteStudent(selected)}><Trash2 size={14}/> حذف الطالب</button>
          </div>
        </section>
      </div>}
    </PlatformLayout>
  );
}
