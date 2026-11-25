"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronLeft, MessageSquare, X } from "lucide-react";

type NotificationItem = {
  notificationId: string;
  title: string;
  message: string;
  href: string;
  type: string;
  createdAt: string | Date;
  readAt: string | Date | null;
};

function dateLabel(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    try {
      const response = await fetch("/api/platform/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unreadCount) || 0);
    } catch {
      // Notifications are an enhancement; a transient failure must not block navigation.
    }
  }

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/platform/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          setItems(Array.isArray(data.notifications) ? data.notifications : []);
          setUnread(Number(data.unreadCount) || 0);
        }
      } catch {}
    };
    void load();
    const timer = window.setInterval(() => { if (active) void load(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  async function openItem(item: NotificationItem) {
    if (!item.readAt) {
      await fetch("/api/platform/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: item.notificationId }),
      }).catch(() => null);
      setItems((current) => current.map((row) => row.notificationId === item.notificationId ? { ...row, readAt: new Date().toISOString() } : row));
      setUnread((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    router.push(item.href || "/notifications");
  }

  async function markAllRead() {
    if (!unread || loading) return;
    setLoading(true);
    try {
      await fetch("/api/platform/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnread(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="notification-bell-wrap" dir="rtl">
      <button type="button" className={"notification-bell-trigger" + (open ? " is-open" : "")} onClick={() => { setOpen((value) => !value); if (!open) void loadNotifications(); }} aria-label="الإشعارات" aria-expanded={open}>
        <Bell size={18}/>
        {unread > 0 && <span className="notification-bell-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <>
          <button type="button" className="notification-outside" aria-label="إغلاق الإشعارات" onClick={() => setOpen(false)}/>
          <section className="notification-popover" aria-label="الإشعارات">
            <header><div><strong>الإشعارات</strong><small>{unread ? unread + " غير مقروء" : "كل شيء محدّث"}</small></div><button type="button" onClick={() => setOpen(false)} aria-label="إغلاق"><X size={17}/></button></header>
            {unread > 0 && <button className="notification-mark-all" type="button" onClick={() => void markAllRead()} disabled={loading}><CheckCheck size={14}/> تحديد الكل كمقروء</button>}
            <div className="notification-popover-list">
              {items.length ? items.slice(0, 8).map((item) => (
                <button type="button" key={item.notificationId} className={"notification-item" + (!item.readAt ? " unread" : "")} onClick={() => void openItem(item)}>
                  <span className="notification-item-icon"><MessageSquare size={16}/></span>
                  <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{dateLabel(item.createdAt)}</small></span>
                  {!item.readAt && <i aria-label="غير مقروء"/>}
                </button>
              )) : <div className="notification-empty"><Bell size={22}/><span>لا توجد إشعارات حتى الآن.</span></div>}
            </div>
            <Link href="/notifications" className="notification-all-link" onClick={() => setOpen(false)}>عرض كل الإشعارات <ChevronLeft size={15}/></Link>
          </section>
        </>
      )}
    </div>
  );
}
