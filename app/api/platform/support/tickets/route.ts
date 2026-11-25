import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
import { notifyPlatformRoles, notifyPlatformUsers } from "@/lib/platform-notifications";

export const runtime = "nodejs";

const STAFF_ROLES = ["admin", "platform_manager", "support"] as const;
const ACTOR_ROLES = [...STAFF_ROLES, "trainee"] as const;
const STATUSES = ["open", "in_progress", "waiting_student", "waiting_support", "resolved", "closed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const CATEGORIES = ["technical", "course", "account", "payment", "other"] as const;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function isStaff(role: string) {
  return (STAFF_ROLES as readonly string[]).includes(role);
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}
function preview(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 180);
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...ACTOR_ROLES]);
  if (!actor) return NextResponse.json({ error: "ليس لديك صلاحية الوصول إلى نظام الدعم." }, { status: 403 });

  try {
    const db = await getClinicalDatabase();
    const tickets = db.collection("platform_support_tickets");
    const ticketId = clean(request.nextUrl.searchParams.get("ticketId"), 60);

    if (ticketId) {
      const filter = isStaff(actor.role)
        ? { ticketId }
        : { ticketId, createdByUserId: actor.userId };
      const ticket = await tickets.findOne(filter, { projection: { _id: 0 } });
      if (!ticket) return NextResponse.json({ error: "التذكرة غير موجودة أو لا تملك صلاحية عرضها." }, { status: 404 });
      const messages = await db.collection("platform_support_messages")
        .find({ ticketId }, { projection: { _id: 0 } })
        .sort({ createdAt: 1 }).limit(300).toArray();
      return NextResponse.json({ ticket, messages }, { headers: { "Cache-Control": "no-store" } });
    }

    const status = clean(request.nextUrl.searchParams.get("status"), 30);
    const filter: Record<string, unknown> = isStaff(actor.role) ? {} : { createdByUserId: actor.userId };
    if (status && status !== "all" && (STATUSES as readonly string[]).includes(status)) filter.status = status;
    const records = await tickets.find(filter, {
      projection: {
        _id: 0, ticketId: 1, ticketNumber: 1, subject: 1, category: 1, priority: 1,
        status: 1, createdByUserId: 1, createdByName: 1, createdByEmail: 1,
        assignedToUserId: 1, assignedToName: 1, createdAt: 1, updatedAt: 1,
        lastMessageAt: 1, lastMessagePreview: 1, lastMessageBy: 1, messageCount: 1,
      },
    }).sort({ updatedAt: -1 }).limit(150).toArray();

    return NextResponse.json({ tickets: records }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load support tickets", error);
    return NextResponse.json({ error: "تعذر تحميل التذاكر." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...ACTOR_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات غير مكتملة." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const action = clean(data.action, 20);

  try {
    const db = await getClinicalDatabase();
    const tickets = db.collection("platform_support_tickets");
    const messages = db.collection("platform_support_messages");
    const now = new Date();
    const messageText = clean(data.message, 3000);
    if (messageText.length < 2) return NextResponse.json({ error: "اكتب رسالة واضحة قبل الإرسال." }, { status: 400 });

    if (action === "reply") {
      const ticketId = clean(data.ticketId, 60);
      if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return NextResponse.json({ error: "رقم التذكرة غير صالح." }, { status: 400 });
      const ticket = await tickets.findOne({ ticketId });
      if (!ticket) return NextResponse.json({ error: "التذكرة غير موجودة." }, { status: 404 });
      const staff = isStaff(actor.role);
      if (!staff && ticket.createdByUserId !== actor.userId) {
        return NextResponse.json({ error: "لا يمكنك الرد على هذه التذكرة." }, { status: 403 });
      }
      if (staff && ticket.status === "closed") {
        return NextResponse.json({ error: "التذكرة مغلقة. أعد فتحها قبل إرسال رد جديد." }, { status: 409 });
      }

      const message = {
        messageId: randomUUID(),
        ticketId,
        senderUserId: actor.userId,
        senderName: actor.name,
        senderRole: actor.role,
        body: messageText,
        createdAt: now,
      };
      await messages.insertOne(message);
      const nextStatus = staff ? "waiting_student" : "waiting_support";
      const savedStatus = ticket.status === "closed" || ticket.status === "resolved" ? "open" : nextStatus;
      await tickets.updateOne(
        { ticketId },
        { $set: {
          status: savedStatus,
          updatedAt: now, lastMessageAt: now, lastMessagePreview: preview(messageText),
          lastMessageBy: actor.userId,
        }, $inc: { messageCount: 1 } },
      );

      if (staff) {
        await notifyPlatformUsers(db, [String(ticket.createdByUserId)], {
          title: "رد جديد على تذكرة الدعم",
          message: "وصل رد من فريق اتزان على التذكرة " + String(ticket.ticketNumber || ""),
          href: "/support?ticket=" + ticketId,
          type: "support_reply",
          metadata: { ticketId },
        });
      } else if (ticket.assignedToUserId) {
        await notifyPlatformUsers(db, [String(ticket.assignedToUserId)], {
          title: "رد جديد من طالب",
          message: String(ticket.createdByName || "أحد الطلاب") + " أضاف رسالة إلى التذكرة " + String(ticket.ticketNumber || ""),
          href: "/platform-admin/support?ticket=" + ticketId,
          type: "support_reply",
          metadata: { ticketId },
        });
        await notifyPlatformRoles(db, ["admin", "platform_manager"], {
          title: "تحديث في تذكرة دعم",
          message: "أضاف الطالب رسالة إلى التذكرة " + String(ticket.ticketNumber || ""),
          href: "/platform-admin/support?ticket=" + ticketId,
          type: "support_reply",
          metadata: { ticketId },
        }, [String(ticket.assignedToUserId), actor.userId]);
      } else {
        await notifyPlatformRoles(db, [...STAFF_ROLES], {
          title: "رسالة جديدة من طالب",
          message: String(ticket.createdByName || actor.name) + " أضاف رسالة إلى التذكرة " + String(ticket.ticketNumber || ""),
          href: "/platform-admin/support?ticket=" + ticketId,
          type: "support_reply",
          metadata: { ticketId },
        }, [actor.userId]);
      }
      return NextResponse.json({ success: true, ticketId, status: savedStatus });
    }

    if (actor.role !== "trainee") {
      return NextResponse.json({ error: "إنشاء تذكرة جديدة متاح لحساب الطالب فقط." }, { status: 403 });
    }
    const subject = clean(data.subject, 140);
    const category = clean(data.category, 30);
    if (subject.length < 5) return NextResponse.json({ error: "عنوان التذكرة يجب ألا يقل عن 5 أحرف." }, { status: 400 });
    if (!(CATEGORIES as readonly string[]).includes(category)) return NextResponse.json({ error: "اختر تصنيفاً صحيحاً للتذكرة." }, { status: 400 });

    const ticketId = randomUUID();
    const ticketNumber = "ETZ-" + now.getFullYear() + "-" + ticketId.slice(0, 8).toUpperCase();
    const ticket = {
      ticketId, ticketNumber, subject, category, priority: "normal", status: "open",
      createdByUserId: actor.userId, createdByName: actor.name, createdByEmail: actor.email.toLowerCase(),
      assignedToUserId: null, assignedToName: null, createdAt: now, updatedAt: now,
      lastMessageAt: now, lastMessagePreview: preview(messageText), lastMessageBy: actor.userId,
      messageCount: 1, schemaVersion: 1,
    };
    await tickets.insertOne(ticket);
    await messages.insertOne({
      messageId: randomUUID(), ticketId, senderUserId: actor.userId,
      senderName: actor.name, senderRole: actor.role, body: messageText, createdAt: now,
    });
    await notifyPlatformRoles(db, [...STAFF_ROLES], {
      title: "تذكرة دعم جديدة",
      message: actor.name + " فتح تذكرة: " + subject,
      href: "/platform-admin/support?ticket=" + ticketId,
      type: "support_ticket",
      metadata: { ticketId, ticketNumber },
    }, [actor.userId]);

    return NextResponse.json({ success: true, ticketId, ticketNumber, status: "open" }, { status: 201 });
  } catch (error) {
    console.error("Unable to create support ticket or reply", error);
    return NextResponse.json({ error: "تعذر حفظ التذكرة أو الرسالة حالياً." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...STAFF_ROLES]);
  if (!actor) return NextResponse.json({ error: "هذه العملية متاحة لفريق الدعم والإدارة فقط." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات غير مكتملة." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const ticketId = clean(data.ticketId, 60);
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return NextResponse.json({ error: "رقم التذكرة غير صالح." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    const tickets = db.collection("platform_support_tickets");
    const ticket = await tickets.findOne({ ticketId });
    if (!ticket) return NextResponse.json({ error: "التذكرة غير موجودة." }, { status: 404 });

    const set: Record<string, unknown> = { updatedAt: new Date(), updatedByUserId: actor.userId, updatedByName: actor.name };
    let assignedUserId = "";
    let assignedName = "";
    if (data.status !== undefined) {
      const status = clean(data.status, 30);
      if (!(STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "حالة التذكرة غير مدعومة." }, { status: 400 });
      set.status = status;
    }
    if (data.priority !== undefined) {
      const priority = clean(data.priority, 20);
      if (!(PRIORITIES as readonly string[]).includes(priority)) return NextResponse.json({ error: "مستوى الأولوية غير صالح." }, { status: 400 });
      set.priority = priority;
    }
    if (data.assignedToUserId !== undefined) {
      assignedUserId = clean(data.assignedToUserId, 80);
      if (assignedUserId) {
        const assignee = await db.collection("platform_users").findOne(
          { userId: assignedUserId, role: { $in: [...STAFF_ROLES] }, status: "active" },
          { projection: { _id: 0, userId: 1, name: 1 } },
        );
        if (!assignee) return NextResponse.json({ error: "موظف الدعم المحدد غير موجود أو غير نشط." }, { status: 404 });
        assignedName = String(assignee.name || "فريق الدعم");
        set.assignedToUserId = assignedUserId;
        set.assignedToName = assignedName;
      } else {
        set.assignedToUserId = null;
        set.assignedToName = null;
      }
    }

    await tickets.updateOne({ ticketId }, { $set: set });
    if (data.status !== undefined && data.status !== ticket.status) {
      const statusText: Record<string, string> = {
        open: "مفتوحة", in_progress: "قيد المعالجة", waiting_student: "بانتظار ردك",
        waiting_support: "بانتظار فريق الدعم", resolved: "تم الحل", closed: "مغلقة",
      };
      await notifyPlatformUsers(db, [String(ticket.createdByUserId)], {
        title: "تم تحديث حالة تذكرة الدعم",
        message: "حالة التذكرة " + String(ticket.ticketNumber || "") + ": " + (statusText[String(set.status)] || String(set.status)),
        href: "/support?ticket=" + ticketId,
        type: "support_status",
        metadata: { ticketId, status: set.status },
      });
    }
    if (data.assignedToUserId !== undefined && assignedUserId) {
      await notifyPlatformUsers(db, [assignedUserId], {
        title: "تم إسناد تذكرة إليك",
        message: "تم إسناد التذكرة " + String(ticket.ticketNumber || "") + " إليك لمتابعتها.",
        href: "/platform-admin/support?ticket=" + ticketId,
        type: "support_assignment",
        metadata: { ticketId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to update support ticket", error);
    return NextResponse.json({ error: "تعذر تحديث التذكرة." }, { status: 503 });
  }
}
