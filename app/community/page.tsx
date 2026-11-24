"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BookOpen, ExternalLink, FileText, Flag, Heart, MessageCircle,
  Paperclip, Search, Send, ShieldCheck, Users, UserRound,
} from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import "./community.css";

type Group = { groupId: string; name: string; description: string; category: string; memberCount: number; joined: boolean };
type Comment = { commentId: string; authorId: string; authorName: string; body: string; createdAt: string };
type Attachment = { fileId: string; filename: string; contentType: string; size: number; downloadUrl: string };
type Post = {
  postId: string; authorId: string; authorName: string; role: string; category: string; title: string; body: string;
  createdAt: string; likeCount: number; likedByMe: boolean; commentCount: number; comments: Comment[];
  attachment?: Attachment | null; resourceUrl?: string; resourceLabel?: string; status?: string;
};
type Profile = { name: string; role: string; headline: string; specialty: string; organization: string; bio: string; userId: string };
const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام", platform_manager: "مدير المنصة", supervisor: "مشرف مهني", trainer: "مدرب",
  trainee: "متدرب", consultant: "مستشار", accountant: "محاسب", support: "الدعم", content_manager: "مسؤول محتوى", quality_manager: "مسؤول جودة",
};

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("الخدمة الاجتماعية");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceLabel, setResourceLabel] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPosts(nextFilter = filter, nextQuery = query) {
    const params = new URLSearchParams();
    if (nextFilter) params.set("category", nextFilter);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    const response = await fetch("/api/community/posts?" + params.toString(), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر تحميل المشاركات.");
    setPosts(Array.isArray(data.posts) ? data.posts : []);
  }
  async function loadGroups() {
    const response = await fetch("/api/community/groups", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر تحميل مجموعات التخصص.");
    setGroups(Array.isArray(data.groups) ? data.groups : []);
  }


  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/community/posts", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.posts || []; }),
      fetch("/api/community/groups", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.groups || []; }),
      fetch("/api/community/profile", { cache: "no-store" }).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.profile || null; }),
    ]).then(([items, groupItems, ownProfile]) => {
      if (!active) return;
      setPosts(items); setGroups(groupItems); setProfile(ownProfile);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المجتمع المهني."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("post"); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.set("title", title); form.set("body", body); form.set("category", category);
      form.set("resourceUrl", resourceUrl); form.set("resourceLabel", resourceLabel);
      if (attachment) form.set("attachment", attachment);
      const response = await fetch("/api/community/posts", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إرسال المشاركة.");
      setTitle(""); setBody(""); setResourceUrl(""); setResourceLabel(""); setAttachment(null);
      const fileInput = document.getElementById("community-attachment") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      setNotice("وصلت مشاركتك إلى فريق الإشراف، وستظهر بعد اعتمادها.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر الإرسال.");
    } finally { setBusy(""); }
  }

  async function toggleGroup(group: Group) {
    setBusy(group.groupId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/community/groups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.groupId, action: group.joined ? "leave" : "join" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحديث عضوية المجموعة.");
      await loadGroups();
      if (!group.joined) { setFilter(group.category); await loadPosts(group.category, query); }
      else if (filter === group.category) { setFilter(""); await loadPosts("", query); }
      setNotice(group.joined ? "غادرت المجموعة." : "تم انضمامك إلى المجموعة المهنية.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحديث المجموعة."); }
    finally { setBusy(""); }
  }

  async function toggleLike(postId: string) {
    setBusy("like-" + postId); setError("");
    try {
      const response = await fetch("/api/community/interactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action: "like" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تسجيل التفاعل.");
      setPosts((current) => current.map((post) => post.postId === postId ? { ...post, likedByMe: data.liked, likeCount: data.likeCount } : post));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تسجيل التفاعل."); }
    finally { setBusy(""); }
  }

  async function sendComment(postId: string) {
    const comment = (commentDrafts[postId] || "").trim();
    if (comment.length < 3) { setError("اكتب تعليقاً لا يقل عن ثلاثة أحرف."); return; }
    setBusy("comment-" + postId); setError("");
    try {
      const response = await fetch("/api/community/interactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action: "comment", comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إضافة التعليق.");
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadPosts();
      setExpanded((current) => current.includes(postId) ? current : [...current, postId]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إضافة التعليق."); }
    finally { setBusy(""); }
  }

  async function reportPost(postId: string) {
    const reason = window.prompt("اكتب سبب الإبلاغ (8 أحرف على الأقل):");
    if (!reason || reason.trim().length < 8) return;
    setBusy("report-" + postId); setError(""); setNotice("");
    try {
      const response = await fetch("/api/community/reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إرسال البلاغ.");
      setNotice("تم إرسال البلاغ بسرية إلى فريق الإشراف.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر إرسال البلاغ."); }
    finally { setBusy(""); }
  }

  async function searchPosts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    try { await loadPosts(filter, query); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر البحث."); }
    finally { setLoading(false); }
  }
  function chooseCategory(value: string) {
    setFilter(value);
    setLoading(true);
    loadPosts(value, query).catch((cause) => setError(cause instanceof Error ? cause.message : "تعذر تحميل التصنيف.")).finally(() => setLoading(false));
  }
  function toggleComments(postId: string) {
    setExpanded((current) => current.includes(postId) ? current.filter((id) => id !== postId) : [...current, postId]);
  }

  return (
    <PlatformLayout title="المجتمع المهني" description="شبكة مهنية تجمع الممارسين والمتدربين لتبادل الخبرات والمواد ومناقشة الممارسة في بيئة خاضعة للإشراف.">
      <div className="community-notice"><ShieldCheck size={17}/><span>تُراجع المشاركات قبل النشر. يمنع نشر بيانات المرضى أو أي معلومات تعريفية أو سجلات صحية أو طلب تشخيص عبر المجتمع.</span></div>

      <section className="community-overview">
        <article className="community-profile-card">
          <div className="community-profile-icon"><UserRound size={23}/></div>
          <div className="community-profile-copy">
            <span>ملفك المهني</span>
            <strong>{profile?.name || "عضو اتزان"}</strong>
            <p>{profile?.headline || profile?.specialty || "أكمل بياناتك المهنية لتسهيل التعارف وتبادل الخبرات."}</p>
            <small>{ROLE_LABELS[profile?.role || ""] || "عضو مجتمع اتزان"}</small>
          </div>
          <a href="/community/profile" className="community-text-link">تعديل الملف <ExternalLink size={13}/></a>
        </article>
        <article className="community-directory-card">
          <div><Users size={20}/><strong>دليل الممارسين</strong></div>
          <p>اكتشف أعضاء المجتمع وتخصصاتهم وخبراتهم المهنية.</p>
          <a href="/community/members" className="community-outline-link">استعراض الأعضاء</a>
        </article>
      </section>

      <div className="community-section-heading"><div><span>مجتمع حسب التخصص</span><h2>المجموعات المهنية</h2></div><small>{groups.length} مجموعات تخصصية</small></div>
      <div className="community-groups-grid">
        {groups.map((group) => (
          <article className="community-group-card" key={group.groupId}>
            <div className="community-group-top"><span><Users size={17}/></span><small>{group.memberCount.toLocaleString("ar-SA")} عضو</small></div>
            <h3>{group.name}</h3><p>{group.description}</p>
            <button type="button" disabled={busy === group.groupId} className={group.joined ? "community-button light" : "community-button"} onClick={() => void toggleGroup(group)}>
              {busy === group.groupId ? "جارٍ التحديث..." : group.joined ? "مغادرة المجموعة" : "انضم للمجموعة"}
            </button>
          </article>
        ))}
      </div>

      <div className="community-section-heading community-feed-heading"><div><span>تبادل المعرفة والخبرة</span><h2>مساحة النقاشات المهنية</h2></div><small>{posts.length.toLocaleString("ar-SA")} مشاركة منشورة</small></div>
      <section className="community-composer">
        <div className="community-composer-title"><div className="community-composer-icon"><Send size={18}/></div><div><strong>ابدأ نقاشاً مهنياً</strong><p>شارك سؤالاً أو تجربة أو مادة مرجعية ذات صلة بالتخصص.</p></div></div>
        <form onSubmit={submitPost} className="community-form">
          <input required minLength={5} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان النقاش أو الخبرة" />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>{groups.map((group) => <option key={group.groupId} value={group.category}>{group.name}</option>)}</select>
          <textarea required minLength={20} maxLength={3000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="اكتب محتوى مهنياً عاماً دون معلومات تعريفية عن المستفيدين..." />
          <div className="community-resource-grid">
            <label><span><ExternalLink size={14}/> رابط مادة أو مرجع (اختياري)</span><input type="url" value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://..." /></label>
            <label><span><BookOpen size={14}/> اسم المادة (اختياري)</span><input maxLength={100} value={resourceLabel} onChange={(event) => setResourceLabel(event.target.value)} placeholder="عنوان المرجع أو المادة" /></label>
          </div>
          <label className="community-upload"><Paperclip size={15}/><span>{attachment ? attachment.name : "إرفاق ملف PDF أو Word أو PowerPoint أو صورة"}</span><input id="community-attachment" type="file" accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label>
          <div className="community-form-bottom"><small>حد المرفق 5 ميجابايت. المشاركة ستظهر بعد اعتماد المشرف.</small><button className="community-button" type="submit" disabled={busy === "post"}>{busy === "post" ? "جارٍ الإرسال..." : "إرسال للمراجعة"} <Send size={14}/></button></div>
        </form>
      </section>

      {error && <p className="community-alert error" role="alert">{error}</p>}
      {notice && <p className="community-alert success" role="status">{notice}</p>}

      <div className="community-feed-tools">
        <div><h2>أحدث المشاركات</h2><p>المحتوى الذي اجتاز المراجعة المهنية</p></div>
        <form onSubmit={searchPosts} className="community-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في النقاشات..." /><button type="submit">بحث</button></form>
      </div>
      <div className="community-filter-row">
        <button type="button" className={!filter ? "active" : ""} onClick={() => chooseCategory("")}>الكل</button>
        {groups.map((group) => <button type="button" key={group.groupId} className={filter === group.category ? "active" : ""} onClick={() => chooseCategory(group.category)}>{group.name}</button>)}
      </div>

      {loading ? <div className="portal-empty">جارٍ تحميل النقاشات...</div> : posts.length === 0 ? <div className="portal-empty">لا توجد مشاركات منشورة في هذا التصنيف حتى الآن.</div> : (
        <div className="community-post-list">
          {posts.map((post) => {
            const isExpanded = expanded.includes(post.postId);
            return (
              <article className="community-post-card" key={post.postId}>
                <div className="community-post-meta"><span>{post.category}</span><small>{new Date(post.createdAt).toLocaleDateString("ar-SA")}</small></div>
                <div className="community-author-row"><div className="community-avatar">{post.authorName.slice(0, 1)}</div><div><a href={"/community/profile?userId=" + encodeURIComponent(post.authorId)}>{post.authorName}</a><small>{ROLE_LABELS[post.role] || "عضو مجتمع اتزان"}</small></div></div>
                <h3>{post.title}</h3><p className="community-post-body">{post.body}</p>
                {post.resourceUrl && <a className="community-resource-link" href={post.resourceUrl} target="_blank" rel="noreferrer"><BookOpen size={15}/><span>{post.resourceLabel || "فتح المادة المرجعية"}</span><ExternalLink size={13}/></a>}
                {post.attachment && <a className="community-attachment-link" href={post.attachment.downloadUrl}><FileText size={16}/><span>{post.attachment.filename}</span><small>{(post.attachment.size / 1024 / 1024).toFixed(1)} MB</small></a>}
                <div className="community-post-actions">
                  <button type="button" disabled={busy === "like-" + post.postId} className={post.likedByMe ? "liked" : ""} onClick={() => void toggleLike(post.postId)}><Heart size={15} fill={post.likedByMe ? "currentColor" : "none"}/>{post.likeCount.toLocaleString("ar-SA")} إعجاب</button>
                  <button type="button" onClick={() => toggleComments(post.postId)}><MessageCircle size={15}/>{post.commentCount.toLocaleString("ar-SA")} تعليق</button>
                  <button type="button" disabled={busy === "report-" + post.postId} onClick={() => void reportPost(post.postId)}><Flag size={14}/> إبلاغ</button>
                </div>
                {isExpanded && <div className="community-comments">
                  {post.comments.map((comment) => <div className="community-comment" key={comment.commentId}><div className="community-avatar small">{comment.authorName.slice(0, 1)}</div><div><strong>{comment.authorName}</strong><p>{comment.body}</p><small>{new Date(comment.createdAt).toLocaleDateString("ar-SA")}</small></div></div>)}
                  {post.commentCount > post.comments.length && <small className="community-more-comments">تُعرض أحدث التعليقات فقط.</small>}
                  <form onSubmit={(event) => { event.preventDefault(); void sendComment(post.postId); }} className="community-comment-form">
                    <input value={commentDrafts[post.postId] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.postId]: event.target.value }))} maxLength={1000} placeholder="أضف تعليقاً مهنياً..." />
                    <button type="submit" disabled={busy === "comment-" + post.postId}><Send size={14}/> إرسال</button>
                  </form>
                </div>}
              </article>
            );
          })}
        </div>
      )}
    </PlatformLayout>
  );
}
