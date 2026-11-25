import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { PLATFORM_ROLES, requirePlatformRole, type PlatformRole } from "@/lib/platform-auth";
import { ensureDefaultProfessionalTemplates } from "@/lib/platform-professional-templates";
import { recordSecurityEvent } from "@/lib/platform-security";

export const runtime = "nodejs";
const managers: PlatformRole[] = ["admin", "platform_manager", "quality_manager", "content_manager"];
const clean = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validRoles = new Set<string>(PLATFORM_ROLES);

function normalizeTemplate(data: Record<string, unknown>) {
  const id = clean(data.id, 60).toLowerCase();
  const title = clean(data.title, 160);
  const group = clean(data.group, 100);
  const description = clean(data.description, 1200);
  const fieldsRaw = Array.isArray(data.fields) ? data.fields : [];
  const fields = fieldsRaw.slice(0, 40).map((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return { key: clean(item.key, 80).toLowerCase(), label: clean(item.label, 160) };
  }).filter((item) => /^[a-z0-9_-]{1,80}$/.test(item.key) && item.label.length > 0);
  const allowedRoles = Array.isArray(data.allowedRoles) ? [...new Set(data.allowedRoles.filter((role): role is string => typeof role === "string" && validRoles.has(role)))] : [];
  const status = data.status === "published" ? "published" : "draft";
  if (!/^[a-z0-9-]{3,60}$/.test(id) || title.length < 3 || !group || !description || !fields.length || !allowedRoles.length) return null;
  return { templateId: id, title, group, description, fields, allowedRoles, allowDownload: data.allowDownload === true, allowPrint: data.allowPrint === true, status };
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...PLATFORM_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لعرض مكتبة النماذج." }, { status: 401 });
  try {
    const db = await getClinicalDatabase();
    await ensureDefaultProfessionalTemplates(db);
    const query = managers.includes(actor.role) ? {} : { status: "published", allowedRoles: actor.role };
    const templates = await db.collection("etzan_tool_templates").find(query, { projection: { _id: 0 } }).sort({ group: 1, title: 1 }).toArray();
    return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Professional tool templates GET", error);
    return NextResponse.json({ error: "تعذر تحميل مكتبة النماذج." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, managers);
  if (!actor) return NextResponse.json({ error: "إدارة مكتبة النماذج متاحة للمسؤولين المخولين فقط." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات النموذج غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل بيانات النموذج." }, { status: 400 });
  const template = normalizeTemplate(body as Record<string, unknown>);
  if (!template) return NextResponse.json({ error: "تحقق من العنوان والتصنيف والحقول والأدوار المسموح لها." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    await ensureDefaultProfessionalTemplates(db);
    const now = new Date();
    const existing = await db.collection("etzan_tool_templates").findOne({ templateId: template.templateId }, { projection: { _id: 0, createdAt: 1, createdBy: 1 } });
    await db.collection("etzan_tool_templates").updateOne(
      { templateId: template.templateId },
      { $set: { ...template, updatedAt: now, updatedBy: actor.userId }, $setOnInsert: { createdAt: now, createdBy: actor.userId } },
      { upsert: true },
    );
    await recordSecurityEvent(db, { action: existing ? "professional_template_updated" : "professional_template_created", actorUserId: actor.userId, targetId: template.templateId, request });
    return NextResponse.json({ success: true, template: { ...template, createdAt: existing?.createdAt || now, updatedAt: now } }, { status: existing ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Professional tool template save", error);
    return NextResponse.json({ error: "تعذر حفظ تعريف النموذج." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const actor = await requirePlatformRole(request, managers);
  if (!actor) return NextResponse.json({ error: "لا تملك صلاحية أرشفة النماذج." }, { status: 403 });
  const id = clean(request.nextUrl.searchParams.get("id"), 60);
  if (!id) return NextResponse.json({ error: "حدد النموذج المطلوب أرشفته." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("etzan_tool_templates").updateOne({ templateId: id }, { $set: { status: "archived", updatedAt: new Date(), updatedBy: actor.userId } });
    if (!result.matchedCount) return NextResponse.json({ error: "النموذج غير موجود." }, { status: 404 });
    await recordSecurityEvent(db, { action: "professional_template_archived", actorUserId: actor.userId, targetId: id, request });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Professional tool template archive", error);
    return NextResponse.json({ error: "تعذر أرشفة النموذج." }, { status: 503 });
  }
}
