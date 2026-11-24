import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("admin") === "1") {
    const actor = await requirePlatformRole(request, ["admin","platform_manager"]);
    if (!actor) return NextResponse.json({ error: "إدارة الشهادات متاحة لمدير النظام فقط." }, { status: 403 });
    try {
      const db = await getClinicalDatabase();
      const certificates = await db.collection("platform_certificates").find({}, { projection: { _id: 0, serial: 1, learnerName: 1, courseTitle: 1, issuedAt: 1, certificateType: 1, status: 1, revokedAt: 1 } }).sort({ issuedAt: -1 }).limit(500).toArray();
      return NextResponse.json({ certificates }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("Certificate administration list failed", error);
      return NextResponse.json({ error: "تعذر تحميل سجل الشهادات." }, { status: 503 });
    }
  }
  if (request.nextUrl.searchParams.get("mine") === "1") {
    const actor = await requirePlatformRole(request, ["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"]);
    if (!actor) return NextResponse.json({ error: "سجل الدخول لعرض شهاداتك." }, { status: 401 });
    try { const db = await getClinicalDatabase(); const certificates = await db.collection("platform_certificates").find({ userId: actor.userId }, { projection: { _id: 0, serial: 1, learnerName: 1, courseTitle: 1, issuedAt: 1, certificateType: 1, status: 1 } }).sort({ issuedAt: -1 }).limit(100).toArray(); return NextResponse.json({ certificates }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { console.error("My certificates lookup failed", error); return NextResponse.json({ error: "تعذر تحميل شهاداتك." }, { status: 503 }); }
  }
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
  const actor = await requirePlatformRole(request, ["admin","platform_manager"]);
  if (!actor) return NextResponse.json({ error: "إصدار الشهادات متاح لمدير النظام فقط." }, { status: 403 });
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
    issuedBy: actor.userId,
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

export async function PATCH(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin","platform_manager"]);
  if (!actor) return NextResponse.json({ error: "إلغاء الشهادات متاح لمدير النظام فقط." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الإلغاء غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل رمز الشهادة." }, { status: 400 });
  const serial = clean((body as Record<string, unknown>).serial, 60).toUpperCase();
  if (!/^[A-F0-9-]{20,60}$/.test(serial)) return NextResponse.json({ error: "رمز الشهادة غير صالح." }, { status: 400 });
  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("platform_certificates").updateOne({ serial, status: "issued" }, { $set: { status: "revoked", revokedAt: new Date(), revokedBy: actor.userId } });
    if (!result.matchedCount) return NextResponse.json({ error: "الشهادة غير موجودة أو سبق إلغاؤها." }, { status: 404 });
    await db.collection("platform_audit_logs").insertOne({ action: "certificate_revoked", actorUserId: actor.userId, serial, createdAt: new Date() });
    return NextResponse.json({ success: true, serial, status: "revoked" });
  } catch (error) {
    console.error("Certificate revocation failed", error);
    return NextResponse.json({ error: "تعذر إلغاء الشهادة." }, { status: 503 });
  }
}
