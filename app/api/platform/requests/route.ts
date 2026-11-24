import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { courses } from "@/lib/platform-catalog";
import { sendConsultationNotice } from "@/lib/consultation-notifications";

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


export async function GET(request: NextRequest) {
  const requestId = cleanText(request.nextUrl.searchParams.get("requestId"), 60);
  const email = cleanText(request.nextUrl.searchParams.get("email"), 180).toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return NextResponse.json({ error: "أدخل رقم الطلب والبريد الإلكتروني المسجلين." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const record = await db.collection("platform_requests").findOne(
      { requestId, email },
      { projection: { _id: 0, requestId: 1, kind: 1, status: 1, courseTitle: 1, preferredAt: 1, reviewedAt: 1, adminNote: 1, zoomMeeting: 1, quotedAmount: 1, currency: 1, paymentStatus: 1, createdAt: 1 } },
    );
    if (!record) return NextResponse.json({ error: "لم يتم العثور على طلب مطابق لهذه البيانات." }, { status: 404 });

    return NextResponse.json({
      requestId: record.requestId,
      kind: record.kind,
      status: record.status,
      courseTitle: record.courseTitle,
      preferredAt: record.preferredAt,
      reviewedAt: record.reviewedAt,
      adminNote: record.adminNote,
      quotedAmount: record.quotedAmount,
      currency: record.currency,
      paymentStatus: record.paymentStatus,
      zoomMeeting: record.status === "approved" ? record.zoomMeeting : undefined,
      createdAt: record.createdAt,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to check platform request status", error);
    return NextResponse.json({ error: "تعذر التحقق من الطلب حالياً." }, { status: 503 });
  }
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

  if (kind === "course_enrollment" || kind === "classroom_registration") {
    const learner = await requirePlatformRole(request, ["trainee", "admin", "platform_manager"]);
    if (!learner) return NextResponse.json({ error: "سجّل الدخول بحساب متدرب قبل طلب الالتحاق." }, { status: 401 });
    if (learner.email.toLowerCase() !== email) return NextResponse.json({ error: "استخدم البريد الإلكتروني نفسه المسجل في حساب المتدرب حتى يُفتح محتوى الدورة بعد الدفع." }, { status: 403 });
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
    if (kind === "classroom_registration") {
      const preferredAt = cleanText(data.preferredAt, 50);
      if (!Number.isFinite(Date.parse(preferredAt)) || Date.parse(preferredAt) < Date.now() + 5 * 60 * 1000) {
        return NextResponse.json({ error: "حدد موعداً مستقبلياً للفصل بعد خمس دقائق على الأقل." }, { status: 400 });
      }
      record.preferredAt = new Date(preferredAt);
      record.requestNote = cleanText(data.requestNote, 500);
    }
  }

  if (kind === "consultation") {
    const serviceId = cleanText(data.serviceId, 80);
    const slotId = cleanText(data.slotId, 80);
    if (!consultationServices.has(serviceId) || !/^[0-9a-f-]{36}$/i.test(slotId)) return NextResponse.json({ error: "اختر مجال الاستشارة وموعداً منشوراً من مقدم الخدمة." }, { status: 400 });
    record.serviceId = serviceId;
    record.consultationType = serviceId;
    record.deliveryMode = "video";
    record.videoPlatform = "zoom";
    record.slotId = slotId;
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
    const db = await getClinicalDatabase();
    const enriched: {bookId:string;quantity:number;title:string;productType:string;unitPrice:number}[] = [];
    for (const item of items) {
      const book = await db.collection("etzan_books").findOne({bookId:item.bookId,published:true});
      if (!book) return NextResponse.json({ error: "أحد الكتب لم يعد متاحاً في المكتبة. حدّث الصفحة وحاول مجدداً." }, { status: 409 });
      if (book.productType === "physical" && (!Number.isInteger(Number(book.stock)) || Number(book.stock) < item.quantity)) {
        return NextResponse.json({ error: "الكمية المطلوبة غير متاحة حالياً من الكتاب الورقي: " + String(book.title || item.bookId) }, { status: 409 });
      }
      enriched.push({bookId:item.bookId,quantity:item.quantity,title:String(book.title||"كتاب"),productType:book.productType==="physical"?"physical":"digital",unitPrice:Number(book.price)||0});
    }
    record.items = enriched;
    record.expectedAmount = Math.round(enriched.reduce((sum,item)=>sum+item.unitPrice*item.quantity,0)*100)/100;
    if (Number(record.expectedAmount) <= 0 || Number(record.expectedAmount) > 10000000) return NextResponse.json({error:"إجمالي قيمة طلب الكتب يجب أن يكون أكبر من صفر ولا يتجاوز 10,000,000 ريال."},{status:400});
    record.status = "awaiting_payment";
    record.paymentStatus = "payment_due";
    record.quotedAmount = record.expectedAmount;
    record.currency = "SAR";
    record.deliveryRegion = cleanText(data.deliveryRegion, 80);
    record.orderNote = cleanText(data.orderNote, 300);
  }

  let reservedSlotId = "";
  const reservedBooks: {bookId:string;quantity:number}[] = [];
  try {
    const db = await getClinicalDatabase();
    if (kind === "book_order" && Array.isArray(record.items)) {
      for (const raw of record.items as {bookId:string;quantity:number;productType:string}[]) {
        if (raw.productType !== "physical") continue;
        const reserved = await db.collection("etzan_books").updateOne(
          {bookId:raw.bookId,productType:"physical",published:true,stock:{$gte:raw.quantity}},
          {$inc:{stock:-raw.quantity,reserved:raw.quantity},$set:{updatedAt:new Date()}},
        );
        if (reserved.modifiedCount !== 1) {
          for (const item of reservedBooks) await db.collection("etzan_books").updateOne({bookId:item.bookId},{$inc:{stock:item.quantity,reserved:-item.quantity}});
          return NextResponse.json({error:"نفدت الكمية المتاحة من أحد الكتب الورقية أثناء تنفيذ الطلب. حدّث المكتبة وحاول مجدداً."},{status:409});
        }
        reservedBooks.push({bookId:raw.bookId,quantity:raw.quantity});
      }
      record.inventoryStatus = reservedBooks.length ? "reserved" : "none";
    }
    if (kind === "consultation") {
      const slotId = String(record.slotId), now = new Date();
      const availabilityFilter = { slotId, serviceIds: String(record.serviceId), startsAt: { $gt: now }, $or: [{ status: "open" }, { status: "reserved", reservedUntil: { $lt: now } }] };
      const slot = await db.collection("platform_consultant_slots").findOne(availabilityFilter);
      if (!slot) { for (const item of reservedBooks) await db.collection("etzan_books").updateOne({bookId:item.bookId},{$inc:{stock:item.quantity,reserved:-item.quantity}}); return NextResponse.json({ error: "هذا الموعد لم يعد متاحاً. حدّث قائمة المواعيد واختر وقتاً آخر." }, { status: 409 }); }
      const reserve = await db.collection("platform_consultant_slots").updateOne({ _id: slot._id, ...availabilityFilter }, { $set: { status: "reserved", reservationId: record.requestId, reservedUntil: new Date(now.getTime() + 90 * 60 * 1000) } });
      if (!reserve.modifiedCount) { for (const item of reservedBooks) await db.collection("etzan_books").updateOne({bookId:item.bookId},{$inc:{stock:item.quantity,reserved:-item.quantity}}); return NextResponse.json({ error: "سبق حجز هذا الموعد. اختر موعداً آخر." }, { status: 409 }); }
      reservedSlotId = slotId;
      record.preferredAt = slot.startsAt;
      record.providerUserId = slot.providerUserId;
      record.providerName = slot.providerName;
      record.durationMinutes = slot.durationMinutes;
    }
    let result;
    try { result = await db.collection("platform_requests").insertOne(record); }
    catch (error) {
      if (reservedSlotId) await db.collection("platform_consultant_slots").updateOne({ slotId: reservedSlotId, reservationId: record.requestId, status: "reserved" }, { $set: { status: "open" }, $unset: { reservationId: "", reservedUntil: "" } });
      for (const item of reservedBooks) await db.collection("etzan_books").updateOne({bookId:item.bookId},{$inc:{stock:item.quantity,reserved:-item.quantity}});
      throw error;
    }
    if (kind === "consultation") {
      const manageUrl = new URL("/my-consultations", request.nextUrl.origin);
      manageUrl.searchParams.set("requestId", String(record.requestId));
      manageUrl.searchParams.set("email", email);
      await sendConsultationNotice(db, {
        requestId: String(record.requestId),
        email,
        recipientName: name,
        subject: "تم استلام طلب الاستشارة - اتزان",
        message: "استلمنا طلبك بنجاح. الموعد محجوز مؤقتاً لمدة 90 دقيقة حتى اعتماد السعر وإتمام الدفع المسبق. رقم الطلب: " + String(record.requestId),
        actionUrl: manageUrl.toString(),
      });
    }
    return NextResponse.json({
      success: true,
      requestId: record.requestId,
      status: record.status,
      quotedAmount: record.quotedAmount,
      currency: record.currency,
      paymentStatus: record.paymentStatus,
      createdAt: record.createdAt,
      recordId: String(result.insertedId),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save platform request", error);
    return NextResponse.json({ error: "تعذر حفظ الطلب. تحقق من إعداد قاعدة البيانات." }, { status: 503 });
  }
}
