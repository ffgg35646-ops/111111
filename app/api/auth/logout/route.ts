import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { clearedPlatformSessionCookieOptions, PLATFORM_SESSION_COOKIE, readPlatformSession } from "@/lib/platform-auth";
import { recordSecurityEvent } from "@/lib/platform-security";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });

  const session = await readPlatformSession(request);
  if (session?.sessionId) {
    try {
      const db = await getClinicalDatabase();
      await db.collection("platform_sessions").updateOne(
        { sessionId: session.sessionId, userId: session.userId, status: "active" },
        { $set: { status: "closed", closedAt: new Date(), closeReason: "user_logout" } },
      );
      await recordSecurityEvent(db, { action: "logout", actorUserId: session.userId, targetId: session.sessionId, request });
    } catch (error) {
      console.warn("Unable to close platform session record", error);
    }
  }

  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(PLATFORM_SESSION_COOKIE, "", clearedPlatformSessionCookieOptions());
  return response;
}
