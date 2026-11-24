import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

const COMMUNITY_ROLES = ["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"] as const;
const MODERATOR_ROLES = ["admin","platform_manager","supervisor","quality_manager"] as const;
const CATEGORIES = ["الخدمة الاجتماعية","علم النفس","الإرشاد الأسري","الاضطرابات النمائية","التدريب المهني"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function escapeRegex(value: string) {
  return value.split("").map((character) => "\\.^$*+?()[]{}|".includes(character) ? "\\" + character : character).join("");
}
function safeHttpUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const moderation = request.nextUrl.searchParams.get("moderation") === "1";
  const actor = await requirePlatformRole(request, moderation ? [...MODERATOR_ROLES] : [...COMMUNITY_ROLES]);
  if (!actor) return NextResponse.json({ error: moderation ? "غير مصرح بإدارة المشاركات." : "سجل الدخول لعرض المجتمع المهني." }, { status: 401 });

  try {
    const db = await getClinicalDatabase();
    const query = clean(request.nextUrl.searchParams.get("q"), 80);
    const category = clean(request.nextUrl.searchParams.get("category"), 60);
    const filter: Record<string, unknown> = moderation ? {} : { status: "published" };
    if (!moderation && category && CATEGORIES.includes(category)) filter.category = category;
    if (!moderation && query) {
      const safeQuery = escapeRegex(query);
      filter.$or = [
        { title: { $regex: safeQuery, $options: "i" } },
        { body: { $regex: safeQuery, $options: "i" } },
        { category: { $regex: safeQuery, $options: "i" } },
      ];
    }
    const documents = await db.collection("etzan_community_posts")
      .find(filter, { projection: { _id: 0, postId: 1, authorId: 1, authorName: 1, role: 1, category: 1, title: 1, body: 1, status: 1, createdAt: 1, attachment: 1, resourceUrl: 1, resourceLabel: 1, likedBy: 1, comments: 1 } })
      .sort({ createdAt: -1 }).limit(moderation ? 200 : 100).toArray();
    const posts = documents.map((post) => {
      const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
      const comments = Array.isArray(post.comments) ? post.comments.slice(-20) : [];
      return {
        postId: post.postId,
        authorId: post.authorId,
        authorName: post.authorName,
        role: post.role,
        category: post.category,
        title: post.title,
        body: post.body,
        status: post.status,
        createdAt: post.createdAt,
        attachment: post.attachment || null,
        resourceUrl: post.resourceUrl || "",
        resourceLabel: post.resourceLabel || "",
        likeCount: likedBy.length,
        likedByMe: likedBy.includes(actor.userId),
        commentCount: Array.isArray(post.comments) ? post.comments.length : 0,
        comments: comments.map((comment) => ({
          commentId: comment.commentId,
          authorId: comment.authorId,
          authorName: comment.authorName,
          role: comment.role,
          body: comment.body,
          createdAt: comment.createdAt,
        })),
      };
    });
    return NextResponse.json({ posts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("community GET", error);
    return NextResponse.json({ error: "تعذر تحميل المجتمع المهني." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...COMMUNITY_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول للمشاركة في المجتمع." }, { status: 401 });

  let data: Record<string, unknown>;
  let upload: File | null = null;
  try {
    if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await request.formData();
      data = {
        title: form.get("title"),
        body: form.get("body"),
        category: form.get("category"),
        resourceUrl: form.get("resourceUrl"),
        resourceLabel: form.get("resourceLabel"),
      };
      const candidate = form.get("attachment");
      if (typeof File !== "undefined" && candidate instanceof File && candidate.size > 0) upload = candidate;
    } else {
      const body: unknown = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات المشاركة مطلوبة." }, { status: 400 });
      data = body as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: "تعذر قراءة بيانات المشاركة أو المرفق." }, { status: 400 });
  }

  const title = clean(data.title, 160);
  const text = clean(data.body, 3000);
  const category = clean(data.category, 60);
  const resourceUrlInput = clean(data.resourceUrl, 500);
  const resourceUrl = safeHttpUrl(resourceUrlInput);
  const resourceLabel = clean(data.resourceLabel, 100);
  if (title.length < 5 || text.length < 20 || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "أدخل عنواناً ومحتوى وتصنيفاً صالحاً." }, { status: 400 });
  }
  if (resourceUrlInput && !resourceUrl) return NextResponse.json({ error: "رابط المادة يجب أن يبدأ بـ http أو https." }, { status: 400 });
  if (upload && (upload.size > MAX_FILE_BYTES || !ALLOWED_FILE_TYPES.has(upload.type))) {
    return NextResponse.json({ error: "المرفق يجب أن يكون PDF أو Word أو PowerPoint أو صورة PNG/JPG وبحجم لا يتجاوز 5 ميجابايت." }, { status: 400 });
  }

  const now = new Date();
  const postId = randomUUID();
  let attachment: Record<string, unknown> | null = null;
  try {
    const db = await getClinicalDatabase();
    if (upload) {
      const fileId = randomUUID();
      const bytes = Buffer.from(await upload.arrayBuffer());
      const filename = upload.name.replace(/[\/\\\r\n"]/g, "_").slice(0, 160) || "community-material";
      await db.collection("etzan_community_files").insertOne({
        fileId, postId, filename, contentType: upload.type, size: bytes.byteLength, data: bytes,
        uploadedBy: actor.userId, createdAt: now,
      });
      attachment = { fileId, filename, contentType: upload.type, size: bytes.byteLength, downloadUrl: "/api/community/files/" + fileId };
    }

    const post = {
      postId, authorId: actor.userId, authorName: actor.name, role: actor.role,
      title, body: text, category, status: "pending_review", createdAt: now, updatedAt: now,
      resourceUrl, resourceLabel: resourceLabel || (resourceUrl ? "رابط مادة مهنية" : ""),
      attachment, likedBy: [], comments: [],
    };
    try {
      await db.collection("etzan_community_posts").insertOne(post);
    } catch (error) {
      if (attachment?.fileId) await db.collection("etzan_community_files").deleteOne({ fileId: attachment.fileId });
      throw error;
    }
    await db.collection("platform_audit_logs").insertOne({
      action: "community_post_submitted", actorUserId: actor.userId, postId, hasAttachment: Boolean(attachment), hasResourceLink: Boolean(resourceUrl), createdAt: now,
    }).catch((error) => console.warn("community post audit", error));
    return NextResponse.json({ success: true, postId, status: post.status }, { status: 201 });
  } catch (error) {
    console.error("community POST", error);
    return NextResponse.json({ error: "تعذر حفظ المشاركة. حاول مرة أخرى." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...MODERATOR_ROLES]);
  if (!actor) return NextResponse.json({ error: "إدارة المحتوى متاحة للمشرفين فقط." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات غير مكتملة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const postId = clean(data.postId, 80);
  const status = clean(data.status, 20);
  if (!postId || !["published", "rejected", "hidden"].includes(status)) return NextResponse.json({ error: "الحالة غير صالحة." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const posts = db.collection("etzan_community_posts");
    const existing = await posts.findOne({ postId }, { projection: { _id: 0, status: 1 } });
    if (!existing) return NextResponse.json({ error: "المشاركة غير موجودة." }, { status: 404 });
    await posts.updateOne({ postId }, { $set: { status, moderatedBy: actor.userId, moderatedAt: new Date(), updatedAt: new Date() } });
    await db.collection("platform_audit_logs").insertOne({
      action: "community_post_moderated", actorUserId: actor.userId, postId, previousStatus: existing.status, status, createdAt: new Date(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("community PATCH", error);
    return NextResponse.json({ error: "تعذر تحديث المشاركة." }, { status: 503 });
  }
}
