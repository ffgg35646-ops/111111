import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { getCaseById, practiceScales } from "@/lib/platform-catalog";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

const supervisorScoreKeys = [
  "communication",
  "activeListening",
  "evidenceReasoning",
  "assessmentSelection",
  "strengthsBasedPractice",
  "planningAndReferral",
  "professionalBoundaries",
] as const;

export async function GET(request: NextRequest) {
  const reviewer = await requirePlatformRole(request, ["admin", "supervisor"]);
  if (!reviewer) {
    return NextResponse.json({ error: "عرض تقارير المحاكاة متاح للمشرف أو إدارة المنصة فقط." }, { status: 403 });
  }

  try {
    const db = await getClinicalDatabase();
    const records = await db.collection("platform_learning_activities")
      .find({}, { projection: {
        _id: 0,
        activityId: 1,
        trainee: 1,
        caseId: 1,
        caseTitle: 1,
        score: 1,
        completedAt: 1,
        clinicalFormulation: 1,
        conversationTurns: 1,
        experienceMode: 1,
        vrHeadTrackingSamples: 1,
        vrHandMetrics: 1,
        supervisorReview: 1,
      } })
      .sort({ completedAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({ activities: records }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to load clinical simulation activities", error);
    return NextResponse.json({ error: "تعذر تحميل تقارير المحاكاة. تحقق من قاعدة البيانات." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const reviewer = await requirePlatformRole(request, ["admin", "supervisor"]);
  if (!reviewer) {
    return NextResponse.json({ error: "اعتماد تقييم المشرف متاح لإدارة المنصة فقط." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات مراجعة التقرير غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات مراجعة التقرير غير مكتملة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const activityId = typeof data.activityId === "string" ? data.activityId.trim().slice(0, 60) : "";
  const rawScores = data.scores;
  const feedbackNotes = typeof data.feedbackNotes === "string" ? data.feedbackNotes.trim().slice(0, 2000) : "";
  if (!/^[0-9a-f-]{36}$/i.test(activityId) || !rawScores || typeof rawScores !== "object" || Array.isArray(rawScores)) {
    return NextResponse.json({ error: "اختر تقريراً صحيحاً وأدخل درجات محاور المراجعة." }, { status: 400 });
  }

  const scoreInput = rawScores as Record<string, unknown>;
  const scores = Object.fromEntries(supervisorScoreKeys.map((key) => [key, Number(scoreInput[key])])) as Record<(typeof supervisorScoreKeys)[number], number>;
  const invalidScore = supervisorScoreKeys.some((key) => !Number.isInteger(scores[key]) || scores[key] < 0 || scores[key] > 5);
  if (invalidScore || feedbackNotes.length < 10) {
    return NextResponse.json({ error: "أدخل درجة صحيحة من 0 إلى 5 لكل محور، وملاحظة إشرافية لا تقل عن 10 أحرف." }, { status: 400 });
  }

  const overallScore = Number((supervisorScoreKeys.reduce((sum, key) => sum + scores[key], 0) / supervisorScoreKeys.length).toFixed(2));
  const reviewedAt = new Date();

  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("platform_learning_activities").updateOne(
      { activityId },
      {
        $set: {
          supervisorReview: {
            scores,
            overallScore,
            feedbackNotes,
            reviewedAt,
            reviewedBy: reviewer.userId,
          reviewerName: reviewer.name,
            rubricVersion: 1,
          },
          "clinicalFormulation.reviewStatus": "supervisor_reviewed",
        },
      },
    );
    if (result.matchedCount !== 1) {
      return NextResponse.json({ error: "لم يتم العثور على جلسة المحاكاة." }, { status: 404 });
    }
    await db.collection("platform_audit_logs").insertOne({
      action: "clinical_simulation_reviewed", actorUserId: reviewer.userId,
      actorName: reviewer.name, activityId, overallScore, createdAt: reviewedAt,
    }).catch((error) => console.warn("Unable to record simulation review audit event", error));
    return NextResponse.json({ success: true, activityId, overallScore, reviewedAt });
  } catch (error) {
    console.error("Unable to save supervisor review", error);
    return NextResponse.json({ error: "تعذر حفظ تقييم المشرف." }, { status: 503 });
  }
}

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
  "spatial_telemetry_consent",
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
      source: "clinical-simulation-client",
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
  const actor = await requirePlatformRole(request, ["admin", "supervisor", "trainer", "trainee"]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول إلى حسابك لحفظ نتيجة المحاكاة." }, { status: 401 });

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

  const rawFormulation = data.clinicalFormulation;
  if (!rawFormulation || typeof rawFormulation !== "object" || Array.isArray(rawFormulation)) {
    return NextResponse.json({ error: "أكمل دراسة الحالة واختيار المقياس التدريبي قبل حفظ الجلسة." }, { status: 400 });
  }
  const formulationInput = rawFormulation as Record<string, unknown>;
  const cleanFormulationText = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 1200) : "";
  const clinicalFormulation = {
    presentingConcern: cleanFormulationText(formulationInput.presentingConcern),
    historyAndContext: cleanFormulationText(formulationInput.historyAndContext),
    observations: cleanFormulationText(formulationInput.observations),
    strengths: cleanFormulationText(formulationInput.strengths),
    hypotheses: cleanFormulationText(formulationInput.hypotheses),
    missingInformation: cleanFormulationText(formulationInput.missingInformation),
    nextSteps: cleanFormulationText(formulationInput.nextSteps),
  };
  const formulationRequirements = [
    ["presentingConcern", 12],
    ["historyAndContext", 20],
    ["observations", 20],
    ["strengths", 12],
    ["hypotheses", 20],
    ["missingInformation", 12],
    ["nextSteps", 20],
  ] as const;
  const incompleteField = formulationRequirements.find(([key, minLength]) =>
    clinicalFormulation[key].length < minLength
  );
  const selectedScale = practiceScales.find((scale) => scale.id === formulationInput.selectedScaleId);
  if (incompleteField || !selectedScale) {
    return NextResponse.json({ error: "تأكد من استكمال وصف المشكلة والسياق والملاحظات ونقاط القوة والفرضيات والمعلومات الناقصة والخطوات التالية، واختر مقياساً تدريبياً." }, { status: 400 });
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
    trainee: { userId: actor.userId, name: actor.name, email: actor.email, role: actor.role },
    caseId: item.id,
    caseTitle: item.title,
    answers,
    clinicalFormulation: {
      ...clinicalFormulation,
      selectedScaleId: selectedScale.id,
      selectedScaleTitle: selectedScale.title,
      submittedAt: new Date(),
      reviewStatus: "awaiting_supervisor_review",
    },
    score: Math.round((earned / maximum) * 100),
    maximumScore: 100,
    roomEvents: normalisedRoomEvents,
    vrHeadTrackingSamples,
    vrHeadMetrics,
    vrHandMetrics,
    conversationTurns: normaliseConversationTurns(data.conversationTurns),
    avatarModelSource: data.avatarModelSource === "custom-glb"
      ? "custom-glb"
      : data.avatarModelSource === "library-avatar"
        ? "library-avatar"
        : "doctor-model-not-configured",
    experienceMode: data.experienceMode === "webxr-immersive-vr"
      ? "webxr-immersive-vr"
      : data.experienceMode === "browser-3d-room"
        ? "browser-3d-room"
        : "browser-simulation",
    completedAt: new Date(),
    learningOnly: true,
    version: 5,
  };

  try {
    const db = await getClinicalDatabase();
    const result = await db.collection("platform_learning_activities").insertOne(record);
    return NextResponse.json({
      success: true,
      activityId: record.activityId,
      score: record.score,
      documentation: {
        completedFields: formulationRequirements.length + 1,
        totalFields: formulationRequirements.length + 1,
        selectedScaleTitle: selectedScale.title,
        reviewStatus: "awaiting_supervisor_review",
      },
      roomEventCount: record.roomEvents.length,
      vrHeadTrackingSamples,
      vrHeadMetrics,
      vrHandMetrics,
      conversationTurnCount: record.conversationTurns.length,
      avatarModelSource: record.avatarModelSource,
      recordId: String(result.insertedId),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to save learning activity", error);
    return NextResponse.json({ error: "تعذر حفظ نتيجة التدريب." }, { status: 503 });
  }
}
