import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { getCaseById } from "@/lib/platform-catalog";

export const runtime = "nodejs";

const allowedRoomEventTypes = new Set([
  "room_entered",
  "patient_selected",
  "case_file_opened",
  "assessment_choice_selected",
  "step_changed",
  "assessment_completed",
  "assessment_restarted",
  "conversation_turn_started",
  "conversation_reply_received",
  "microphone_started",
  "avatar_model_loaded",
  "head_pose_sample",
  "hand_tracking_sample",
  "hand_pinch_interaction",
  "realtime_voice_connecting",
  "realtime_voice_connected",
  "realtime_voice_ended",
  "realtime_voice_failed",
  "realtime_microphone_toggled",
  "realtime_user_transcript",
  "realtime_assistant_transcript",
]);

function normaliseRoomEvents(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.slice(-120).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const type = typeof row.type === "string" ? row.type.slice(0, 60) : "";
    const label = typeof row.label === "string" ? row.label.trim().slice(0, 160) : "";
    if (!allowedRoomEventTypes.has(type) || !label) return [];
    const timestamp = typeof row.occurredAt === "string" ? Date.parse(row.occurredAt) : Number.NaN;
    return [{
      type,
      label,
      occurredAt: Number.isFinite(timestamp) ? new Date(timestamp) : new Date(),
      source: "webxr-room-interaction",
    }];
  });
}

function normaliseConversationTurns(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.slice(-40).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const role = row.role === "user" || row.role === "assistant" ? row.role : null;
    const text = typeof row.content === "string" ? row.content.trim().slice(0, 1800) : "";
    return role && text ? [{ role, content: text }] : [];
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات النشاط غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات النشاط غير مكتملة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const caseId = typeof data.caseId === "string" ? data.caseId.slice(0, 80) : "";
  const item = getCaseById(caseId);
  if (item.id !== caseId) return NextResponse.json({ error: "الحالة التدريبية غير موجودة." }, { status: 404 });

  const answers = Array.isArray(data.answers) ? data.answers.slice(0, 20).flatMap((answer) => {
    if (!answer || typeof answer !== "object") return [];
    const row = answer as Record<string, unknown>;
    const stepId = typeof row.stepId === "string" ? row.stepId.slice(0, 80) : "";
    const choiceId = typeof row.choiceId === "string" ? row.choiceId.slice(0, 80) : "";
    const step = item.steps.find((candidate) => candidate.id === stepId);
    const choice = step?.choices.find((candidate) => candidate.id === choiceId);
    return step && choice ? [{ stepId, choiceId, earned: choice.score, max: 20 }] : [];
  }) : [];

  const answeredStepIds = new Set(answers.map((answer) => answer.stepId));
  if (
    answers.length !== item.steps.length ||
    answeredStepIds.size !== item.steps.length ||
    item.steps.some((step) => !answeredStepIds.has(step.id))
  ) {
    return NextResponse.json({ error: "لم تكتمل جميع خطوات الحالة التدريبية بصورة صحيحة." }, { status: 400 });
  }

  const earned = answers.reduce((sum, answer) => sum + answer.earned, 0);
  const maximum = item.steps.length * 20;
  const normalisedRoomEvents = normaliseRoomEvents(data.roomEvents);
  const headPoseMeasurements = normalisedRoomEvents.flatMap((event) => {
    if (event.type !== "head_pose_sample") return [];
    const angleMatch = event.label.match(/زاوية اتجاه الرأس نحو موضع الحالة:\s*([0-9]+(?:\.[0-9]+)?)\s*درجة/);
    const distanceMatch = event.label.match(/المسافة التقريبية:\s*([0-9]+(?:\.[0-9]+)?)\s*سم/);
    if (!angleMatch || !distanceMatch) return [];
    const angle = Number(angleMatch[1]);
    const distance = Number(distanceMatch[1]);
    return Number.isFinite(angle) && Number.isFinite(distance) && angle >= 0 && angle <= 180 && distance >= 0 && distance <= 1000
      ? [{ angle, distance }]
      : [];
  });
  const vrHeadTrackingSamples = headPoseMeasurements.length;
  const vrHeadMetrics = vrHeadTrackingSamples
    ? {
        averageHeadAngleDegrees: Math.round((headPoseMeasurements.reduce((sum, item) => sum + item.angle, 0) / vrHeadTrackingSamples) * 10) / 10,
        averageDistanceCm: Math.round(headPoseMeasurements.reduce((sum, item) => sum + item.distance, 0) / vrHeadTrackingSamples),
        orientedWithin30DegreesPercent: Math.round((headPoseMeasurements.filter((item) => item.angle <= 30).length / vrHeadTrackingSamples) * 100),
      }
    : null;
  const handTrackingEvents = normalisedRoomEvents.filter((event) => event.type === "hand_tracking_sample");
  const handPinchInteractions = normalisedRoomEvents.filter((event) => event.type === "hand_pinch_interaction");
  const observedHands = new Set(
    handTrackingEvents.flatMap((event) => ["left", "right"].filter((hand) => event.label.includes(hand + ":"))),
  );
  const vrHandMetrics = {
    samples: handTrackingEvents.length,
    pinchInteractions: handPinchInteractions.length,
    handsObserved: Array.from(observedHands),
  };
  const record = {
    activityId: randomUUID(),
    caseId: item.id,
    caseTitle: item.title,
    answers,
    score: Math.round((earned / maximum) * 100),
    maximumScore: 100,
    roomEvents: normalisedRoomEvents,
    vrHeadTrackingSamples,
    vrHeadMetrics,
    conversationTurns: normaliseConversationTurns(data.conversationTurns),
    avatarModelSource: data.avatarModelSource === "custom-glb"
      ? "custom-glb"
      : data.avatarModelSource === "library-avatar"
        ? "library-avatar"
        : "age-appropriate-model-required",
    experienceMode: data.experienceMode === "webxr-immersive-vr"
      ? "webxr-immersive-vr"
      : data.experienceMode === "browser-3d-room"
        ? "browser-3d-room"
        : "browser-simulation",
    completedAt: new Date(),
    learningOnly: true,
    version: 3,
  };

  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("platform_learning_activities").insertOne(record);
    return NextResponse.json({
      success: true,
      activityId: record.activityId,
      score: record.score,
      roomEventCount: record.roomEvents.length,
      vrHeadTrackingSamples,
      vrHeadMetrics,
      conversationTurnCount: record.conversationTurns.length,
      avatarModelSource: record.avatarModelSource,
      recordId: String(result.insertedId),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save learning activity", error);
    return NextResponse.json({ error: "تعذر حفظ نتيجة التدريب." }, { status: 503 });
  }
}
