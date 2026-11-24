import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { recordSecurityEvent } from "@/lib/platform-security";
export const runtime = "nodejs";
const COMMUNITY_ROLES = ["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"] as const;
export async function GET(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  const actor = await requirePlatformRole(request, [...COMMUNITY_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لتنزيل المادة المهنية." }, { status: 401 });
  const { fileId } = await context.params;
  if (!/^[a-f0-9-]{20,80}$/i.test(fileId)) return NextResponse.json({ error: "الملف غير موجود." }, { status: 404 });
  try {
    const db = await getClinicalDatabase();
    const file = await db.collection("etzan_community_files").findOne({ fileId });
    if (!file) return NextResponse.json({ error: "الملف غير موجود." }, { status: 404 });
    const post = await db.collection("etzan_community_posts").findOne({ postId: file.postId }, { projection: { _id: 0, status: 1, authorId: 1 } });
    const moderator = ["admin","platform_manager","supervisor","quality_manager"].includes(actor.role);
    if (!post || (post.status !== "published" && post.authorId !== actor.userId && !moderator)) {
      await recordSecurityEvent(db, { action: "community_file_access_denied", actorUserId: actor.userId, targetId: fileId, request });
      return NextResponse.json({ error: "لا تملك صلاحية الوصول إلى هذه المادة." }, { status: 403 });
    }
    const stored = file.data as Uint8Array | { value: (asRaw?: boolean) => string | Uint8Array };
    const bytes = stored instanceof Uint8Array ? new Uint8Array(stored) : stored && typeof stored.value === "function" ? Buffer.from(stored.value(true) as Uint8Array) : null;
    if (!bytes) return NextResponse.json({ error: "تعذر قراءة الملف المخزن." }, { status: 500 });
    const filename = String(file.filename || "community-material").replace(/[\r\n"]/g, "_");
    await recordSecurityEvent(db, { action: "community_file_downloaded", actorUserId: actor.userId, targetId: fileId, request, metadata: { contentType: String(file.contentType || "application/octet-stream"), sizeBytes: bytes.byteLength } });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": String(file.contentType || "application/octet-stream"),
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(filename),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("community file GET", error);
    return NextResponse.json({ error: "تعذر تنزيل المادة." }, { status: 503 });
  }
}
