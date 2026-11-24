import { NextRequest, NextResponse } from "next/server";
import { requirePlatformRole } from "@/lib/platform-auth";
import { getClinicalDatabase } from "@/lib/mongodb";
import { recordPlatformAiUsage } from "@/lib/platform-ai";

export const runtime = "nodejs";
export const maxDuration = 20;

const rateLimitWindowMs = 10 * 60 * 1000;
const rateLimitMaximum = 4;
const sessionRequests = new Map<string, { count: number; resetAt: number }>();

const DOCTOR_IDENTITY = [
  "أنت الطبيب النفسي الافتراضي السعودي في منصة تدريب وتعليم مهني.",
  "أنت رجل سعودي بالغ بهوية ثابتة وصوت مهني هادئ، وتتحدث بلهجة سعودية بيضاء طبيعية وواضحة.",
  "دورك طبيب افتراضي تعليمي ومدرب سريري: تشرح للمتدرب، توجهه في المقابلة، وتساعده على دراسة الحالة وفهم المقاييس والتفكير التشخيصي المسؤول.",
  "لا تتقمص دور المريض أو الأب أو الأم أو الطفل أو المراهق؛ أنت الطبيب المشرف في كل السيناريوهات.",
].join("\n");

export async function POST(request: NextRequest) {
  const actor = await requirePlatformRole(request, ["admin", "platform_manager", "supervisor", "trainer", "trainee", "consultant"]);
  if (!actor) {
    return NextResponse.json({ error: "سجّل الدخول إلى حسابك قبل تشغيل الاتصال الصوتي الحي." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "الصوت الحي غير مهيأ. أضف OPENAI_API_KEY إلى متغيرات بيئة الخادم." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "مصدر الطلب غير مسموح." }, { status: 403 });
  }

  const clientAddress = request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const now = Date.now();
  const currentLimit = sessionRequests.get(clientAddress);
  if (!currentLimit || currentLimit.resetAt <= now) {
    sessionRequests.set(clientAddress, { count: 1, resetAt: now + rateLimitWindowMs });
  } else if (currentLimit.count >= rateLimitMaximum) {
    return NextResponse.json(
      { error: "تم تجاوز عدد محاولات الاتصال الصوتي. انتظر قليلاً ثم حاول مرة أخرى." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil((currentLimit.resetAt - now) / 1000)) } },
    );
  } else {
    currentLimit.count += 1;
  }
  if (sessionRequests.size > 1000) {
    for (const [address, entry] of sessionRequests) {
      if (entry.resetAt <= now) sessionRequests.delete(address);
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات جلسة الصوت غير صالحة." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "بيانات جلسة الصوت غير صالحة." }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const scenario = typeof data.scenario === "string" ? data.scenario.trim().slice(0, 5000) : "";
  const caseId = typeof data.caseId === "string" ? data.caseId.trim().slice(0, 80) : "";
  const mode = data.mode === "client" ? "client" : "supervisor";
  let privateScenarioContext = "";
  if (caseId) {
    try {
      const db = await getClinicalDatabase();
      const custom = await db.collection("platform_simulation_scenarios").findOne({ scenarioId: caseId, status: "active" });
      if (custom) privateScenarioContext = [
        typeof custom.personaInstructions === "string" ? "تعليمات الشخصية الخاصة: " + custom.personaInstructions : "",
        typeof custom.hiddenContext === "string" ? "السياق المخفي الذي يجب كشفه تدريجياً فقط عند السؤال المناسب: " + custom.hiddenContext : "",
      ].filter(Boolean).join("\n");
    } catch (error) {
      console.error("Unable to load private realtime scenario context", error);
      return NextResponse.json({ error: "تعذر تحميل تفاصيل الحالة المحمية. أعد المحاولة." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }
  const persona = mode === "client" ? "أنت شخصية مراجع افتراضي في محاكاة تعليمية مهنية بمنصة اتزان. تقمص الدور المحدد في وصف الحالة فقط، وتحدث بضمير المتكلم وبلهجة سعودية طبيعية. لا تدّع أنك إنسان حقيقي." : DOCTOR_IDENTITY;
  const instructions = [
    persona,
    "سياق الحالة والمادة التعليمية المتاحة من المنصة:",
    scenario || "لا توجد تفاصيل إضافية للحالة. ابدأ بسؤال المتدرب عن هدف التدريب ولا تخترع حالة.",
    privateScenarioContext,
    "قواعد الصوت والتدريب:",
    "- تحدث بالعربية بلهجة سعودية بيضاء مهنية، وبإيقاع هادئ وواضح. خاطب المتدرب مباشرة. ابدأ بتحية قصيرة عند بدء الاتصال، ثم تحاور بشكل طبيعي ولا تلقِ محاضرة طويلة دفعة واحدة.",
    "- حافظ على إيقاع محادثة وجهاً لوجه: استمع حتى ينتهي المتدرب، أجب بوضوح، واستخدم أسئلة متابعة قصيرة ومحددة، وتجنب تكرار عبارات الترحيب.",
    "- استخدم نبرة بشرية دافئة ومتزنة، مع تعاطف مهني دون ادعاء أنك إنسان حقيقي أو أنك ترى المتدرب.",
    mode === "client" ? "- التزم بدور المراجع أو ولي الأمر في السيناريو. لا تكشف معلومات الحالة المخفية دفعة واحدة؛ شاركها تدريجياً عندما يسأل المتدرب أسئلة مناسبة. لا تقيم المتدرب ولا تقدم نصائح علاجية أثناء الدور." : "- علّم مهارات المقابلة ودراسة الحالة والتفكير الإكلينيكي وفهم المقاييس، ولا تمثل شخصية المريض.",
    "- استند إلى المادة المرفقة فقط عند وصف محتوى المنصة؛ لا تدّع أنك فتحت أو بحثت في ملفات غير مرفقة.",
    "- ميّز بين الدليل والملاحظة والفرضية، واذكر حدود المعلومات عند الحاجة.",
    "- لا تخترع أعراضاً أو تاريخاً أو نتائج مقاييس أو مراجع.",
    "- لا تصدر تشخيصاً رسمياً أو وصفة دوائية، ولا تدّع تقديم علاج فعلي. هذا تدريب تعليمي افتراضي.",
    "- عند ظهور خطر حاد أو حديث عن إيذاء النفس أو الآخرين، أوقف التدريب واطلب تدخّل المشرف البشري فوراً.",
    "- لا تدّع أنك ترى المتدرب أو تقيس عينيه أو مشاعره.",
  ].join("\n");

  try {
    const voice = process.env.CLINICAL_REALTIME_VOICE || "cedar";
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 600 },
        session: {
          type: "realtime",
          model: process.env.CLINICAL_REALTIME_MODEL || "gpt-realtime-2.1",
          instructions,
          audio: {
            input: {
              noise_reduction: { type: "near_field" },
              transcription: { model: "gpt-4o-mini-transcribe", language: "ar" },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 650,
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice },
          },
        },
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => ({})) as {
      value?: string;
      expires_at?: number;
      session?: { id?: string; model?: string };
      error?: { message?: string };
    };
    if (!response.ok || !payload.value) {
      console.error("Realtime client secret creation failed", response.status, payload.error?.message || "Unknown provider error");
      return NextResponse.json(
        { error: "تعذر تهيئة الاتصال الصوتي الحي. تحقق من صلاحية مفتاح OpenAI وإتاحة نموذج Realtime." },
        { status: response.status >= 400 && response.status < 500 ? 502 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const realtimeModel = payload.session?.model ?? process.env.CLINICAL_REALTIME_MODEL ?? "gpt-realtime-2.1";
    await recordPlatformAiUsage({
      feature: "realtime_voice_session", provider: "openai-realtime",
      actorUserId: actor.userId, actorRole: actor.role, model: realtimeModel,
      eventStatus: "session_created",
      note: "تم تسجيل بدء الجلسة فقط؛ تكلفة الصوت الفعلية غير متاحة من استجابة إنشاء الجلسة.",
      referenceId: payload.session?.id,
    });
    return NextResponse.json({
      value: payload.value,
      expires_at: payload.expires_at ?? null,
      session: { id: payload.session?.id ?? null, model: realtimeModel },
    }, { headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
  } catch (error) {
    console.error("Realtime client secret request failed", error);
    return NextResponse.json(
      { error: "تعذر الاتصال بخدمة الصوت الحي حالياً." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
