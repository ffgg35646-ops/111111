"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

export function BunnyLessonPlayer({ courseId, lessonId, title }: { courseId: string; lessonId: string; title: string }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  return <div className="etzan-protected-video">
    {src ? <iframe src={src} title={title} loading="lazy" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ display: "block", width: "100%", aspectRatio: "16 / 9", border: 0 }} /> :
      <div className="portal-empty">{loading ? "جارٍ التحقق من الاشتراك وتجهيز رابط مشاهدة آمن..." : error}</div>}
    <span className="etzan-video-protection-note"><ShieldCheck size={12}/> تشغيل محمي برابط مؤقت خاص بهذا الدرس</span>
  </div>;
}
