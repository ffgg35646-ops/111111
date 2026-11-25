"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

export function BunnyLessonPlayer({ courseId, lessonId, title }: { courseId: string; lessonId: string; title: string }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [watermark, setWatermark] = useState("ETZAN · محتوى تعليمي محمي");
  const [stamp, setStamp] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState(0);

  useEffect(() => {
    let active = true;
    const updateStamp = () => {
      if (!active) return;
      setStamp(new Date().toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }));
      setWatermarkPosition((value) => value + 1);
    };
    updateStamp();
    const watermarkTimer = window.setInterval(updateStamp, 30000);
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!active || !data.authenticated || !data.user) return;
        const sessionTail = typeof data.user.sessionId === "string" ? data.user.sessionId.slice(-6) : "";
        setWatermark(
          String(data.user.name || "متدرب") + " · " + String(data.user.email || "") +
          (sessionTail ? " · " + sessionTail : ""),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
      window.clearInterval(watermarkTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/academy/courses/" + encodeURIComponent(courseId) + "/lessons/" + encodeURIComponent(lessonId) + "/video", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || typeof data.embedUrl !== "string") throw new Error(data.error || "تعذر تجهيز الفيديو.");
        if (active) setSrc(data.embedUrl);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "تعذر تشغيل الفيديو.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [courseId, lessonId]);

  const positions = [
    { top: "9%", right: "5%" },
    { top: "68%", left: "5%" },
    { top: "9%", left: "5%" },
    { top: "68%", right: "5%" },
  ];
  const position = positions[watermarkPosition % positions.length];

  return <div className="etzan-protected-video" onContextMenu={(event) => event.preventDefault()} style={{ position: "relative", overflow: "hidden" }}>
    {src ? <iframe src={src} title={title} loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ display: "block", width: "100%", aspectRatio: "16 / 9", border: 0 }} /> :
      <div className="portal-empty">{loading ? "جارٍ التحقق من الاشتراك وتجهيز رابط مشاهدة آمن..." : error}</div>}
    {src && <div aria-hidden="true" style={{
      position: "absolute", zIndex: 3, ...position, maxWidth: "88%",
      padding: "5px 9px", borderRadius: 6, color: "rgba(255,255,255,.86)",
      background: "rgba(0,0,0,.28)", textShadow: "0 1px 3px rgba(0,0,0,.9)",
      fontSize: "clamp(10px, 1.4vw, 13px)", lineHeight: 1.5, direction: "rtl",
      overflowWrap: "anywhere", pointerEvents: "none", userSelect: "none",
    }}>{watermark} · {stamp}</div>}
    <span className="etzan-video-protection-note"><ShieldCheck size={12}/> تشغيل محمي برابط مؤقت وعلامة مائية مرتبطة بالحساب</span>
  </div>;
}
