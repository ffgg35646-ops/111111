import { NextRequest, NextResponse } from "next/server";
import { isPlatformSessionActive, readPlatformSession, requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await readPlatformSession(request);
  if (!user || !(await isPlatformSessionActive(user))) return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!user.mustChangePassword) {
    const activeAccount = await requirePlatformRole(request, [user.role]);
    if (!activeAccount) return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ authenticated: true, user }, { headers: { "Cache-Control": "no-store" } });
}
