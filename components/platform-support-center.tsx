"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowUpRight, CheckCircle2, Circle, Clock3, Headphones,
  MessageCircle, MessageSquare, Plus, RefreshCw, Search, Send, ShieldCheck,
  UserRound, X,
} from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Mode = "student" | "staff";
type TicketStatus = "open" | "in_progress" | "waiting_student" | "waiting_support" | "resolved" | "closed";
type Ticket = {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: TicketStatus;
  createdByUserId: string;
  createdByName: string;
  createdByEmail?: string;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastMessageAt: string | Date;
  lastMessagePreview: string;
  messageCount: number;
};
type TicketMessage = {
  messageId: string;
  ticketId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string | Date;
};
type SessionUser = { userId: string; name: string; role: string };

const statusLabels: Record<TicketStatus, string> = {
  open: "مفتوحة",
  in_progress: "قيد المعالجة",
  waiting_student: "بانتظار رد الطالب",
  waiting_support: "بانتظار الدعم",
  resolved: "تم الحل",
  closed: "مغلقة",
};
const categoryLabels: Record<string, string> = {
  technical: "مشكلة تقنية", course: "الدورات والمحتوى", account: "الحساب والدخول",
  payment: "المدفوعات", other: "استفسار عام",
};
const priorityLabels: Record<string, string> = { low: "منخفضة", normal: "عادية", high: "مرتفعة", urgent: "عاجلة" };

function dateLabel(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}
function statusClass(status: string) {
  return "support-status status-" + status;
}

export function PlatformSupportCenter({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isStaff = mode === "staff";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState("");
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("technical");
  const [firstMessage, setFirstMessage] = useState("");
  const [reply, setReply] = useState("");

  const loadTickets = useCallback(async () => {
    try {
      const response = await fetch("/api/platform/support/tickets", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل التذاكر.");
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل التذاكر.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (ticketId: string) => {
    if (!ticketId) return;
    setDetailLoading(true);
    try {
      const response = await fetch("/api/platform/support/tickets?ticketId=" + encodeURIComponent(ticketId), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر فتح المحادثة.");
      setActiveTicket(data.ticket || null);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر فتح المحادثة.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.authenticated) {
        router.replace("/login?next=" + (isStaff ? "/platform-admin/support" : "/support"));
        return;
      }
      if (data.user?.mustChangePassword) {
        router.replace("/account/change-password");
        return;
      }
      if (active) setUser({ userId: String(data.user.userId || ""), name: String(data.user.name || ""), role: String(data.user.role || "") });
    }).catch(() => { if (active) setError("تعذر التحقق من جلسة الدخول."); });
    return () => { active = false; };
  }, [router, isStaff]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);
  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("ticket");
    if (selected) setActiveTicketId(selected);
  }, []);
  useEffect(() => {
    if (!activeTicketId) { setActiveTicket(null); setMessages([]); return; }
    void loadDetail(activeTicketId);
    const timer = window.setInterval(() => { void loadDetail(activeTicketId); void loadTickets(); }, 20000);
    return () => window.clearInterval(timer);
  }, [activeTicketId, loadDetail, loadTickets]);

  const visibleTickets = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ar");
    return tickets.filter((ticket) => (filter === "all" || ticket.status === filter) && (!needle || (ticket.subject + " " + ticket.ticketNumber + " " + ticket.createdByName).toLocaleLowerCase("ar").includes(needle)));
  }, [tickets, query]);

  const summary = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => ["open", "in_progress", "waiting_support"].includes(ticket.status)).length,
    waiting: tickets.filter((ticket) => ticket.status === "waiting_student").length,
    resolved: tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length,
  }), [tickets]);

  function selectTicket(ticketId: string) {
    setActiveTicketId(ticketId);
    setNewTicketOpen(false);
    if (typeof window !== "undefined") window.history.replaceState(null, "", (isStaff ? "/platform-admin/support" : "/support") + "?ticket=" + encodeURIComponent(ticketId));
  }

  function startNewTicket() {
    setActiveTicketId("");
    setActiveTicket(null);
    setMessages([]);
    setNewTicketOpen(true);
    setSubject("");
    setCategory("technical");
    setFirstMessage("");
    if (typeof window !== "undefined") window.history.replaceState(null, "", "/support");
  }

  async function submitNewTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/platform/support/tickets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, category, message: firstMessage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر فتح التذكرة.");
      setNewTicketOpen(false);
      setSubject("");
      setFirstMessage("");
      await loadTickets();
      selectTicket(String(data.ticketId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر فتح التذكرة.");
    } finally {
      setSaving(false);
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim() || saving || !activeTicketId) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/platform/support/tickets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", ticketId: activeTicketId, message: reply }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر إرسال الرد.");
      setReply("");
      await Promise.all([loadDetail(activeTicketId), loadTickets()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إرسال الرد.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTicket(values: Record<string, unknown>) {
    if (!activeTicketId || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/platform/support/tickets", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: activeTicketId, ...values }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحديث التذكرة.");
      await Promise.all([loadDetail(activeTicketId), loadTickets()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحديث التذكرة.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlatformLayout
      title={isStaff ? "تذاكر دعم الطلاب" : "الدعم الفني"}
      eyebrow="مركز المساندة"
      description={isStaff ? "استقبال استفسارات الطلاب ومتابعة المحادثات والرد عليها من مكان واحد." : "تواصل مع فريق اتزان، وافتح تذكرة لمشكلتك وتابع الردود والتحديثات حتى إغلاقها."}
    >
      <div className="support-center">
        <section className="support-welcome">
          <div className="support-welcome-icon">{isStaff ? <ShieldCheck size={24}/> : <Headphones size={24}/>}</div>
          <div><span>{isStaff ? "إدارة خدمة المستفيدين" : "نحن هنا لمساعدتك"}</span><h2>{isStaff ? "صندوق تذاكر الدعم" : "كيف يمكننا مساعدتك؟"}</h2><p>{isStaff ? "كل رسالة محفوظة داخل سجل التذكرة، وتصل إشعارات تلقائية عند وجود رد جديد." : "اكتب استفسارك بالتفصيل، وسيظهر رد فريق الدعم هنا مع إشعار عند كل تحديث."}</p></div>
          {!isStaff && <button type="button" className="support-primary-button" onClick={startNewTicket}><Plus size={17}/> تذكرة جديدة</button>}
        </section>

        <div className="support-stats">
          <article><span>إجمالي التذاكر</span><strong>{summary.total}</strong></article>
          <article><span>{isStaff ? "تحتاج متابعة" : "قيد المتابعة"}</span><strong>{summary.open}</strong></article>
          <article><span>{isStaff ? "بانتظار الطالب" : "بانتظار الرد"}</span><strong>{isStaff ? summary.waiting : tickets.filter((ticket) => ticket.status === "waiting_student").length}</strong></article>
          <article><span>مكتملة</span><strong>{summary.resolved}</strong></article>
        </div>

        {error && <div className="support-error" role="alert"><AlertCircle size={16}/>{error}<button type="button" onClick={() => setError("")} aria-label="إغلاق التنبيه"><X size={14}/></button></div>}

        <div className="support-workspace">
          <aside className="support-ticket-sidebar">
            <div className="support-list-heading"><div><h3>{isStaff ? "قائمة التذاكر" : "تذاكري"}</h3><small>{visibleTickets.length} تذكرة</small></div><button type="button" onClick={() => void loadTickets()} aria-label="تحديث القائمة"><RefreshCw size={15}/></button></div>
            <label className="support-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث برقم التذكرة أو العنوان"/></label>
            <div className="support-filter-row">
              {["all", "open", "in_progress", "waiting_student", "waiting_support", "resolved", "closed"].map((value) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "الكل" : statusLabels[value as TicketStatus]}</button>)}
            </div>
            <div className="support-ticket-list">
              {loading ? <div className="support-empty"><RefreshCw size={19}/> جارٍ تحميل التذاكر...</div> : visibleTickets.length ? visibleTickets.map((ticket) => (
                <button type="button" key={ticket.ticketId} className={"support-ticket-row" + (activeTicketId === ticket.ticketId ? " selected" : "")} onClick={() => selectTicket(ticket.ticketId)}>
                  <span className="support-ticket-row-top"><b>{ticket.ticketNumber}</b><small>{dateLabel(ticket.lastMessageAt)}</small></span>
                  <strong>{ticket.subject}</strong>
                  {isStaff && <span className="support-ticket-student"><UserRound size={12}/>{ticket.createdByName}</span>}
                  <span className="support-ticket-row-bottom"><i className={statusClass(ticket.status)}>{statusLabels[ticket.status]}</i><small>{ticket.messageCount || 0} رسالة</small></span>
                </button>
              )) : <div className="support-empty"><MessageSquare size={22}/><span>لا توجد تذاكر في هذا التصنيف.</span></div>}
            </div>
          </aside>

          <section className="support-conversation">
            {newTicketOpen && !isStaff ? (
              <form className="support-compose-new" onSubmit={submitNewTicket}>
                <div className="support-panel-heading"><div><span>طلب مساعدة جديد</span><h3>ما المشكلة التي تواجهك؟</h3><p>اختر التصنيف واكتب تفاصيل كافية حتى يتمكن الفريق من مساعدتك.</p></div><button type="button" onClick={() => setNewTicketOpen(false)} aria-label="إغلاق"><X size={18}/></button></div>
                <label>عنوان التذكرة<input required minLength={5} maxLength={140} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="مثال: لا أستطيع فتح محتوى الدورة"/></label>
                <label>تصنيف الطلب<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="technical">مشكلة تقنية</option><option value="course">الدورات والمحتوى</option><option value="account">الحساب وتسجيل الدخول</option><option value="payment">المدفوعات</option><option value="other">استفسار عام</option></select></label>
                <label>تفاصيل المشكلة<textarea required minLength={2} maxLength={3000} rows={6} value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} placeholder="اشرح ما حدث، ومتى بدأت المشكلة، وما الذي حاولت القيام به..."/></label>
                <div className="support-form-footer"><small>سيتم حفظ رسالتك ضمن سجل التذكرة ويمكنك متابعة الردود لاحقاً.</small><button className="support-primary-button" type="submit" disabled={saving}>{saving ? "جارٍ الإرسال..." : "إرسال التذكرة"} <ArrowUpRight size={16}/></button></div>
              </form>
            ) : activeTicketId && activeTicket ? (
              <>
                <header className="support-conversation-header">
                  <div><span>{activeTicket.ticketNumber} · {categoryLabels[activeTicket.category] || "استفسار"}</span><h3>{activeTicket.subject}</h3><small>أُنشئت في {dateLabel(activeTicket.createdAt)}</small></div>
                  <div className="support-conversation-actions">
                    <i className={statusClass(activeTicket.status)}>{statusLabels[activeTicket.status]}</i>
                    {isStaff && <select aria-label="تحديث حالة التذكرة" value={activeTicket.status} onChange={(event) => void updateTicket({ status: event.target.value })}><option value="open">مفتوحة</option><option value="in_progress">قيد المعالجة</option><option value="waiting_student">بانتظار رد الطالب</option><option value="waiting_support">بانتظار الدعم</option><option value="resolved">تم الحل</option><option value="closed">مغلقة</option></select>}
                  </div>
                </header>
                {isStaff && <div className="support-staff-toolbar"><span><UserRound size={14}/> {activeTicket.createdByName} · {activeTicket.createdByEmail || ""}</span><label>الأولوية<select value={activeTicket.priority} onChange={(event) => void updateTicket({ priority: event.target.value })}><option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">مرتفعة</option><option value="urgent">عاجلة</option></select></label><button type="button" onClick={() => void updateTicket({ assignedToUserId: activeTicket.assignedToUserId === user?.userId ? "" : user?.userId || "" })}>{activeTicket.assignedToUserId === user?.userId ? "إلغاء إسناد التذكرة لي" : "إسناد التذكرة إليّ"}</button>{activeTicket.assignedToName && <small>مسندة إلى: {activeTicket.assignedToName}</small>}</div>}
                <div className="support-message-list">
                  {detailLoading && !messages.length ? <div className="support-empty"><RefreshCw size={18}/> جارٍ تحميل المحادثة...</div> : messages.map((message) => {
                    const own = message.senderUserId === user?.userId;
                    return <article key={message.messageId} className={"support-message" + (own ? " own" : "")}>
                      <div className="support-message-meta"><strong>{own ? "أنت" : message.senderName}</strong><small>{message.senderRole === "trainee" ? "طالب" : "فريق اتزان"} · {dateLabel(message.createdAt)}</small></div>
                      <p>{message.body}</p>
                    </article>;
                  })}
                </div>
                <form className="support-reply-form" onSubmit={submitReply}>
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={3000} placeholder={activeTicket.status === "closed" ? "اكتب ردك لإعادة فتح التذكرة..." : "اكتب رسالتك هنا..."} required/>
                  <div><small>{isStaff ? "سيصل للطالب إشعار عند إرسال الرد." : "سيصل لفريق الدعم إشعار عند إرسال الرد."}</small><button type="submit" className="support-primary-button" disabled={saving || !reply.trim()}>{saving ? "جارٍ الإرسال..." : "إرسال الرد"} <Send size={15}/></button></div>
                </form>
              </>
            ) : detailLoading ? <div className="support-empty support-empty-large"><RefreshCw size={21}/> جارٍ فتح التذكرة...</div> : (
              <div className="support-empty support-empty-large"><div className="support-empty-icon"><MessageCircle size={28}/></div><h3>{isStaff ? "اختر تذكرة من القائمة" : "ابدأ محادثة مع فريق الدعم"}</h3><p>{isStaff ? "حدد إحدى التذاكر لعرض تفاصيلها والرد على الطالب وتحديث حالتها." : "اختر تذكرة سابقة لمتابعة المحادثة، أو أنشئ تذكرة جديدة عند الحاجة."}</p>{!isStaff && <button type="button" className="support-primary-button" onClick={startNewTicket}><Plus size={16}/> فتح تذكرة جديدة</button>}</div>
            )}
          </section>
        </div>
      </div>
    </PlatformLayout>
  );
}
