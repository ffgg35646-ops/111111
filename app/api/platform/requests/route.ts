import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { courses, trainingCases } from "@/lib/platform-catalog";

export const runtime = "nodejs";

const requestKinds = new Set(["course_enrollment", "classroom_registration", "consultation", "room_rental", "book_order"]);
const consultationServices = new Set(["social-consultation", "professional-consultation", "family-guidance", "cbt-consultation"]);

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات الطلب غير مكتملة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const kind = cleanText(data.kind, 40);
  const name = cleanText(data.name, 100);
  const email = cleanText(data.email, 180).toLowerCase();
  const phone = cleanText(data.phone, 40);

  if (!requestKinds.has(kind)) return NextResponse.json({ error: "نوع الطلب غير مدعوم." }, { status: 400 });
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "أدخل الاسم والبريد الإلكتروني بصورة صحيحة." }, { status: 400 });
  }

  const record: Record<string, unknown> = {
    requestId: randomUUID(),
    kind,
    name,
    email,
    phone,
    status: "pending_review",
    createdAt: new Date(),
    source: "platform-web",
    schemaVersion: 1,
  };

  if (kind === "course_enrollment" || kind === "classroom_registration") {
    const courseId = cleanText(data.courseId, 80);
    const course = courses.find((item) => item.id === courseId);
    if (!course) return NextResponse.json({ error: "الدورة المحددة غير موجودة." }, { status: 404 });
    if (kind === "classroom_registration" && course.mode === "recorded") {
      return NextResponse.json({ error: "هذه الدورة مسجلة وليست فصلاً مباشراً." }, { status: 400 });
    }
    record.courseId = course.id;
    record.courseTitle = course.title;
    record.deliveryMode = course.mode;
  }

  if (kind === "consultation") {
    const serviceId = cleanText(data.serviceId, 80);
    const preferredAt = cleanText(data.preferredAt, 50);
    if (!consultationServices.has(serviceId) || !Number.isFinite(Date.parse(preferredAt))) {
      return NextResponse.json({ error: "اختر نوع الاستشارة وموعداً مفضلاً صحيحاً." }, { status: 400 });
    }
    record.serviceId = serviceId;
    if (Date.parse(preferredAt) < Date.now() + 5 * 60 * 1000) {
      return NextResponse.json({ error: "اختر موعداً مستقبلياً بعد خمس دقائق على الأقل." }, { status: 400 });
    }
    record.preferredAt = new Date(preferredAt);
    record.consent = data.consent === true;
    record.requestNote = cleanText(data.requestNote, 500);
    if (!record.consent) return NextResponse.json({ error: "يلزم تأكيد الموافقة على التواصل وحماية الخصوصية." }, { status: 400 });
  }

  if (kind === "room_rental") {
    const preferredAt = cleanText(data.preferredAt, 50);
    const durationMinutes = Number(data.durationMinutes);
    const attendees = Number(data.attendees);
    if (!Number.isFinite(Date.parse(preferredAt)) || !Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 240 || !Number.isInteger(attendees) || attendees < 2 || attendees > 500) {
      return NextResponse.json({ error: "تحقق من موعد القاعة ومدتها وعدد الحضور." }, { status: 400 });
    }
    if (Date.parse(preferredAt) < Date.now() + 5 * 60 * 1000) {
      return NextResponse.json({ error: "اختر موعداً مستقبلياً بعد خمس دقائق على الأقل." }, { status: 400 });
    }
    record.preferredAt = new Date(preferredAt);
    record.durationMinutes = durationMinutes;
    record.attendees = attendees;
    record.roomPurpose = cleanText(data.roomPurpose, 300);
  }

  if (kind === "book_order") {
    const rawItems = Array.isArray(data.items) ? data.items.slice(0, 15) : [];
    const items = rawItems.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const bookId = cleanText(row.bookId, 80);
      const quantity = Number(row.quantity);
      if (!bookId || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return [];
      return [{ bookId, quantity }];
    });
    if (!items.length) return NextResponse.json({ error: "أضف كتاباً واحداً على الأقل إلى الطلب." }, { status: 400 });
    record.items = items;
    record.deliveryRegion = cleanText(data.deliveryRegion, 80);
    record.orderNote = cleanText(data.orderNote, 300);
  }

  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("platform_requests").insertOne(record);
    return NextResponse.json({
      success: true,
      requestId: record.requestId,
      status: record.status,
      createdAt: record.createdAt,
      recordId: String(result.insertedId),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save platform request", error);
    return NextResponse.json({ error: "تعذر حفظ الطلب. تحقق من إعداد قاعدة البيانات." }, { status: 503 });
  }
}
