"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, MessageSquare, RefreshCw } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Item = { notificationId: string; title: string; message: string; href: string; type: string; createdAt: string | Date; readAt: string | Date | null };
function dateLabel(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/platform/notifications", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الإشعارات.");
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unreadCount) || 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تحميل الإشعارات.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function markAll() {
    await fetch("/api/platform/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAll: true }) });
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnread(0);
  }

  async function openItem(item: Item) {
    if (!item.readAt) {
      await fetch("/api/platform/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: item.notificationId }) });
      setUnread((count) => Math.max(0, count - 1));
      setItems((current) => current.map((row) => row.notificationId === item.notificationId ? { ...row, readAt: new Date().toISOString() } : row));
    }
    router.push(item.href || "/support");
  }

  return <PlatformLayout title="الإشعارات" description="كل التنبيهات والتحديثات المرتبطة بحسابك في منصة اتزان.">
    <section className="notification-page">
      <div className="notification-page-heading"><div><span><Bell size={16}/> مركز التنبيهات</span><h2>{unread ? unread + " إشعار غير مقروء" : "لا توجد إشعارات معلّقة"}</h2><p>تظهر هنا الردود الجديدة وتحديثات التذاكر والتنبيهات الخاصة بحسابك.</p></div><div><button type="button" onClick={() => void load()}><RefreshCw size={15}/> تحديث</button><button type="button" onClick={() => void markAll()} disabled={!unread}><CheckCheck size={15}/> قراءة الكل</button></div></div>
      {error && <div className="support-error">{error}</div>}
      {loading ? <div className="support-empty"><RefreshCw size={19}/> جارٍ تحميل الإشعارات...</div> : items.length ? <div className="notification-page-list">{items.map((item) => <button type="button" key={item.notificationId} className={"notification-page-item" + (!item.readAt ? " unread" : "")} onClick={() => void openItem(item)}><span><MessageSquare size={17}/></span><div><strong>{item.title}</strong><p>{item.message}</p><small>{dateLabel(item.createdAt)}</small></div>{!item.readAt && <i>جديد</i>}</button>)}</div> : <div className="support-empty support-empty-large"><Bell size={25}/><span>لا توجد إشعارات حتى الآن.</span></div>}
    </section>
  </PlatformLayout>;
}
