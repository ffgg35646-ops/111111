"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, EyeOff, Flag, RefreshCw, ShieldCheck, Users, XCircle, FileText, MessageCircle } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import "@/app/community/community.css";

type Post = {
  postId: string; authorName: string; authorId: string; category: string; title: string; body: string;
  status: string; createdAt: string; likeCount: number; commentCount: number;
  attachment?: { filename: string; size: number; downloadUrl?: string } | null; resourceUrl?: string;
};
type Report = {
  reportId: string; postId: string; reason: string; reporterName?: string; createdAt: string;
  post?: { title?: string; body?: string; status?: string; authorName?: string };
};
type Group = { groupId: string; name: string; memberCount: number };
const statusLabels: Record<string, string> = { pending_review: "بانتظار المراجعة", published: "منشور", rejected: "مرفوض", hidden: "مخفي" };

export default function CommunityModerationPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [status, setStatus] = useState("pending_review");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [postResponse, reportResponse, groupResponse] = await Promise.all([
      fetch("/api/community/posts?moderation=1", { cache: "no-store" }),
      fetch("/api/community/reports", { cache: "no-store" }),
      fetch("/api/community/groups", { cache: "no-store" }),
    ]);
    const [postData, reportData, groupData] = await Promise.all([postResponse.json(), reportResponse.json(), groupResponse.json()]);
    if (!postResponse.ok) throw new Error(postData.error || "تعذر تحميل المشاركات.");
    if (!reportResponse.ok) throw new Error(reportData.error || "تعذر تحميل البلاغات.");
    if (!groupResponse.ok) throw new Error(groupData.error || "تعذر تحميل المجموعات.");
    setPosts(postData.posts || []); setReports(reportData.reports || []); setGroups(groupData.groups || []);
  }, []);
  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر تحميل مساحة الإشراف."))
      .finally(() => setLoading(false));
  }, [load]);

  const visiblePosts = useMemo(() => posts.filter((post) => {
    const matchesStatus = status === "all" || post.status === status;
    const text = (post.title + " " + post.body + " " + post.authorName).toLowerCase();
    return matchesStatus && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [posts, status, query]);

  async function moderate(post: Post, nextStatus: string) {
    setBusy(post.postId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/community/posts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.postId, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تنفيذ الإجراء.");
      setNotice("تم تحديث حالة المشاركة وتسجيل الإجراء في سجل التدقيق.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تنفيذ الإجراء."); }
    finally { setBusy(""); }
  }
  async function reviewReport(reportId: string, nextStatus: string) {
    setBusy(reportId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/community/reports", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحديث البلاغ.");
      setNotice(nextStatus === "resolved" ? "تم إغلاق البلاغ بعد المعالجة." : "تم حفظ قرار رفض البلاغ.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث البلاغ."); }
    finally { setBusy(""); }
  }

  return (
    <PlatformLayout title="إشراف المجتمع المهني" description="إدارة المشاركات والبلاغات ومتابعة مجموعات التخصص. جميع قرارات الإشراف تسجل في سجل التدقيق الإداري.">
      <div className="community-notice"><ShieldCheck size={17}/><span>راجع المحتوى بحثاً عن بيانات تعريفية أو سجلات صحية أو معلومات مضللة أو إساءة مهنية قبل النشر. استخدم الإخفاء عند الحاجة إلى وقف عرض المحتوى مؤقتاً.</span></div>
      {error && <p className="community-alert error" role="alert">{error}</p>}
      {notice && <p className="community-alert success" role="status">{notice}</p>}
      <div className="community-admin-stats">
        <article><MessageCircle size={17}/><strong>{posts.filter((post) => post.status === "pending_review").length}</strong><span>بانتظار المراجعة</span></article>
        <article><Flag size={17}/><strong>{reports.length}</strong><span>بلاغات مفتوحة</span></article>
        <article><Users size={17}/><strong>{groups.length}</strong><span>مجموعات تخصصية</span></article>
        <article><CheckCircle2 size={17}/><strong>{posts.filter((post) => post.status === "published").length}</strong><span>مشاركات منشورة</span></article>
      </div>

      <div className="community-section-heading"><div><span>سلامة المجتمع</span><h2>البلاغات المفتوحة</h2></div><small>{reports.length} بلاغ</small></div>
      <div className="community-admin-reports">
        {reports.map((report) => <article className="community-admin-report" key={report.reportId}>
          <div><span className="community-admin-status warning">بلاغ يحتاج مراجعة</span><small>{new Date(report.createdAt).toLocaleString("ar-SA")}</small></div>
          <h3>{report.post?.title || "المشاركة غير متاحة"}</h3>
          <p>{report.reason}</p>
          <small>المبلّغ: {report.reporterName || "عضو مجتمع"} · المشاركة: {report.postId}</small>
          <div className="community-admin-actions">
            <button className="community-admin-primary" disabled={busy === report.reportId} onClick={() => void reviewReport(report.reportId, "resolved")}><CheckCircle2 size={13}/> تمت المعالجة</button>
            <button className="community-admin-secondary" disabled={busy === report.reportId} onClick={() => void reviewReport(report.reportId, "dismissed")}><XCircle size={13}/> رفض البلاغ</button>
            {report.post?.status === "published" && <button className="community-admin-danger" disabled={busy === report.reportId} onClick={() => { const found = posts.find((post) => post.postId === report.postId); if (found) void moderate(found, "hidden"); }}><EyeOff size={13}/> إخفاء المحتوى</button>}
          </div>
        </article>)}
        {reports.length === 0 && <div className="portal-empty">لا توجد بلاغات مفتوحة.</div>}
      </div>

      <div className="community-section-heading"><div><span>إدارة المحتوى</span><h2>مراجعة المشاركات</h2></div><small>{posts.length} مشاركة</small></div>
      <div className="community-admin-tools">
        <div className="community-filter-row">
          {[
            ["pending_review", "بانتظار المراجعة"], ["published", "منشور"], ["hidden", "مخفي"], ["rejected", "مرفوض"], ["all", "الكل"],
          ].map(([value, label]) => <button type="button" key={value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{label}</button>)}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بعنوان المشاركة أو اسم العضو..." />
        <button type="button" className="community-admin-refresh" onClick={() => { setLoading(true); load().catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر التحديث.")).finally(() => setLoading(false)); }} disabled={loading}><RefreshCw size={13}/> تحديث</button>
      </div>

      {loading ? <div className="portal-empty">جارٍ تحميل محتوى المجتمع...</div> : visiblePosts.length === 0 ? <div className="portal-empty">لا توجد مشاركات في هذا العرض.</div> : (
        <div className="community-admin-posts">
          {visiblePosts.map((post) => <article className="community-admin-post" key={post.postId}>
            <div className="community-admin-post-head"><span className="community-admin-status">{statusLabels[post.status] || post.status}</span><small>{post.category} · {new Date(post.createdAt).toLocaleDateString("ar-SA")}</small></div>
            <div className="community-admin-author"><strong>{post.authorName}</strong><small>معرّف العضو: {post.authorId}</small></div>
            <h3>{post.title}</h3><p>{post.body}</p>
            <div className="community-admin-meta"><span><HeartIcon/> {post.likeCount || 0} تفاعل</span><span><MessageCircle size={13}/> {post.commentCount || 0} تعليق</span>{post.attachment && <span><FileText size={13}/> {post.attachment.filename}</span>}</div>
            {post.attachment?.downloadUrl && <a className="community-resource-link" href={post.attachment.downloadUrl}><FileText size={14}/><span>تنزيل المرفق: {post.attachment.filename}</span></a>}
            <div className="community-admin-actions">
              {post.status !== "published" && <button className="community-admin-primary" disabled={busy === post.postId} onClick={() => void moderate(post, "published")}><CheckCircle2 size={13}/> اعتماد ونشر</button>}
              {post.status !== "rejected" && <button className="community-admin-secondary" disabled={busy === post.postId} onClick={() => void moderate(post, "rejected")}><XCircle size={13}/> رفض</button>}
              {post.status !== "hidden" && <button className="community-admin-danger" disabled={busy === post.postId} onClick={() => void moderate(post, "hidden")}><EyeOff size={13}/> إخفاء</button>}
            </div>
          </article>)}
        </div>
      )}
    </PlatformLayout>
  );
}
function HeartIcon() { return <span aria-hidden="true">♥</span>; }
