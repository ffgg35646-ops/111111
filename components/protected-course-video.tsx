"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize, ShieldCheck } from "lucide-react";
export function ProtectedCourseVideo({ courseId, title }: { courseId: string; title: string }) {
  const shell = useRef<HTMLDivElement>(null);
  const [watermark, setWatermark] = useState("ETZAN · محتوى مرخّص");
  const [stamp, setStamp] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () => { if (active) setStamp(new Date().toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })); };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    fetch("/api/auth/session", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      if (active && data.authenticated && data.user) {
        const tail = typeof data.user.sessionId === "string" ? data.user.sessionId.slice(-6) : "";
        setWatermark(String(data.user.name || "متدرب") + " · " + String(data.user.email || "") + (tail ? " · " + tail : ""));
      }
    }).catch(() => {});
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  async function fullscreen() {
    if (!shell.current) return;
    if (document.fullscreenElement !== shell.current) await shell.current.requestFullscreen().catch(() => {});
    else if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }
  return <div ref={shell} className="etzan-protected-video" onContextMenu={event => event.preventDefault()}>
    <video controls preload="metadata" playsInline controlsList="nodownload nofullscreen noplaybackrate" disablePictureInPicture
      src={"/api/learning/courses/" + encodeURIComponent(courseId) + "/video"} aria-label={title}/>
    <div className="etzan-video-watermark" aria-hidden="true">{watermark} · {stamp}</div>
    <button type="button" className="etzan-video-fullscreen" onClick={() => void fullscreen()} aria-label="ملء الشاشة"><Maximize size={15}/></button>
    <span className="etzan-video-protection-note"><ShieldCheck size={12}/> تشغيل مرتبط بحسابك</span>
  </div>;
}
