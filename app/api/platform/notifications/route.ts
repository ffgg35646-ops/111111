import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { PLATFORM_ROLES, requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...PLATFORM_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول لعرض الإشعارات." }, { status: 401 });

  try {
    const db = await getClinicalDatabase();
    const collection = db.collection("platform_notifications");
    const [items, unreadCount] = await Promise.all([
      collection.find(
        { recipientUserId: actor.userId },
        { projection: { _id: 0, notificationId: 1, title: 1, message: 1, href: 1, type: 1, createdAt: 1, readAt: 1 } },
      ).sort({ createdAt: -1 }).limit(15).toArray(),
      collection.countDocuments({ recipientUserId: actor.userId, readAt: null }),
    ]);
    return NextResponse.json({ notifications: items, unreadCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load platform notifications", error);
    return NextResponse.json({ error: "تعذر تحميل الإشعارات." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "مصدر الطلب غير صالح." }, { status: 403 });
  const actor = await requirePlatformRole(request, [...PLATFORM_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول أولاً." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات غير مكتملة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  try {
    const db = await getClinicalDatabase();
    const collection = db.collection("platform_notifications");
    const now = new Date();
    if (data.markAll === true) {
      await collection.updateMany(
        { recipientUserId: actor.userId, readAt: null },
        { $set: { readAt: now } },
      );
    } else {
      const notificationId = typeof data.notificationId === "string" ? data.notificationId.trim().slice(0, 60) : "";
      if (!/^[0-9a-f-]{36}$/i.test(notificationId)) {
        return NextResponse.json({ error: "معرّف الإشعار غير صالح." }, { status: 400 });
      }
      await collection.updateOne(
        { notificationId, recipientUserId: actor.userId, readAt: null },
        { $set: { readAt: now } },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unable to update platform notification", error);
    return NextResponse.json({ error: "تعذر تحديث الإشعار." }, { status: 503 });
  }
}
