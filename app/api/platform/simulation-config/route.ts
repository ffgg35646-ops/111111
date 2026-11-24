import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { learningTracks, type TrainingCase } from "@/lib/platform-catalog";
import { DEFAULT_SIMULATION_RUBRIC, type SimulationRubric, type SimulationRubricCriterion } from "@/lib/simulation-rubrics";
import { requirePlatformRole } from "@/lib/platform-auth";

export const runtime = "nodejs";

const managers = ["admin", "platform_manager", "supervisor", "trainer"] as const;
const readers = ["admin", "platform_manager", "supervisor", "trainer", "trainee", "consultant"] as const;

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanList(value: unknown, maxItems: number, maxText: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => cleanText(item, maxText)).filter(Boolean);
}

function normaliseSteps(raw: unknown): TrainingCase["steps"] {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 12) {
    throw new Error("يجب أن يحتوي السيناريو على 3 إلى 12 مرحلة تدريبية.");
  }
  const ids = new Set<string>();
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("إحدى مراحل السيناريو غير صالحة.");
    const row = entry as Record<string, unknown>;
    const id = cleanText(row.id, 70) || "step-" + (index + 1);
    const title = cleanText(row.title, 120);
    const focus = cleanText(row.focus, 120);
    const prompt = cleanText(row.prompt, 700);
    if (!/^[A-Za-z0-9_-]{2,70}$/.test(id) || ids.has(id) || !title || !focus || !prompt) {
      throw new Error("تحقق من معرف كل مرحلة وعنوانها ومحورها وسؤالها.");
    }
    ids.add(id);
    if (!Array.isArray(row.choices) || row.choices.length < 2 || row.choices.length > 5) {
      throw new Error("يجب توفير اختيارين إلى خمسة اختيارات لكل مرحلة.");
    }
    const choiceIds = new Set<string>();
    const choices = row.choices.map((choice, choiceIndex) => {
      if (!choice || typeof choice !== "object" || Array.isArray(choice)) throw new Error("أحد اختيارات السيناريو غير صالح.");
      const option = choice as Record<string, unknown>;
      const choiceId = cleanText(option.id, 70) || "choice-" + (choiceIndex + 1);
      const label = cleanText(option.label, 500);
      const score = Number(option.score);
      const feedback = cleanText(option.feedback, 700);
      if (!/^[A-Za-z0-9_-]{2,70}$/.test(choiceId) || choiceIds.has(choiceId) || !label || !Number.isInteger(score) || score < 0 || score > 20 || !feedback) {
        throw new Error("تحقق من نص كل اختيار ودرجته من صفر إلى 20 والتغذية الراجعة.");
      }
      choiceIds.add(choiceId);
      return { id: choiceId, label, score, feedback };
    });
    return { id, title, focus, prompt, choices };
  });
}

function normaliseScenario(data: Record<string, unknown>, existing?: Record<string, unknown>) {
  const title = cleanText(data.title, 140);
  const track = cleanText(data.track, 120);
  const ageGroup = cleanText(data.ageGroup, 80);
  const setting = cleanText(data.setting, 120);
  const briefing = cleanText(data.briefing, 5000);
  const safetyNote = cleanText(data.safetyNote, 1200);
  const learningGoals = cleanList(data.learningGoals, 8, 180);
  if (!title || !track || !ageGroup || !setting || briefing.length < 30 || safetyNote.length < 10 || learningGoals.length < 2) {
    throw new Error("أكمل عنوان الحالة والمسار والفئة وبيئة الحالة وملخصاً واضحاً وملاحظات السلامة وهدفين تعليميين على الأقل.");
  }
  const avatarModelUrl = cleanText(data.avatarModelUrl, 600);
  if (avatarModelUrl && !(avatarModelUrl.startsWith("/") && !avatarModelUrl.startsWith("//") || /^https:\/\//i.test(avatarModelUrl))) {
    throw new Error("رابط الشخصية يجب أن يكون مساراً داخلياً يبدأ بـ / أو رابط HTTPS.");
  }
  const now = new Date();
  const scenarioId = cleanText(data.scenarioId, 80) || randomUUID();
  const version = Number(existing?.version || 0) + 1;
  return {
    scenarioId,
    id: scenarioId,
    title,
    track,
    ageGroup,
    setting,
    briefing,
    learningGoals,
    safetyNote,
    steps: normaliseSteps(data.steps),
    personaInstructions: cleanText(data.personaInstructions, 5000),
    hiddenContext: cleanText(data.hiddenContext, 6000),
    avatarModelUrl,
    avatarLabel: cleanText(data.avatarLabel, 120),
    status: data.isActive === false ? "inactive" : "active",
    version,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || cleanText(data.createdBy, 100),
    updatedBy: cleanText(data.actorId, 100),
  };
}

function normaliseRubric(data: Record<string, unknown>, existing?: Record<string, unknown>): SimulationRubric {
  const title = cleanText(data.title, 140);
  const trackId = cleanText(data.trackId, 80) || "all";
  const description = cleanText(data.description, 600);
  if (!title || !learningTracks.some((track) => track.id === trackId) && trackId !== "all") {
    throw new Error("أدخل اسم المعيار واختر مساراً صالحاً أو جميع المسارات.");
  }
  if (!Array.isArray(data.criteria) || data.criteria.length < 3 || data.criteria.length > 12) {
    throw new Error("يجب أن يحتوي معيار التقييم على 3 إلى 12 محوراً.");
  }
  const keys = new Set<string>();
  const criteria: SimulationRubricCriterion[] = data.criteria.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("أحد محاور التقييم غير صالح.");
    const row = entry as Record<string, unknown>;
    const key = cleanText(row.key, 40) || "criterion_" + (index + 1);
    const label = cleanText(row.label, 140);
    const criterionDescription = cleanText(row.description, 500);
    const weight = Number(row.weight);
    const maxScore = Number(row.maxScore || 5);
    if (!/^[A-Za-z][A-Za-z0-9_-]{1,39}$/.test(key) || keys.has(key) || !label || !Number.isInteger(weight) || weight < 1 || weight > 100 || maxScore !== 5) {
      throw new Error("تحقق من أسماء المحاور وأوزانها، ويجب أن تكون الدرجة القصوى لكل محور 5.");
    }
    keys.add(key);
    return { key, label, description: criterionDescription, weight, maxScore: 5 };
  });
  if (criteria.reduce((sum, criterion) => sum + criterion.weight, 0) !== 100) {
    throw new Error("يجب أن يكون مجموع أوزان محاور المعيار 100٪ بالضبط.");
  }
  const now = new Date();
  const rubricId = cleanText(data.rubricId, 80) || randomUUID();
  return {
    rubricId,
    title,
    trackId,
    description,
    criteria,
    status: data.isActive === false ? "inactive" : "active",
    version: Number(existing?.version || 0) + 1,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export async function GET(request: NextRequest) {
  const manage = request.nextUrl.searchParams.get("manage") === "1";
  const actor = await requirePlatformRole(request, [...(manage ? managers : readers)]);
  if (!actor) return NextResponse.json({ error: "سجّل الدخول بحساب مخوّل للوصول إلى إعدادات المحاكاة." }, { status: 401 });

  try {
    const db = await getClinicalDatabase();
    const scenarioFilter = manage ? {} : { status: "active" };
    const rubricFilter = manage ? {} : { status: "active" };
    const [scenarios, customRubrics] = await Promise.all([
      db.collection("platform_simulation_scenarios")
        .find(scenarioFilter, { projection: { _id: 0, createdBy: 0, updatedBy: 0, ...(manage ? {} : { hiddenContext: 0, personaInstructions: 0 }) } })
        .sort({ updatedAt: -1 })
        .limit(200)
        .toArray(),
      db.collection("platform_simulation_rubrics")
        .find(rubricFilter, { projection: { _id: 0 } })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray(),
    ]);
    const rubricList = [DEFAULT_SIMULATION_RUBRIC, ...customRubrics] as SimulationRubric[];
    return NextResponse.json({
      scenarios,
      rubrics: rubricList,
      defaultRubricId: DEFAULT_SIMULATION_RUBRIC.rubricId,
      canManage: manage && managers.includes(actor.role as (typeof managers)[number]),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load simulation configuration", error);
    return NextResponse.json({ error: "تعذر تحميل سيناريوهات ومعايير المحاكاة من قاعدة البيانات." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...managers]);
  if (!actor) return NextResponse.json({ error: "يلزم حساب مدرب أو مشرف مخوّل لإدارة سيناريوهات ومعايير المحاكاة." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "صيغة البيانات غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات الإعداد غير مكتملة." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const kind = data.kind === "rubric" ? "rubric" : data.kind === "scenario" ? "scenario" : null;
  if (!kind) return NextResponse.json({ error: "نوع الإعداد غير معروف." }, { status: 400 });

  try {
    const db = await getClinicalDatabase();
    if (kind === "scenario") {
      const scenarioId = cleanText(data.scenarioId, 80);
      const existing = scenarioId
        ? await db.collection("platform_simulation_scenarios").findOne({ scenarioId })
        : null;
      const scenario = normaliseScenario({ ...data, actorId: actor.userId }, existing as Record<string, unknown> | null ?? undefined);
      await db.collection("platform_simulation_scenarios").updateOne(
        { scenarioId: scenario.scenarioId },
        { $set: scenario },
        { upsert: true },
      );
      return NextResponse.json({ success: true, kind, scenario }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    const rubricId = cleanText(data.rubricId, 80);
    if (rubricId === DEFAULT_SIMULATION_RUBRIC.rubricId) {
      return NextResponse.json({ error: "المعيار الأساسي محفوظ كمرجع. أنشئ نسخة مخصصة لتعديل المحاور." }, { status: 400 });
    }
    const existing = rubricId ? await db.collection("platform_simulation_rubrics").findOne({ rubricId }) : null;
    const rubric = normaliseRubric(data, existing as Record<string, unknown> | null ?? undefined);
    await db.collection("platform_simulation_rubrics").updateOne(
      { rubricId: rubric.rubricId },
      { $set: rubric },
      { upsert: true },
    );
    return NextResponse.json({ success: true, kind, rubric }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ إعداد المحاكاة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
