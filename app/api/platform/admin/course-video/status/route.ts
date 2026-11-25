import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بفحص حالة الفيديو." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الفيديو غير صالحة." }, { status: 400 }); }
  const videoId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).videoId === "string"
    ? String((body as Record<string, unknown>).videoId).trim() : "";
  if (!/^[a-f0-9-]{20,80}$/i.test(videoId)) return NextResponse.json({ error: "معرّف الفيديو غير صالح." }, { status: 400 });
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  if (!libraryId || !apiKey) return NextResponse.json({ error: "إعدادات Bunny Stream غير مكتملة." }, { status: 503 });
  try {
    const response = await fetch("https://video.bunnycdn.com/library/" + encodeURIComponent(libraryId) + "/videos/" + encodeURIComponent(videoId), {
      headers: { AccessKey: apiKey, Accept: "application/json" }, cache: "no-store",
    });
    const video = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: "تعذر قراءة حالة معالجة الفيديو." }, { status: 502 });
    const status = Number(video.status);
    return NextResponse.json({ videoId, status, isReady: status === 3, statusText: status === 3 ? "جاهز للمشاهدة" : status === 0 ? "في قائمة الانتظار" : status === 1 ? "جارٍ المعالجة" : status === 2 ? "جارٍ تجهيز الجودات" : "لم يكتمل التجهيز" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bunny Stream processing status failed", error);
    return NextResponse.json({ error: "تعذر التحقق من تجهيز الفيديو." }, { status: 502 });
  }
}
