import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime = "nodejs";
const COMMUNITY_ROLES = ["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"] as const;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...COMMUNITY_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول للتفاعل مع المجتمع." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات التفاعل غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات التفاعل مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const postId = clean(data.postId, 80), action = clean(data.action, 20);
  if (!postId || !["like", "comment"].includes(action)) return NextResponse.json({ error: "نوع التفاعل غير صالح." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const posts = db.collection("etzan_community_posts");
    const post = await posts.findOne({ postId, status: "published" }, { projection: { _id: 0, likedBy: 1 } });
    if (!post) return NextResponse.json({ error: "المشاركة غير متاحة." }, { status: 404 });
    if (action === "like") {
      const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
      const alreadyLiked = likedBy.includes(actor.userId);
      if (alreadyLiked) await posts.updateOne({ postId, status: "published" }, { $pull: { likedBy: actor.userId } });
      else await posts.updateOne({ postId, status: "published" }, { $addToSet: { likedBy: actor.userId } });
      const updated = await posts.findOne({ postId }, { projection: { _id: 0, likedBy: 1 } });
      return NextResponse.json({ success: true, liked: Array.isArray(updated?.likedBy) && updated.likedBy.includes(actor.userId), likeCount: Array.isArray(updated?.likedBy) ? updated.likedBy.length : 0 });
    }
    const commentText = clean(data.comment, 1000);
    if (commentText.length < 3) return NextResponse.json({ error: "اكتب تعليقاً لا يقل عن ثلاثة أحرف." }, { status: 400 });
    const comment = { commentId: randomUUID(), authorId: actor.userId, authorName: actor.name, role: actor.role, body: commentText, createdAt: new Date() };
    const result = await posts.updateOne({ postId, status: "published", "comments.199": { $exists: false } }, { $push: { comments: comment } });
    if (!result.matchedCount) {
      const stillExists = await posts.findOne({ postId, status: "published" }, { projection: { _id: 1 } });
      return NextResponse.json({ error: stillExists ? "وصلت المشاركة إلى الحد الأقصى من التعليقات." : "المشاركة غير متاحة." }, { status: stillExists ? 409 : 404 });
    }
    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("community interaction POST", error);
    return NextResponse.json({ error: "تعذر حفظ التفاعل." }, { status: 503 });
  }
}
