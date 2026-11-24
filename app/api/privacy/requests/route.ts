import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { PLATFORM_ROLES, requirePlatformRole } from "@/lib/platform-auth";
import { recordSecurityEvent } from "@/lib/platform-security";

export const runtime = "nodejs";
const sameOrigin = (request: NextRequest) => !request.headers.get("origin") || request.headers.get("origin") === request.nextUrl.origin;
const requestTypes = new Set(["access", "copy", "correction", "deletion", "restriction", "withdraw_consent", "objection", "other"]);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const adminRoles = ["admin", "platform_manager"] as const;

export async function GET(request: NextRequest) {
  const adminView = request.nextUrl.searchParams.get("admin") === "1";
  const actor = await requirePlatformRole(request, adminView ? [...adminRoles] : [...PLATFORM_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول للوصول إلى طلبات الخصوصية." }, { status: 401 });
  try {
    const db = await getClinicalDatabase();
    const filter = adminView ? {} : { userId: actor.userId };
    const requests = await db.collection("platform_privacy_requests").find(filter, {
      projection: {
        _id: 0, requestId: 1, userId: 1, requesterName: 1, requesterEmail: 1, requestType: 1,
        description: 1, status: 1, receivedAt: 1, dueAt: 1, extensionCount: 1,
        extensionReason: 1, extensionNoticeMethod: 1, extensionNoticeAt: 1,
        adminNote: 1, reviewedAt: 1, completedAt: 1, createdAt: 1, updatedAt: 1,
      },
    }).sort({ createdAt: -1 }).limit(adminView ? 300 : 100).toArray();
    return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Privacy requests GET", error);
    return NextResponse.json({ error: "تعذر تحميل طلبات الخصوصية." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...PLATFORM_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول لتقديم طلب خصوصية." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل تفاصيل الطلب." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const requestType = clean(data.requestType, 40);
  const description = clean(data.description, 2000);
  if (!requestTypes.has(requestType) || description.length < 15) {
    return NextResponse.json({ error: "اختر نوع الطلب واكتب وصفاً واضحاً لا يقل عن 15 حرفاً." }, { status: 400 });
  }
  const now = new Date();
  const item = {
    requestId: randomUUID(),
    userId: actor.userId,
    requesterName: actor.name,
    requesterEmail: actor.email.toLowerCase(),
    requesterRole: actor.role,
    requestType,
    description,
    status: "received",
    receivedAt: now,
    dueAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    extensionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const db = await getClinicalDatabase();
    await db.collection("platform_privacy_requests").createIndex({ requestId: 1 }, { unique: true });
    await db.collection("platform_privacy_requests").createIndex({ userId: 1, createdAt: -1 });
    await db.collection("platform_privacy_requests").createIndex({ status: 1, dueAt: 1 });
    await db.collection("platform_privacy_requests").insertOne(item);
    await recordSecurityEvent(db, { action: "privacy_request_submitted", actorUserId: actor.userId, targetId: item.requestId, request, metadata: { requestType } });
    return NextResponse.json({
      success: true,
      request: { requestId: item.requestId, requestType, status: item.status, receivedAt: item.receivedAt, dueAt: item.dueAt },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Privacy request POST", error);
    return NextResponse.json({ error: "تعذر حفظ طلب الخصوصية." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...adminRoles]);
  if (!actor) return NextResponse.json({ error: "إدارة طلبات الخصوصية متاحة لإدارة المنصة فقط." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات التحديث غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بيانات التحديث مطلوبة." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const requestId = clean(data.requestId, 60);
  const action = clean(data.action, 30);
  const adminNote = clean(data.adminNote, 2000);
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !["review", "fulfill", "reject", "extend"].includes(action)) {
    return NextResponse.json({ error: "رقم الطلب أو الإجراء غير صالح." }, { status: 400 });
  }
  if ((action === "fulfill" || action === "reject") && adminNote.length < 10) {
    return NextResponse.json({ error: "أدخل توضيحاً لا يقل عن 10 أحرف لإغلاق الطلب." }, { status: 400 });
  }
  try {
    const db = await getClinicalDatabase();
    const collection = db.collection("platform_privacy_requests");
    const current = await collection.findOne({ requestId });
    if (!current) return NextResponse.json({ error: "طلب الخصوصية غير موجود." }, { status: 404 });
    if (["fulfilled", "rejected"].includes(String(current.status))) {
      return NextResponse.json({ error: "الطلب مغلق بالفعل ولا يمكن تعديله." }, { status: 409 });
    }
    const now = new Date();
    const update: Record<string, unknown> = { updatedAt: now, updatedBy: actor.userId };
    if (action === "review") {
      update.status = "in_review";
      update.reviewedAt = now;
      if (adminNote) update.adminNote = adminNote;
    }
    if (action === "fulfill" || action === "reject") {
      update.status = action === "fulfill" ? "fulfilled" : "rejected";
      update.adminNote = adminNote;
      update.completedAt = now;
      update.completedBy = actor.userId;
    }
    if (action === "extend") {
      const reason = clean(data.extensionReason, 1000);
      const noticeDetails = clean(data.noticeDetails, 1000);
      const noticeMethod = clean(data.noticeMethod, 30);
      if (Number(current.extensionCount || 0) >= 1) return NextResponse.json({ error: "تم تمديد هذا الطلب سابقاً؛ لا يسمح النظام بتمديد ثانٍ." }, { status: 409 });
      if (reason.length < 15 || noticeDetails.length < 10 || !["email", "sms", "phone", "portal", "other"].includes(noticeMethod) || data.noticeSent !== true) {
        return NextResponse.json({ error: "قبل التمديد، سجّل مبرراً واضحاً وطريقة وتفاصيل إشعار صاحب البيانات وأكد أن الإشعار أُرسل فعلاً." }, { status: 400 });
      }
      const baseDueAt = current.dueAt instanceof Date ? current.dueAt : new Date(String(current.dueAt || current.receivedAt || now));
      if (!Number.isFinite(baseDueAt.getTime())) return NextResponse.json({ error: "تاريخ الاستحقاق المسجل غير صالح." }, { status: 409 });
      update.status = "in_review";
      update.extensionCount = 1;
      update.dueAt = new Date(baseDueAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      update.extensionReason = reason;
      update.extensionNoticeMethod = noticeMethod;
      update.extensionNoticeDetails = noticeDetails;
      update.extensionNoticeAt = now;
      update.extensionRecordedBy = actor.userId;
      if (adminNote) update.adminNote = adminNote;
    }
    const result = await collection.updateOne({ requestId, status: current.status }, { $set: update });
    if (!result.modifiedCount) return NextResponse.json({ error: "تغيرت حالة الطلب. حدّث الصفحة وحاول مجدداً." }, { status: 409 });
    await recordSecurityEvent(db, {
      action: "privacy_request_" + action,
      actorUserId: actor.userId,
      targetId: requestId,
      request,
      metadata: { previousStatus: String(current.status), nextStatus: String(update.status) },
    });
    return NextResponse.json({ success: true, requestId, status: update.status, dueAt: update.dueAt || current.dueAt });
  } catch (error) {
    console.error("Privacy request PATCH", error);
    return NextResponse.json({ error: "تعذر تحديث طلب الخصوصية." }, { status: 503 });
  }
}
