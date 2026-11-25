import { NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = await getClinicalDatabase();
    const rows = await db.collection("platform_course_content").find(
      { status: "published" },
      { projection: { _id: 0, courseId: 1, title: 1, description: 1, summary: 1, trackId: 1, category: 1, level: 1, duration: 1, price: 1, currency: 1, lessons: 1, updatedAt: 1 } },
    ).sort({ updatedAt: -1 }).limit(500).toArray();
    return NextResponse.json({ courses: rows.map(course => ({
      id: course.courseId, title: course.title, summary: course.summary || course.description || "",
      trackId: course.trackId, category: course.category || course.trackId, mode: "recorded",
      level: course.level, duration: course.duration, price: course.price, currency: course.currency || "SAR",
      outcomes: [], lessons: (Array.isArray(course.lessons) ? course.lessons : []).map((lesson: Record<string, unknown>) => ({
        id: String(lesson.id || ""), title: String(lesson.title || ""),
        videoReady: lesson.uploadStatus === "uploaded" && Boolean(lesson.videoId),
      })),
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Published academy courses GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل الدورات المنشورة." }, { status: 503 });
  }
}
