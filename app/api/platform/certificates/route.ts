import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const configured = process.env.PLATFORM_ADMIN_API_KEY;
  const supplied = request.headers.get("x-platform-admin-key") || "";
  if (!configured || configured.length < 32 || supplied.length !== configured.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(configured));
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: NextRequest) {
  const serial = clean(request.nextUrl.searchParams.get("code"), 60).toUpperCase();
  if (!/^[A-F0-9-]{20,60}$/.test(serial)) {
    return NextResponse.json({ error: "أدخل رمز تحقق صالحاً." }, { status: 400 });
  }
  try {
    const db = await getClinicalDatabase();
    const certificate = await db.collection("platform_certificates").findOne(
      { serial, status: "issued" },
      { projection: { _id: 0, serial: 1, learnerName: 1, courseTitle: 1, issuedAt: 1, certificateType: 1 } },
    );
    if (!certificate) return NextResponse.json({ valid: false, error: "لم يتم العثور على شهادة صالحة بهذا الرمز." }, { status: 404 });
    return NextResponse.json({ valid: true, certificate }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Certificate verification failed", error);
    return NextResponse.json({ error: "تعذر التحقق من الشهادة حالياً." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "هذه العملية متاحة لإدارة المنصة فقط." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات إصدار الشهادة غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات الشهادة غير مكتملة." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const learnerName = clean(data.learnerName, 100);
  const courseTitle = clean(data.courseTitle, 180);
  const certificateType = clean(data.certificateType, 40) || "appreciation";
  if (!learnerName || !courseTitle || data.completionVerified !== true) {
    return NextResponse.json({ error: "لا تصدر الشهادة إلا بعد توثيق إتمام المتطلبات من إدارة المنصة." }, { status: 400 });
  }

  const serial = randomUUID().toUpperCase();
  const document = {
    serial,
    learnerName,
    courseTitle,
    certificateType,
    issuedAt: new Date(),
    status: "issued",
    issuedBy: "platform-admin",
    completionVerified: true,
  };
  try {
    const db = await getClinicalDatabase();
    await db.collection("platform_certificates").insertOne(document);
    return NextResponse.json({ success: true, certificate: { serial, learnerName, courseTitle, certificateType, issuedAt: document.issuedAt } }, { status: 201 });
  } catch (error) {
    console.error("Unable to issue certificate", error);
    return NextResponse.json({ error: "تعذر حفظ الشهادة." }, { status: 503 });
  }
}
