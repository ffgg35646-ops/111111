import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح برفع فيديوهات الدورات." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الفيديو غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الفيديو مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const courseId = typeof data.courseId === "string" ? data.courseId.trim() : "";
  const lessonId = typeof data.lessonId === "string" ? data.lessonId.trim() : "";
  const fileName = typeof data.fileName === "string" ? data.fileName.trim().slice(0, 240) : "";
  const fileSize = Number(data.fileSize);
  const lessonTitle = typeof data.lessonTitle === "string" ? data.lessonTitle.trim().slice(0, 180) : "";
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(courseId) || !/^[a-zA-Z0-9-]{3,80}$/.test(lessonId) || !fileName || !lessonTitle) {
    return NextResponse.json({ error: "أكمل اسم الكورس والدرس واسم الملف." }, { status: 400 });
  }
  if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > 25 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: "حجم الفيديو يجب ألا يتجاوز 25 جيجابايت في عملية الرفع الواحدة." }, { status: 400 });
  }

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) {
    return NextResponse.json({ error: "خدمة رفع الفيديو غير مهيأة بعد. أضف BUNNY_STREAM_LIBRARY_ID وBUNNY_STREAM_API_KEY إلى متغيرات بيئة الخادم." }, { status: 503 });
  }

  try {
    const created = await fetch("https://video.bunnycdn.com/library/" + encodeURIComponent(libraryId) + "/videos", {
      method: "POST",
      headers: { AccessKey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ title: lessonTitle }),
      cache: "no-store",
    });
    const video = await created.json().catch(() => ({}));
    if (!created.ok || typeof video.guid !== "string") {
      console.error("Bunny Stream video creation failed", created.status, video);
      return NextResponse.json({ error: "تعذر إنشاء مساحة الفيديو لدى خدمة التخزين." }, { status: 502 });
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;
    const signature = createHash("sha256").update(String(libraryId) + apiKey + String(expiresAt) + video.guid).digest("hex");
    return NextResponse.json({
      videoId: video.guid,
      libraryId,
      uploadEndpoint: "https://video.bunnycdn.com/tusupload",
      signature,
      expiresAt,
      lessonId,
      fileName,
      fileSize,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Bunny Stream upload session failed", error);
    return NextResponse.json({ error: "تعذر بدء جلسة رفع الفيديو." }, { status: 502 });
  }
}
