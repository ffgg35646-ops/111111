import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { readSupervisorSession } from "@/lib/supervision-session";
import { verifyLiveKitSupervisorToken } from "@/lib/livekit-auth";

export const runtime = "nodejs";

const competencyKeys = [
  "communication",
  "activeListening",
  "clinicalAssessment",
  "empathy",
  "nonverbalCommunication",
  "safetyAndProfessionalism",
] as const;

type CompetencyKey = (typeof competencyKeys)[number];

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normaliseTelemetry(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.slice(-300).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const type = cleanText(row.type, 60);
    if (!type) return [];
    const value = typeof row.value === "number" && Number.isFinite(row.value)
      ? row.value
      : typeof row.value === "string" || typeof row.value === "boolean"
        ? row.value
        : null;
    return [{
      type,
      label: cleanText(row.label, 120),
      value,
      unit: cleanText(row.unit, 32),
      source: cleanText(row.source, 40),
      occurredAt: typeof row.occurredAt === "string" ? row.occurredAt.slice(0, 40) : new Date().toISOString(),
    }];
  });
}

function buildVrEvidence(telemetry: ReturnType<typeof normaliseTelemetry>) {
  const rules = [
    { type: "posture_score", competency: "nonverbalCommunication", label: "استقامة الجذع ووضعية الجسم" },
    { type: "gaze_score", competency: "nonverbalCommunication", label: "التواصل البصري" },
    { type: "clinical_assessment_score", competency: "clinicalAssessment", label: "تنفيذ خطوات التقييم السريري" },
    { type: "safety_compliance_score", competency: "safetyAndProfessionalism", label: "الالتزام بإجراءات السلامة" },
    { type: "communication_score", competency: "communication", label: "مؤشر التواصل" },
    { type: "active_listening_score", competency: "activeListening", label: "مؤشر الإنصات" },
    { type: "empathy_score", competency: "empathy", label: "مؤشر التفاعل المتعاطف" },
  ] as const;

  return rules.flatMap((rule) => {
    const values = telemetry
      .filter((event) => event.type === rule.type && typeof event.value === "number" && event.value >= 0 && event.value <= 5)
      .map((event) => event.value as number);
    if (!values.length) return [];
    return [{
      type: rule.type,
      competency: rule.competency,
      label: rule.label,
      averageScore: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
      samples: values.length,
      scale: "0-5",
    }];
  });
}

export async function GET(request: NextRequest) {
  const supervisorId = await readSupervisorSession(request);
  if (!supervisorId) return NextResponse.json({ error: "انتهت جلسة المشرف. أنشئ غرفة جديدة للدخول إلى ملف الكفاءات." }, { status: 401 });

  const traineeCode = cleanText(request.nextUrl.searchParams.get("traineeCode"), 40).toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(traineeCode)) {
    return NextResponse.json({ error: "أدخل رمز متدرب صحيحاً." }, { status: 400 });
  }

  try {
    const db = await getClinicalDatabase();
    const reports = await db.collection("clinical_competency_reports")
      .find({ supervisorId, traineeCode })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return NextResponse.json({
      reports: reports.map((report) => ({
        id: String(report._id),
        reportId: report.reportId,
        traineeCode: report.traineeCode,
        traineeName: report.traineeName,
        scenarioTitle: report.scenarioTitle,
        overallScore: report.overallScore,
        scores: report.scores,
        feedbackNotes: report.feedbackNotes,
        telemetry: report.telemetry,
        vrEvidence: report.vrEvidence || [],
        createdAt: report.createdAt,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load competency reports", error);
    return NextResponse.json({ error: "تعذر قراءة ملف الكفاءات. تحقق من إعداد MongoDB." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const supervisorId = await readSupervisorSession(request);
  if (!supervisorId) return NextResponse.json({ error: "جلسة المشرف غير صالحة. أنشئ غرفة إشراف جديدة أولاً." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات التقرير غير صالحة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const liveKitToken = cleanText(data.liveKitToken, 12000);
  const traineeCode = cleanText(data.traineeCode, 40).toUpperCase();
  const traineeName = cleanText(data.traineeName, 80);
  const scenarioTitle = cleanText(data.scenarioTitle, 160);
  const feedbackNotes = cleanText(data.feedbackNotes, 3000);
  const scoresInput = data.scores as Record<string, unknown> | undefined;

  if (!liveKitToken || !/^[A-Z0-9_-]{3,40}$/.test(traineeCode) || !traineeName || !scenarioTitle) {
    return NextResponse.json({ error: "بيانات التقرير الأساسية غير مكتملة." }, { status: 400 });
  }

  const verified = await verifyLiveKitSupervisorToken(liveKitToken).catch(() => null);
  if (!verified) return NextResponse.json({ error: "التقرير متاح للمشرف الأكاديمي المصرح له فقط." }, { status: 403 });

  const scores = {} as Record<CompetencyKey, number>;
  for (const key of competencyKeys) {
    const score = Number(scoresInput?.[key]);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return NextResponse.json({ error: "يجب تقييم جميع الكفاءات بدرجة من 1 إلى 5." }, { status: 400 });
    }
    scores[key] = score;
  }

  const telemetry = normaliseTelemetry(data.telemetry);
  const vrEvidence = buildVrEvidence(telemetry);
  const overallScore = Number((competencyKeys.reduce((sum, key) => sum + scores[key], 0) / competencyKeys.length).toFixed(2));
  const report = {
    reportId: randomUUID(),
    supervisorId,
    roomName: verified.roomName,
    supervisorIdentity: verified.identity,
    traineeCode,
    traineeName,
    scenarioTitle,
    scores,
    overallScore,
    feedbackNotes,
    telemetry,
    telemetryCount: telemetry.length,
    vrEvidence,
    createdAt: new Date(),
    version: 1,
  };

  try {
    const db = await getClinicalDatabase();
    const collection = db.collection("clinical_competency_reports");
    await collection.createIndex({ supervisorId: 1, traineeCode: 1, createdAt: -1 });
    const result = await collection.insertOne(report);
    return NextResponse.json({
      success: true,
      reportId: report.reportId,
      documentId: String(result.insertedId),
      overallScore,
      telemetryCount: report.telemetryCount,
      vrEvidence: report.vrEvidence,
      createdAt: report.createdAt.toISOString(),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save competency report", error);
    return NextResponse.json({ error: "تعذر حفظ التقرير. تحقق من إعداد MONGODB_URI." }, { status: 503 });
  }
}
