import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";

type ConsultationNotice = {
  requestId: string;
  email: string;
  recipientName: string;
  subject: string;
  message: string;
  actionUrl?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

export async function sendConsultationNotice(db: Db, notice: ConsultationNotice) {
  const notificationId = randomUUID();
  const createdAt = new Date();
  const record = {
    notificationId,
    requestId: notice.requestId,
    email: notice.email.toLowerCase(),
    recipientName: notice.recipientName,
    category: "consultation",
    subject: notice.subject,
    message: notice.message,
    actionUrl: notice.actionUrl || "",
    channel: "email",
    deliveryStatus: "queued",
    createdAt,
  };
  try {
    await db.collection("platform_notifications").insertOne(record);
  } catch (error) {
    console.warn("Unable to persist consultation notification", error);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    await db.collection("platform_notifications").updateOne(
      { notificationId },
      { $set: { deliveryStatus: "email_not_configured", deliveryUpdatedAt: new Date() } },
    ).catch(() => undefined);
    return { sent: false, reason: "email_not_configured" as const };
  }

  const name = escapeHtml(notice.recipientName);
  const subject = escapeHtml(notice.subject);
  const message = escapeHtml(notice.message);
  const actionUrl = notice.actionUrl && /^https:\/\//i.test(notice.actionUrl)
    ? '<p style="margin:24px 0"><a href="' + escapeHtml(notice.actionUrl) + '" style="background:#b68b48;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none">متابعة الموعد</a></p>'
    : "";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [notice.email],
        subject: notice.subject,
        text: "مرحباً " + notice.recipientName + "\n\n" + notice.message + (notice.actionUrl ? "\n\n" + notice.actionUrl : ""),
        html: '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.9;color:#263642;max-width:600px;margin:auto;padding:28px"><div style="color:#b68b48;font-size:22px;font-weight:bold">اتزان | ETZAN</div><h2>' + subject + '</h2><p>مرحباً ' + name + '</p><p>' + message + '</p>' + actionUrl + '<hr style="border:0;border-top:1px solid #e6eaf0;margin:24px 0"><small>هذه رسالة آلية من منصة اتزان. لا ترسل عبر البريد بيانات صحية أو معلومات حساسة.</small></div>',
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
    await db.collection("platform_notifications").updateOne(
      { notificationId },
      { $set: { deliveryStatus: response.ok ? "sent" : "failed", providerMessageId: payload.id || "", deliveryError: response.ok ? "" : String(payload.message || "Email provider rejected message").slice(0, 300), deliveryUpdatedAt: new Date() } },
    );
    return { sent: response.ok, reason: response.ok ? "sent" as const : "provider_rejected" as const };
  } catch (error) {
    console.warn("Consultation email delivery failed", error);
    await db.collection("platform_notifications").updateOne(
      { notificationId },
      { $set: { deliveryStatus: "failed", deliveryError: "network_error", deliveryUpdatedAt: new Date() } },
    ).catch(() => undefined);
    return { sent: false, reason: "network_error" as const };
  }
}
