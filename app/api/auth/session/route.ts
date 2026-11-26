import { NextRequest, NextResponse } from "next/server";
import { inspectPlatformSession, isPlatformSessionActive } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const inspected = await inspectPlatformSession(request);
  const user = inspected.session;
  if (!user) return NextResponse.json(
    { authenticated: false, reason: inspected.reason || "invalid_token" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
  if (!(await isPlatformSessionActive(user))) return NextResponse.json(
    { authenticated: false, reason: "session_not_active" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
  return NextResponse.json({ authenticated: true, user }, { headers: { "Cache-Control": "no-store" } });
}
