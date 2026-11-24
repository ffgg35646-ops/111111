import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";
const services = new Set(["social-consultation", "professional-consultation", "family-guidance", "cbt-consultation"]);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function GET(request: NextRequest) {
  const serviceId = clean(request.nextUrl.searchParams.get("serviceId"), 80);
  const manage = request.nextUrl.searchParams.get("manage") === "1";
  if (!manage && !services.has(serviceId)) return NextResponse.json({ error: "حدد مجال الاستشارة." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const now = new Date();
    if (manage) {
      const actor = await requirePlatformRole(request, ["admin", "platform_manager", "consultant"]);
      if (!actor) return NextResponse.json({ error: "غير مصرح بإدارة المواعيد." }, { status: 403 });
      const filter: Record<string, unknown> = actor.role === "consultant" ? { providerUserId: actor.userId } : {};
      const providers = actor.role === "consultant" ? [] : await db.collection("platform_users")
        .find({ role: "consultant", status: "active" }, { projection: { _id: 0, userId: 1, name: 1, email: 1 } })
        .sort({ name: 1 }).limit(200).toArray();
      const slots = await db.collection("platform_consultant_slots")
        .find(filter, { projection: { _id: 0, slotId: 1, providerUserId: 1, providerName: 1, serviceIds: 1, startsAt: 1, durationMinutes: 1, status: 1, reservedUntil: 1 } })
        .sort({ startsAt: 1 }).limit(300).toArray();
      const appointmentFilter: Record<string, unknown> = {
        kind: "consultation",
        status: { $in: ["awaiting_payment", "approved", "cancellation_requested", "completed"] },
      };
      if (actor.role === "consultant") appointmentFilter.providerUserId = actor.userId;
      const appointments = await db.collection("platform_requests")
        .find(appointmentFilter, { projection: { _id: 0, requestId: 1, name: 1, email: 1, serviceId: 1, providerUserId: 1, providerName: 1, preferredAt: 1, durationMinutes: 1, status: 1, paymentStatus: 1, zoomMeeting: 1, cancellationRequestedAt: 1 } })
        .sort({ preferredAt: 1 }).limit(300).toArray();
      return NextResponse.json({ slots, providers, appointments }, { headers: { "Cache-Control": "no-store" } });
    }

    const allSlots = await db.collection("platform_consultant_slots").find({
      serviceIds: serviceId,
      startsAt: { $gt: now, $lt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) },
      $or: [{ status: "open" }, { status: "reserved", reservedUntil: { $lt: now } }],
    }, { projection: { _id: 0, slotId: 1, providerUserId: 1, providerName: 1, startsAt: 1, durationMinutes: 1 } })
      .sort({ startsAt: 1 }).limit(500).toArray();

    const providers = Array.from(new Map(allSlots.map((slot) => [String(slot.providerUserId), {
      userId: String(slot.providerUserId), name: String(slot.providerName || "مقدم استشارة"),
    }])).values());
    const date = clean(request.nextUrl.searchParams.get("date"), 10);
    const providerUserId = clean(request.nextUrl.searchParams.get("providerUserId"), 100);
    const offsetMinutes = Math.max(-840, Math.min(840, Number(request.nextUrl.searchParams.get("timezoneOffset")) || 0));
    const dateStart = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(Date.parse(date + "T00:00:00.000Z") + offsetMinutes * 60000)
      : null;
    const dateEnd = dateStart ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : null;
    const slots = allSlots.filter((slot) => {
      if (providerUserId && String(slot.providerUserId) !== providerUserId) return false;
      if (dateStart && dateEnd && (!(slot.startsAt instanceof Date) || slot.startsAt < dateStart || slot.startsAt >= dateEnd)) return false;
      return true;
    });
    return NextResponse.json({ slots, providers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("consultant slots GET", error);
    return NextResponse.json({ error: "تعذر تحميل المواعيد المتاحة." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager", "consultant"]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول بصلاحية مقدم استشارة أو مدير." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الموعد غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات الموعد مطلوبة." }, { status: 400 });

  const data = body as Record<string, unknown>;
  const startsAt = new Date(typeof data.startsAt === "string" ? data.startsAt : "");
  const durationMinutes = Number(data.durationMinutes || 50);
  const serviceIds = Array.isArray(data.serviceIds) ? [...new Set(data.serviceIds.filter((value): value is string => typeof value === "string" && services.has(value)))] : [];
  if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < Date.now() + 30 * 60 * 1000 ||
      !Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 120 || !serviceIds.length) {
    return NextResponse.json({ error: "حدد موعداً بعد 30 دقيقة على الأقل، ومدة بين 30 و120 دقيقة، ومجال استشارة واحداً على الأقل." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    let providerUserId = actor.userId;
    let providerName = actor.name;
    if (actor.role !== "consultant") {
      const requestedProvider = clean(data.providerUserId, 100);
      if (!requestedProvider) return NextResponse.json({ error: "اختر مقدم الاستشارة المسؤول عن الموعد." }, { status: 400 });
      const provider = await db.collection("platform_users").findOne(
        { userId: requestedProvider, role: "consultant", status: "active" },
        { projection: { _id: 0, userId: 1, name: 1 } },
      );
      if (!provider) return NextResponse.json({ error: "حساب مقدم الاستشارة غير موجود أو غير نشط." }, { status: 404 });
      providerUserId = String(provider.userId);
      providerName = String(provider.name);
    }
    const overlap = await db.collection("platform_consultant_slots").findOne({
      providerUserId, status: { $in: ["open", "reserved", "booked"] },
      startsAt: { $lt: new Date(startsAt.getTime() + durationMinutes * 60000) },
      $expr: { $gt: [{ $add: ["$startsAt", { $multiply: ["$durationMinutes", 60000] }] }, startsAt] },
    });
    if (overlap) return NextResponse.json({ error: "يتعارض هذا الموعد مع موعد آخر لمقدم الخدمة." }, { status: 409 });

    await db.collection("platform_consultant_slots").createIndex({ slotId: 1 }, { unique: true });
    const slot = {
      slotId: randomUUID(), providerUserId, providerName, serviceIds, startsAt, durationMinutes,
      status: "open", createdBy: actor.userId, createdAt: new Date(),
    };
    await db.collection("platform_consultant_slots").insertOne(slot);
    await db.collection("platform_audit_logs").insertOne({
      action: "consultation_slot_created", actorUserId: actor.userId, slotId: slot.slotId,
      providerUserId, startsAt, createdAt: new Date(),
    });
    return NextResponse.json({ success: true, slot: { slotId: slot.slotId, providerName, serviceIds, startsAt, durationMinutes, status: "open" } }, { status: 201 });
  } catch (error) {
    console.error("consultant slot create", error);
    return NextResponse.json({ error: "تعذر حفظ الموعد." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager", "consultant"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح بإدارة المواعيد." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الإلغاء غير صالحة." }, { status: 400 }); }
  const slotId = body && typeof body === "object" && !Array.isArray(body) ? clean((body as Record<string, unknown>).slotId, 80) : "";
  if (!slotId) return NextResponse.json({ error: "رقم الموعد مطلوب." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const filter: Record<string, unknown> = { slotId, status: "open" };
    if (actor.role === "consultant") filter.providerUserId = actor.userId;
    const result = await db.collection("platform_consultant_slots").updateOne(filter, {
      $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: actor.userId },
    });
    if (!result.matchedCount) return NextResponse.json({ error: "الموعد غير موجود أو تم حجزه بالفعل." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("consultant slot cancellation", error);
    return NextResponse.json({ error: "تعذر إلغاء الموعد." }, { status: 503 });
  }
}
