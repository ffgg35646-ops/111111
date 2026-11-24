import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager"]);
  if (!actor) return NextResponse.json({ error: "سجل الأمان متاح لإدارة المنصة فقط." }, { status: 403 });
  try {
    const db = await getClinicalDatabase();
    const events = await db.collection("platform_audit_logs").find(
      { category: "security" },
      { projection: { _id: 0, eventId: 1, action: 1, actorUserId: 1, targetId: 1, route: 1, userAgent: 1, metadata: 1, createdAt: 1 } },
    ).sort({ createdAt: -1 }).limit(150).toArray();
    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Security audit list failed", error);
    return NextResponse.json({ error: "تعذر تحميل سجل الأمان." }, { status: 503 });
  }
}
