import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { verifyLiveKitVrDeviceToken } from "@/lib/livekit-auth";

export const runtime = "nodejs";

const allowedTypes = new Set([
  "posture_score",
  "gaze_score",
  "clinical_assessment_score",
  "safety_compliance_score",
  "communication_score",
  "active_listening_score",
  "empathy_score",
  "interaction_distance_cm",
  "procedure_step",
  "head_pose_sample",
  "head_direction_angle_degrees",
  "eye_gaze_sample",
  "eye_gaze_angle_degrees",
  "eye_gaze_confidence",
  "hand_tracking_sample",
  "hand_pinch_interaction",
]);

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || token.length > 12000) {
    return NextResponse.json({ error: "رمز جهاز VR غير موجود أو غير صالح." }, { status: 401 });
  }

  const verified = await verifyLiveKitVrDeviceToken(token).catch(() => null);
  if (!verified) {
    return NextResponse.json({ error: "رمز الجهاز منتهي أو لا يملك صلاحية إرسال بيانات VR." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "صيغة بيانات القياس غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات القياس غير صالحة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const roomName = cleanText(data.roomName, 120);
  if (!roomName || roomName !== verified.roomName) {
    return NextResponse.json({ error: "الغرفة لا تطابق الغرفة المصرح بها في رمز الجهاز." }, { status: 403 });
  }
  if (!Array.isArray(data.telemetry) || data.telemetry.length < 1 || data.telemetry.length > 50) {
    return NextResponse.json({ error: "أرسل من 1 إلى 50 حدث قياس في كل طلب." }, { status: 400 });
  }

  const receivedAt = new Date();
  const expireAt = new Date(receivedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const records = data.telemetry.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const type = cleanText(row.type, 60);
    if (!allowedTypes.has(type)) return [];
    const rawValue = row.value;
    const value = typeof rawValue === "number" && Number.isFinite(rawValue)
      ? rawValue
      : typeof rawValue === "boolean" || typeof rawValue === "string"
        ? (typeof rawValue === "string" ? rawValue.slice(0, 120) : rawValue)
        : null;
    const occurredAtMs = typeof row.occurredAt === "string" ? Date.parse(row.occurredAt) : Number.NaN;
    return [{
      roomName,
      event: {
        type,
        label: cleanText(row.label, 120),
        value,
        unit: cleanText(row.unit, 32),
        source: "unreal-openxr",
        occurredAt: Number.isFinite(occurredAtMs) ? new Date(occurredAtMs).toISOString() : receivedAt.toISOString(),
      },
      deviceIdentity: verified.identity,
      receivedAt,
      expireAt,
    }];
  });

  if (!records.length) {
    return NextResponse.json({ error: "لا توجد أحداث قياس مسموح بها في الطلب." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const collection = db.collection("clinical_vr_device_telemetry");
    await collection.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
    await collection.createIndex({ roomName: 1, reportId: 1, receivedAt: 1 });
    await collection.insertMany(records, { ordered: false });
    return NextResponse.json({ success: true, accepted: records.length }, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to persist native VR telemetry", error);
    return NextResponse.json({ error: "تعذر حفظ بيانات VR. تحقق من MongoDB." }, { status: 503 });
  }
}
