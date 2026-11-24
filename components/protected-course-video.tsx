"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, ShieldCheck } from "lucide-react";

export function ProtectedCourseVideo({ courseId, title }: { courseId: string; title: string }) {
  const shell = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const refreshingRef = useRef(false);
  const pendingTime = useRef<number | null>(null);
  const resumeAfterReload = useRef(false);
  const [source, setSource] = useState("");
  const [videoError, setVideoError] = useState("");
  const [watermark, setWatermark] = useState("ETZAN · محتوى مرخّص");
  const [stamp, setStamp] = useState("");

  const refreshAccess = useCallback(async (preservePlayback: boolean) => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    const video = videoRef.current;
    if (preservePlayback && video) {
      pendingTime.current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      resumeAfterReload.current = !video.paused;
    } else {
      pendingTime.current = null;
      resumeAfterReload.current = false;
    }
    try {
      const response = await fetch("/api/learning/courses/" + encodeURIComponent(courseId) + "/video/access", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || typeof data.videoUrl !== "string") throw new Error(data.error || "تعذر تجديد رابط الفيديو.");
      setVideoError("");
      setSource(data.videoUrl);
    } catch (cause) {
      setVideoError(cause instanceof Error ? cause.message : "تعذر تجديد رابط الفيديو.");
    } finally {
      refreshingRef.current = false;
    }
  }, [courseId]);

  useEffect(() => {
    let active = true;
    const refreshStamp = () => { if (active) setStamp(new Date().toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })); };
    refreshStamp();
    const stampTimer = window.setInterval(refreshStamp, 60000);
    const tokenTimer = window.setInterval(() => { if (active) void refreshAccess(true); }, 8 * 60 * 1000);
    const initialAccessTimer = window.setTimeout(() => { void refreshAccess(false); }, 0);
    fetch("/api/auth/session", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (active && data.authenticated && data.user) {
        const tail = typeof data.user.sessionId === "string" ? data.user.sessionId.slice(-6) : "";
        setWatermark(String(data.user.name || "متدرب") + " · " + String(data.user.email || "") + (tail ? " · " + tail : ""));
      }
    }).catch(() => {});
    return () => {
      active = false;
      window.clearInterval(stampTimer);
      window.clearInterval(tokenTimer);
      window.clearTimeout(initialAccessTimer);
    };
  }, [refreshAccess]);

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video || pendingTime.current === null) return;
    const position = pendingTime.current;
    pendingTime.current = null;
    if (Number.isFinite(position) && position > 0 && Number.isFinite(video.duration)) video.currentTime = Math.min(position, Math.max(0, video.duration - 0.5));
    if (resumeAfterReload.current) void video.play().catch(() => {});
    resumeAfterReload.current = false;
  }

  async function fullscreen() {
    if (!shell.current) return;
    if (document.fullscreenElement !== shell.current) await shell.current.requestFullscreen().catch(() => {});
    else if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }

  return <div ref={shell} className="etzan-protected-video" onContextMenu={event => event.preventDefault()}>
    {source ? <video ref={videoRef} controls preload="metadata" playsInline controlsList="nodownload nofullscreen noplaybackrate" disablePictureInPicture
      src={source} onLoadedMetadata={handleLoadedMetadata} onError={() => void refreshAccess(true)} aria-label={title}/> : <div className="portal-empty">جارٍ إصدار رابط تشغيل مؤقت والتحقق من صلاحية الالتحاق...</div>}
    <div className="etzan-video-watermark" aria-hidden="true">{watermark} · {stamp}</div>
    {source && <button type="button" className="etzan-video-fullscreen" onClick={() => void fullscreen()} aria-label="ملء الشاشة"><Maximize size={15}/></button>}
    <span className="etzan-video-protection-note"><ShieldCheck size={12}/> رابط تشغيل مؤقت يتجدد تلقائياً</span>
    {videoError && <p role="alert" style={{ color: "#fff", padding: 10, fontSize: 11 }}>{videoError} <button type="button" onClick={() => void refreshAccess(true)}>إعادة المحاولة</button></p>}
  </div>;
}
