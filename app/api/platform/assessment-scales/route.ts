import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { PLATFORM_ROLES, requirePlatformRole, type PlatformRole } from "@/lib/platform-auth";
import { recordSecurityEvent } from "@/lib/platform-security";
import { practiceScales } from "@/lib/platform-catalog";

export const runtime = "nodejs";
const managers: PlatformRole[] = ["admin", "platform_manager", "supervisor", "quality_manager"];
const editors: PlatformRole[] = ["admin", "platform_manager", "quality_manager"];
const clean = (value: unknown, max = 3000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const licenseStatuses = new Set(["original", "public_domain", "licensed", "permission_pending", "restricted"]);
const categories = new Set(["psychological", "social", "behavioral", "developmental", "mixed"]);

async function seedTrainingScales(db: Awaited<ReturnType<typeof getClinicalDatabase>>) {
  const collection = db.collection("etzan_assessment_scales");
  const seeds = practiceScales.map((item, index) => ({
    scaleId: item.id,
    title: item.title,
    category: index === 2 ? "social" : index === 0 ? "developmental" : "psychological",
    domain: item.purpose,
    targetGroups: ["تدريب مهني"],
    description: item.purpose,
    administrationInstructions: "بطاقة تعلم أصلية للتدريب على التوثيق والملاحظة. لا تستخدمها كاختبار سريري أو لتقدير حالة حقيقية.",
    scoringInstructions: "لا يوجد تصحيح رقمي أو معيار مرجعي. توثق المجالات وصفياً فقط.",
    licenseStatus: "original",
    rightsHolder: "اتزان",
    licenseReference: "محتوى تدريبي أصلي غير مقنن",
    digitalAdministrationAllowed: false,
    items: [],
    scoring: { method: "manual", bands: [] },
    status: "published",
    trainingOnly: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "system-seed",
  }));
  await Promise.all(seeds.map((seed) => collection.updateOne(
    { scaleId: seed.scaleId },
    { $setOnInsert: seed },
    { upsert: true },
  )));
}

function normalizeScale(data: Record<string, unknown>) {
  const title = clean(data.title, 180);
  const category = clean(data.category, 40);
  const domain = clean(data.domain, 160);
  const description = clean(data.description, 1600);
  const targetGroups = Array.isArray(data.targetGroups) ? data.targetGroups.slice(0, 20).map((item) => clean(item, 80)).filter(Boolean) : [];
  const administrationInstructions = clean(data.administrationInstructions, 5000);
  const scoringInstructions = clean(data.scoringInstructions, 5000);
  const licenseStatus = clean(data.licenseStatus, 40);
  const rightsHolder = clean(data.rightsHolder, 180);
  const licenseReference = clean(data.licenseReference, 300);
  const digitalAdministrationAllowed = data.digitalAdministrationAllowed === true;
  const status = data.status === "published" ? "published" : "draft";
  const scoringInput = data.scoring && typeof data.scoring === "object" ? data.scoring as Record<string, unknown> : {};
  const method = scoringInput.method === "average" ? "average" : "sum";
  const bandsRaw = Array.isArray(scoringInput.bands) ? scoringInput.bands : [];
  const bands = bandsRaw.slice(0, 20).map((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const min = Number(item.min), max = Number(item.max);
    return { min, max, label: clean(item.label, 100), meaning: clean(item.meaning, 500) };
  }).filter((item) => Number.isFinite(item.min) && Number.isFinite(item.max) && item.max >= item.min && item.label);
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items = digitalAdministrationAllowed ? rawItems.slice(0, 120).map((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const prompt = clean(item.prompt, 1000);
    const optionsRaw = Array.isArray(item.options) ? item.options : [];
    const options = optionsRaw.slice(0, 10).map((option) => {
      const choice = option && typeof option === "object" ? option as Record<string, unknown> : {};
      return { label: clean(choice.label, 160), value: Number(choice.value) };
    }).filter((choice) => choice.label && Number.isFinite(choice.value));
    return { itemId: clean(item.itemId, 60) || randomUUID(), prompt, required: item.required !== false, options };
  }).filter((item) => item.prompt && item.options.length >= 2) : [];

  if (title.length < 3 || !categories.has(category) || !domain || !description || !targetGroups.length || !administrationInstructions || !scoringInstructions || !licenseStatuses.has(licenseStatus)) return null;
  if (status === "published" && ["permission_pending", "restricted"].includes(licenseStatus)) return null;
  if (licenseStatus === "licensed" && (!rightsHolder || !licenseReference)) return null;
  if (digitalAdministrationAllowed && !["original", "public_domain", "licensed"].includes(licenseStatus)) return null;
  if (digitalAdministrationAllowed && licenseStatus === "licensed" && (!rightsHolder || !licenseReference)) return null;
  if (digitalAdministrationAllowed && (!items.length || items.length !== rawItems.length)) return null;
  if (!digitalAdministrationAllowed && rawItems.length) return null;
  return {
    title, category, domain, targetGroups, description, administrationInstructions, scoringInstructions,
    licenseStatus, rightsHolder, licenseReference, digitalAdministrationAllowed, items,
    scoring: { method, bands },
    status,
    trainingOnly: licenseStatus === "original" && data.trainingOnly === true,
  };
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...PLATFORM_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لعرض مكتبة المقاييس." }, { status: 401 });
  try {
    const db = await getClinicalDatabase();
    await seedTrainingScales(db);
    const query = managers.includes(actor.role) ? {} : { status: "published" };
    const scales = await db.collection("etzan_assessment_scales").find(query, { projection: { _id: 0 } }).sort({ category: 1, title: 1 }).toArray();
    return NextResponse.json({ scales }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Assessment scale catalog GET", error);
    return NextResponse.json({ error: "تعذر تحميل مكتبة المقاييس." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, editors);
  if (!actor) return NextResponse.json({ error: "إدارة مكتبة المقاييس متاحة للمسؤولين المخولين فقط." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات المقياس غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل بيانات المقياس." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const normalized = normalizeScale(data);
  if (!normalized) return NextResponse.json({ error: "البيانات غير مكتملة، أو أن الترخيص لا يسمح بالنشر/التطبيق الإلكتروني. راجع بيانات الحقوق والتعليمات والبنود." }, { status: 400 });
  const scaleId = clean(data.scaleId, 60) || randomUUID();
  if (!/^[a-zA-Z0-9_-]{3,60}$/.test(scaleId)) return NextResponse.json({ error: "معرف المقياس غير صالح." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    await seedTrainingScales(db);
    const collection = db.collection("etzan_assessment_scales");
    const existing = await collection.findOne({ scaleId }, { projection: { _id: 0, createdAt: 1, createdBy: 1 } });
    const now = new Date();
    await collection.updateOne(
      { scaleId },
      { $set: { ...normalized, updatedAt: now, updatedBy: actor.userId }, $setOnInsert: { scaleId, createdAt: now, createdBy: actor.userId } },
      { upsert: true },
    );
    await recordSecurityEvent(db, { action: existing ? "assessment_scale_updated" : "assessment_scale_created", actorUserId: actor.userId, targetId: scaleId, request, metadata: { digitalAdministrationAllowed: normalized.digitalAdministrationAllowed, status: normalized.status, licenseStatus: normalized.licenseStatus } });
    return NextResponse.json({ success: true, scale: { ...normalized, scaleId, createdAt: existing?.createdAt || now, updatedAt: now } }, { status: existing ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Assessment scale save", error);
    return NextResponse.json({ error: "تعذر حفظ بيانات المقياس." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager", "supervisor", "quality_manager"]);
  if (!actor) return NextResponse.json({ error: "لا تملك صلاحية أرشفة المقاييس." }, { status: 403 });
  const id = clean(request.nextUrl.searchParams.get("id"), 60);
  if (!id) return NextResponse.json({ error: "حدد المقياس المطلوب أرشفته." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("etzan_assessment_scales").updateOne({ scaleId: id }, { $set: { status: "archived", digitalAdministrationAllowed: false, items: [], updatedAt: new Date(), updatedBy: actor.userId } });
    if (!result.matchedCount) return NextResponse.json({ error: "المقياس غير موجود." }, { status: 404 });
    await recordSecurityEvent(db, { action: "assessment_scale_archived", actorUserId: actor.userId, targetId: id, request });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Assessment scale archive", error);
    return NextResponse.json({ error: "تعذر أرشفة المقياس." }, { status: 503 });
  }
}
