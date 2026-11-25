import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformPermission } from "@/lib/platform-auth";
import { learningTracks } from "@/lib/platform-catalog";
import { buildSpecialistTracks } from "@/lib/specialist-tracks";

export const runtime = "nodejs";

const allowedIcons = new Set(["users", "brain", "heart-handshake", "workflow", "activity", "microscope", "stethoscope", "graduation-cap", "book-open"]);
const allowedAccents = new Set(["teal", "violet", "blue", "amber"]);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const cleanList = (value: unknown, maxItems = 20) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 180)).filter(Boolean).slice(0, maxItems)
  : [];

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function authorize(request: NextRequest) {
  return requirePlatformPermission(request, "specialist_tracks");
}

export async function GET(request: NextRequest) {
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية إدارة المسارات المهنية." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const records = await db.collection("platform_specialist_tracks").find(
      {}, { projection: { _id: 0 } },
    ).limit(200).toArray();
    return NextResponse.json({ tracks: buildSpecialistTracks(records, true) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Admin specialist tracks GET failed", error);
    return NextResponse.json({ error: "تعذر تحميل المسارات المهنية." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية إضافة المسارات المهنية." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات المسار غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات المسار مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const title = clean(data.title, 180);
  const summary = clean(data.summary, 3000);
  const outcomes = cleanList(data.outcomes);
  const units = cleanList(data.units);
  if (!title || !summary || !outcomes.length || !units.length) {
    return NextResponse.json({ error: "اكتب اسم المسار ووصفه ومهارة واحدة وخطة تعليمية واحدة على الأقل." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const collection = db.collection("platform_specialist_tracks");
    await collection.createIndex({ id: 1 }, { unique: true });
    const id = "custom-" + randomUUID().replaceAll("-", "").slice(0, 20);
    const now = new Date();
    const iconName = clean(data.iconName, 40);
    const accent = clean(data.accent, 30);
    const record = {
      id,
      title,
      summary,
      category: clean(data.category, 100) || "تخصص مهني",
      accent: allowedAccents.has(accent) ? accent : "teal",
      skills: cleanList(data.skills).length ? cleanList(data.skills) : outcomes,
      outcomes,
      units,
      practice: clean(data.practice, 1200) || "طبّق المهارات المستهدفة على حالة تدريبية افتراضية، ثم راجع النتائج مع مشرف مؤهل.",
      iconName: allowedIcons.has(iconName) ? iconName : "graduation-cap",
      status: data.status === "inactive" ? "inactive" : "active",
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Math.max(1, Math.min(9999, Number(data.sortOrder))) : 100,
      createdAt: now,
      createdBy: actor.userId,
      updatedAt: now,
      updatedBy: actor.userId,
    };
    await collection.insertOne(record);
    await db.collection("platform_audit_logs").insertOne({
      action: "specialist_track_created", actorUserId: actor.userId, trackId: id, title, createdAt: now,
    });
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error("Specialist track create failed", error);
    return NextResponse.json({ error: "تعذر إنشاء المسار المهني." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية تعديل المسارات المهنية." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات المسار غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات المسار مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const id = clean(data.id, 80);
  const title = clean(data.title, 180);
  const summary = clean(data.summary, 3000);
  const outcomes = cleanList(data.outcomes);
  const units = cleanList(data.units);
  if (!id || !title || !summary || !outcomes.length || !units.length) {
    return NextResponse.json({ error: "اكتب اسم المسار ووصفه ومهارة واحدة وخطة تعليمية واحدة على الأقل." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const isBuiltIn = learningTracks.some((track) => track.id === id);
    const collection = db.collection("platform_specialist_tracks");
    const existing = await collection.findOne({ id }, { projection: { _id: 1 } });
    if (!isBuiltIn && !existing) return NextResponse.json({ error: "المسار المطلوب غير موجود." }, { status: 404 });

    const now = new Date();
    const iconName = clean(data.iconName, 40);
    const accent = clean(data.accent, 30);
    const changes = {
      id,
      title,
      summary,
      category: clean(data.category, 100) || "تخصص مهني",
      accent: allowedAccents.has(accent) ? accent : "teal",
      skills: cleanList(data.skills).length ? cleanList(data.skills) : outcomes,
      outcomes,
      units,
      practice: clean(data.practice, 1200) || "طبّق المهارات المستهدفة على حالة تدريبية افتراضية، ثم راجع النتائج مع مشرف مؤهل.",
      iconName: allowedIcons.has(iconName) ? iconName : "graduation-cap",
      status: data.status === "inactive" ? "inactive" : "active",
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Math.max(1, Math.min(9999, Number(data.sortOrder))) : 100,
      updatedAt: now,
      updatedBy: actor.userId,
    };
    await collection.updateOne({ id }, {
      $set: changes,
      $setOnInsert: { createdAt: now, createdBy: actor.userId },
    }, { upsert: isBuiltIn });
    await db.collection("platform_audit_logs").insertOne({
      action: "specialist_track_updated", actorUserId: actor.userId, trackId: id, title, createdAt: now,
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Specialist track update failed", error);
    return NextResponse.json({ error: "تعذر حفظ تعديلات المسار المهني." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية تغيير حالة المسارات المهنية." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الحالة غير صالحة." }, { status: 400 }); }
  const data = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const id = clean(data.id, 80);
  const status = data.status === "inactive" || data.status === "active" ? data.status : "";
  if (!id || !status) return NextResponse.json({ error: "حدد المسار والحالة الجديدة." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const isBuiltIn = learningTracks.some((track) => track.id === id);
    const result = await db.collection("platform_specialist_tracks").updateOne(
      { id },
      { $set: { id, status, updatedAt: new Date(), updatedBy: actor.userId }, $setOnInsert: { createdAt: new Date(), createdBy: actor.userId } },
      { upsert: isBuiltIn },
    );
    if (!result.matchedCount && !result.upsertedCount) return NextResponse.json({ error: "المسار غير موجود." }, { status: 404 });
    await db.collection("platform_audit_logs").insertOne({
      action: "specialist_track_status_changed", actorUserId: actor.userId, trackId: id, status, createdAt: new Date(),
    });
    return NextResponse.json({ success: true, id, status });
  } catch (error) {
    console.error("Specialist track status failed", error);
    return NextResponse.json({ error: "تعذر تحديث حالة المسار." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await authorize(request);
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية أرشفة المسارات المهنية." }, { status: 403 });
  const id = clean(request.nextUrl.searchParams.get("id"), 80);
  if (!id) return NextResponse.json({ error: "معرّف المسار مطلوب." }, { status: 400 });
  if (learningTracks.some((track) => track.id === id)) {
    return NextResponse.json({ error: "لا يمكن حذف المسارات الأساسية؛ يمكنك إيقافها مؤقتاً." }, { status: 409 });
  }

  try {
    const db = await getClinicalDatabase();
    const now = new Date();
    const result = await db.collection("platform_specialist_tracks").updateOne(
      { id },
      { $set: { status: "archived", archivedAt: now, updatedAt: now, updatedBy: actor.userId } },
    );
    if (!result.matchedCount) return NextResponse.json({ error: "المسار غير موجود." }, { status: 404 });
    await db.collection("platform_audit_logs").insertOne({
      action: "specialist_track_archived", actorUserId: actor.userId, trackId: id, createdAt: now,
    });
    return NextResponse.json({ success: true, id, status: "archived" });
  } catch (error) {
    console.error("Specialist track archive failed", error);
    return NextResponse.json({ error: "تعذر أرشفة المسار المهني." }, { status: 503 });
  }
}
