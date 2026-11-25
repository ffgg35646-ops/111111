import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { readPlatformSession, requirePlatformRole, type PlatformRole } from "@/lib/platform-auth";
import { ensureDefaultProfessionalTemplates } from "@/lib/platform-professional-templates";

export const runtime = "nodejs";

const elevatedRoles: PlatformRole[] = ["admin", "platform_manager", "supervisor", "quality_manager"];
const createRoles: PlatformRole[] = ["admin", "platform_manager", "supervisor", "trainer", "trainee", "consultant", "quality_manager"];

function cleanText(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function getActiveUser(request: NextRequest) {
  const session = await readPlatformSession(request);
  if (!session || session.mustChangePassword) return null;
  return requirePlatformRole(request, [session.role]);
}

function canReadAll(role: PlatformRole) {
  return elevatedRoles.includes(role);
}

export async function GET(request: NextRequest) {
  const user = await getActiveUser(request);
  if (!user) return NextResponse.json({ error: "سجل الدخول للوصول إلى النماذج المحفوظة." }, { status: 401 });

  const id = cleanText(request.nextUrl.searchParams.get("id"), 60);
  const filter = id
    ? { recordId: id, ...(canReadAll(user.role) ? {} : { ownerId: user.userId }) }
    : canReadAll(user.role) ? {} : { ownerId: user.userId };

  try {
    const db = await getClinicalDatabase();
    await ensureDefaultProfessionalTemplates(db);
    const records = await db.collection("etzan_professional_forms")
      .find(filter, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .limit(id ? 1 : 100)
      .toArray();
    if (id && !records.length) return NextResponse.json({ error: "النموذج غير موجود أو لا تملك صلاحية الاطلاع عليه." }, { status: 404 });
    return NextResponse.json(id ? { record: records[0] } : { records }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load ETZAN professional forms", error);
    return NextResponse.json({ error: "تعذر تحميل النماذج المحفوظة." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getActiveUser(request);
  if (!user) return NextResponse.json({ error: "سجل الدخول أولاً." }, { status: 401 });
  if (!createRoles.includes(user.role)) return NextResponse.json({ error: "لا تملك صلاحية إنشاء النماذج المهنية." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "بيانات النموذج غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات النموذج غير مكتملة." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const type = cleanText(data.type, 40);
  const title = cleanText(data.title, 160);
  const subjectCode = cleanText(data.subjectCode, 60);
  const notes = cleanText(data.notes, 3000);
  const rawValues = data.values;
  if (!/^[a-z0-9-]{3,60}$/.test(type) || title.length < 3 || !rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) {
    return NextResponse.json({ error: "تحقق من نوع النموذج والعنوان والحقول المطلوبة." }, { status: 400 });
  }

  let template: Record<string, unknown> | null = null;
  let db: Awaited<ReturnType<typeof getClinicalDatabase>>;
  try {
    db = await getClinicalDatabase();
    await ensureDefaultProfessionalTemplates(db);
    template = await db.collection("etzan_tool_templates").findOne(
      { templateId: type, status: "published", allowedRoles: user.role },
      { projection: { _id: 0, templateId: 1, title: 1, fields: 1 } },
    ) as Record<string, unknown> | null;
  } catch (error) {
    console.error("Professional template permission lookup", error);
    return NextResponse.json({ error: "تعذر التحقق من صلاحية النموذج." }, { status: 503 });
  }
  if (!template || !Array.isArray(template.fields)) {
    return NextResponse.json({ error: "هذا النموذج غير منشور أو لا تملك صلاحية استخدامه." }, { status: 403 });
  }
  const fieldKeys = new Set(template.fields.flatMap((field) =>
    field && typeof field === "object" && typeof (field as Record<string, unknown>).key === "string"
      ? [String((field as Record<string, unknown>).key)] : [],
  ));
  const values = Object.fromEntries(
    Object.entries(rawValues as Record<string, unknown>)
      .filter(([key]) => fieldKeys.has(key))
      .slice(0, 40)
      .map(([key, value]) => [cleanText(key, 100), cleanText(value, 5000)])
      .filter(([key]) => Boolean(key)),
  );
  if (!Object.keys(values).length) return NextResponse.json({ error: "أدخل بيانات النموذج قبل الحفظ." }, { status: 400 });

  const now = new Date();
  const record = {
    recordId: randomUUID(),
    type,
    title: cleanText(template.title, 160) || title,
    subjectCode,
    notes,
    values,
    ownerId: user.userId,
    ownerName: user.name,
    ownerRole: user.role,
    createdAt: now,
    updatedAt: now,
    version: 1,
    trainingNotice: "نموذج مهني تدريبي؛ لا تُدخل بيانات تعريفية حقيقية قبل اعتماد ضوابط الخصوصية لدى الجهة.",
  };

  try {
    await db.collection("etzan_professional_forms").insertOne(record);
    await db.collection("platform_audit_logs").insertOne({
      action: "professional_form_created",
      actorUserId: user.userId,
      actorName: user.name,
      recordId: record.recordId,
      formType: type,
      createdAt: now,
    }).catch((error) => console.warn("Unable to record professional form audit event", error));
    return NextResponse.json({ success: true, record }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save ETZAN professional form", error);
    return NextResponse.json({ error: "تعذر حفظ النموذج. تحقق من اتصال قاعدة البيانات." }, { status: 503 });
  }
}
