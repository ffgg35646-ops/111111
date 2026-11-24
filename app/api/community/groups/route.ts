import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime = "nodejs";
const COMMUNITY_ROLES = ["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"] as const;
const GROUPS = [
  { groupId: "social-work", name: "الخدمة الاجتماعية", description: "مناقشة الممارسة الاجتماعية ودراسة الحالة والتدخلات المجتمعية.", category: "الخدمة الاجتماعية", icon: "users" },
  { groupId: "psychology", name: "علم النفس", description: "تبادل المعرفة حول التقييم النفسي ومهارات المقابلة والممارسة المهنية.", category: "علم النفس", icon: "brain" },
  { groupId: "family-guidance", name: "الإرشاد الأسري", description: "خبرات الإرشاد الأسري والتواصل والعلاقات الأسرية.", category: "الإرشاد الأسري", icon: "heart" },
  { groupId: "developmental", name: "الاضطرابات النمائية", description: "التدخلات الداعمة والتواصل والعمل مع الأسر.", category: "الاضطرابات النمائية", icon: "accessibility" },
  { groupId: "professional-training", name: "التدريب المهني", description: "التدريب والإشراف وبناء الكفاءات المهنية.", category: "التدريب المهني", icon: "graduation" },
];
export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...COMMUNITY_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لعرض مجموعات المجتمع المهني." }, { status: 401 });
  try {
    const db = await getClinicalDatabase();
    const memberships = db.collection("etzan_community_group_memberships");
    await memberships.createIndex({ groupId: 1, userId: 1 }, { unique: true });
    const groups = await Promise.all(GROUPS.map(async (group) => ({
      ...group, memberCount: await memberships.countDocuments({ groupId: group.groupId }),
      joined: Boolean(await memberships.findOne({ groupId: group.groupId, userId: actor.userId }, { projection: { _id: 1 } })),
    })));
    return NextResponse.json({ groups }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("community groups GET", error);
    return NextResponse.json({ error: "تعذر تحميل مجموعات التخصص." }, { status: 503 });
  }
}
export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...COMMUNITY_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول للانضمام إلى المجموعات." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "حدد المجموعة المطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const groupId = typeof data.groupId === "string" ? data.groupId.trim() : "";
  const action = data.action === "leave" ? "leave" : "join";
  const group = GROUPS.find((item) => item.groupId === groupId);
  if (!group) return NextResponse.json({ error: "المجموعة المطلوبة غير موجودة." }, { status: 404 });
  try {
    const db = await getClinicalDatabase();
    const memberships = db.collection("etzan_community_group_memberships");
    await memberships.createIndex({ groupId: 1, userId: 1 }, { unique: true });
    if (action === "join") {
      await memberships.updateOne({ groupId, userId: actor.userId }, { $setOnInsert: { groupId, userId: actor.userId, joinedAt: new Date() } }, { upsert: true });
    } else {
      await memberships.deleteOne({ groupId, userId: actor.userId });
    }
    await db.collection("platform_audit_logs").insertOne({
      action: action === "join" ? "community_group_joined" : "community_group_left", actorUserId: actor.userId, groupId, createdAt: new Date(),
    }).catch((error) => console.warn("community group audit", error));
    return NextResponse.json({ success: true, groupId, joined: action === "join", memberCount: await memberships.countDocuments({ groupId }) });
  } catch (error) {
    console.error("community groups POST", error);
    return NextResponse.json({ error: "تعذر تحديث عضوية المجموعة." }, { status: 503 });
  }
}
