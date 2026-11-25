import { randomInt } from "node:crypto";

export function createEmailCode() {
  return String(randomInt(100000, 1000000));
}

export async function sendPlatformCode(email: string, code: string, purpose: "verify" | "reset") {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.");
  const appName = "اتزان | ETZAN";
  const subject = purpose === "verify" ? "تأكيد البريد الإلكتروني - اتزان" : "استعادة كلمة المرور - اتزان";
  const heading = purpose === "verify" ? "تأكيد البريد الإلكتروني" : "إعادة تعيين كلمة المرور";
  const message = purpose === "verify"
    ? "استخدم رمز التأكيد التالي لإكمال إنشاء حسابك:"
    : "استخدم الرمز التالي لإعادة تعيين كلمة المرور:";
  const html = `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f3f6f7;padding:32px 12px;font-family:Arial,sans-serif;color:#24333b"><div style="max-width:480px;margin:auto;background:#fff;border:1px solid #e1e8eb;border-radius:16px;padding:28px"><h2 style="margin:0 0 14px;font-size:22px">${heading}</h2><p style="line-height:1.9;color:#657680">${message}</p><div style="margin:24px 0;padding:18px;text-align:center;background:#f1f6f6;border-radius:12px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#147d78">${code}</div><p style="font-size:13px;color:#788791;line-height:1.8">الرمز صالح لمدة 10 دقائق. لا تشاركه مع أي شخص. إذا لم تطلب هذه العملية، يمكنك تجاهل الرسالة.</p><hr style="border:0;border-top:1px solid #edf1f2;margin:22px 0"><p style="font-size:12px;color:#9aa5ab">${appName}</p></div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject, html }),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Platform email delivery failed", response.status, detail.slice(0, 500));
    throw new Error("Email provider rejected the message.");
  }
}
