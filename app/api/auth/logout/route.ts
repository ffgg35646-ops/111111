import { NextRequest, NextResponse } from "next/server";
import { clearedPlatformSessionCookieOptions, PLATFORM_SESSION_COOKIE } from "@/lib/platform-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(PLATFORM_SESSION_COOKIE, "", clearedPlatformSessionCookieOptions());
  return response;
}
