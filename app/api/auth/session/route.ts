import { NextRequest, NextResponse } from "next/server";
import { readPlatformSession } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await readPlatformSession(request);
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ authenticated: true, user }, { headers: { "Cache-Control": "no-store" } });
}
