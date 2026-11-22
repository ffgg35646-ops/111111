"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Mic,
  MicOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  Printer,
} from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import { RealtimeClinicalVoice } from "@/components/realtime-clinical-voice";
import { getCaseById, practiceScales, trainingCases } from "@/lib/platform-catalog";
import "./simulation.css";

const ClinicalRoomStage = dynamic(() => import("@/components/clinical-room-stage"), {
  ssr: false,
  loading: () => <div className="simulation-stage-loading">جارٍ تجهيز القاعة والشخصية الافتراضية...</div>,
});

const AVATAR_MODEL_URLS = {
  father: "https://memoriesrohit.github.io/avatar-studio/models/daniel_formal.glb",
  mother: "https://memoriesrohit.github.io/avatar-studio/models/aisha_formal.glb",
} as const;

type ClinicalFormulation = {
  presentingConcern: string;
  historyAndContext: string;
  observations: string;
  strengths: string;
  hypotheses: string;
  missingInformation: string;
  nextSteps: string;
  selectedScaleId: string;
};

const EMPTY_CLINICAL_FORMULATION: ClinicalFormulation = {
  presentingConcern: "",
  historyAndContext: "",
  observations: "",
  strengths: "",
  hypotheses: "",
  missingInformation: "",
  nextSteps: "",
  selectedScaleId: "",
};

const FORMULATION_REQUIREMENTS = [
  { key: "presentingConcern", minLength: 12 },
  { key: "historyAndContext", minLength: 20 },
  { key: "observations", minLength: 20 },
  { key: "strengths", minLength: 12 },
  { key: "hypotheses", minLength: 20 },
  { key: "missingInformation", minLength: 12 },
  { key: "nextSteps", minLength: 20 },
] as const;

type PersonaId = "father" | "mother" | "child" | "teen";
type ConversationTurn = { role: "user" | "assistant"; content: string };
type RoomEvent = { type: string; label: string; occurredAt: string };
type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative };
type RecognitionEvent = Event & { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = Event & { error: string };
type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => RecognitionInstance;
  webkitSpeechRecognition?: new () => RecognitionInstance;
};

function SimulationWorkspace() {
  const params = useSearchParams();
  const [caseId, setCaseId] = useState(() => {
    const requested = params.get("case");
    return requested && trainingCases.some((item) => item.id === requested)
      ? requested
      : trainingCases[0].id;
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("الشخصية الافتراضية");
  const [completed, setCompleted] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [savedActivityId, setSavedActivityId] = useState<string | null>(null);
  const [clinicalFormulation, setClinicalFormulation] = useState<ClinicalFormulation>(() => ({ ...EMPTY_CLINICAL_FORMULATION }));
  const [vrHeadTrackingSamples, setVrHeadTrackingSamples] = useState(0);
  const [vrHeadMetrics, setVrHeadMetrics] = useState<{ averageHeadAngleDegrees: number | null; averageDistanceCm: number | null; orientedWithin30DegreesPercent: number | null } | null>(null);
  const [vrHandMetrics, setVrHandMetrics] = useState<{ samples: number; pinchInteractions: number; handsObserved: string[] } | null>(null);
  const [spatialTelemetryConsent, setSpatialTelemetryConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [roomEvents, setRoomEvents] = useState<RoomEvent[]>([]);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [voiceInput, setVoiceInput] = useState("");
  const [listening, setListening] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [uploadedAvatarName, setUploadedAvatarName] = useState("");
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [realtimeMuted, setRealtimeMuted] = useState(false);

  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const shouldSendSpeechRef = useRef(false);
  const speechBufferRef = useRef("");
  const conversationRef = useRef<ConversationTurn[]>([]);
  const busyRef = useRef(false);
  const aborterRef = useRef<AbortController | null>(null);
  const uploadedAvatarObjectUrlRef = useRef<string | null>(null);
  const realtimeControlsRef = useRef<{ start: () => void; stop: () => void; toggleMute: () => void } | null>(null);
  const registerRealtimeControls = useCallback((controls: { start: () => void; stop: () => void; toggleMute: () => void } | null) => {
    realtimeControlsRef.current = controls;
  }, []);

  const activeCase = useMemo(() => getCaseById(caseId), [caseId]);
  const activeStep = activeCase.steps[stepIndex];
  const voicePersona: PersonaId = activeCase.ageGroup === "طفل"
    ? "child"
    : activeCase.ageGroup === "مراهق"
      ? "teen"
      : activeCase.track === "الخدمة الاجتماعية"
        ? "mother"
        : "father";

  const voiceScenario = useMemo(() => [
    "العنوان: " + activeCase.title,
    "نوع الحالة: " + activeCase.track,
    "العمر/الفئة: " + activeCase.ageGroup,
    "مكان المقابلة: " + activeCase.setting,
    "ملخص الحالة: " + activeCase.briefing,
    "أهداف التدريب: " + activeCase.learningGoals.join("، "),
    "تعليمات الشخصية: أجب من منظور الشخصية فقط وبما يتناسب مع المعلومات الواردة في ملف الحالة. لا تكشف كل التفاصيل دفعة واحدة. لا تخترع معلومات طبية أو اجتماعية غير مذكورة. لا تقدم تشخيصاً أو علاجاً.",
  ].join("\n"), [activeCase]);

  const defaultAvatarModelUrl = voicePersona === "father"
    ? AVATAR_MODEL_URLS.father
    : voicePersona === "mother"
      ? AVATAR_MODEL_URLS.mother
      : null;
  const avatarModelUrl = uploadedAvatarUrl ?? defaultAvatarModelUrl;
  const avatarModelLabel = uploadedAvatarName
    || (voicePersona === "father" ? "شخصية رجل واقعية مرخصة" : voicePersona === "mother" ? "شخصية امرأة واقعية مرخصة" : "يتطلب موديل مناسباً للعمر");
  const answeredCount = activeCase.steps.filter((step) => Boolean(answers[step.id])).length;
  const selectedPracticeScale = practiceScales.find((scale) => scale.id === clinicalFormulation.selectedScaleId);
  const completedFormulationFields = FORMULATION_REQUIREMENTS.filter(({ key, minLength }) =>
    clinicalFormulation[key].trim().length >= minLength
  ).length + (selectedPracticeScale ? 1 : 0);
  const formulationComplete = completedFormulationFields === FORMULATION_REQUIREMENTS.length + 1;
  const latestUserText = [...conversation].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const latestAssistantText = [...conversation].reverse().find((turn) => turn.role === "assistant")?.content ?? "";
  const voiceStatus = realtimeStatus === "live"
    ? "اتصال صوتي حي ثنائي الاتجاه"
    : realtimeStatus === "connecting"
      ? "جارٍ إنشاء الاتصال الصوتي الحي"
      : listening
        ? "الميكروفون يستمع إليك الآن"
        : agentBusy
          ? "الشخصية تفهم كلامك وتجهز الرد"
          : avatarSpeaking
            ? "الشخصية تتحدث إليك الآن"
            : "الشخصية جاهزة للمقابلة";
  const realtimeActive = realtimeStatus === "live" || realtimeStatus === "connecting";

  useEffect(() => () => {
    recognitionRef.current?.abort();
    aborterRef.current?.abort();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    if (uploadedAvatarObjectUrlRef.current) {
      URL.revokeObjectURL(uploadedAvatarObjectUrlRef.current);
      uploadedAvatarObjectUrlRef.current = null;
    }
  }, []);

  const recordRoomEvent = (type: string, label: string) => {
    setRoomEvents((current) => [
      ...current,
      { type, label: label.slice(0, 160), occurredAt: new Date().toISOString() },
    ].slice(-120));
  };

  const stopAvatarSpeech = () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setAvatarSpeaking(false);
  };

  const speakResponse = (text: string) => {
    if (!audioEnabled) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceError("الصوت المنطوق غير مدعوم في هذا المتصفح. يمكنك متابعة رد الشخصية نصياً.");
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.94;
    utterance.pitch = 1;
    const voices = synth.getVoices();
    const arabicVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith("ar-sa"))
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("ar"));
    if (arabicVoice) utterance.voice = arabicVoice;
    utterance.onstart = () => setAvatarSpeaking(true);
    utterance.onend = () => setAvatarSpeaking(false);
    utterance.onerror = () => setAvatarSpeaking(false);
    synth.speak(utterance);
  };

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim().slice(0, 1800);
    if (!text || busyRef.current) return;

    shouldSendSpeechRef.current = false;
    busyRef.current = true;
    setAgentBusy(true);
    setVoiceError("");
    setVoiceInput("");
    speechBufferRef.current = "";
    stopAvatarSpeech();

    const nextMessages = [...conversationRef.current, { role: "user" as const, content: text }].slice(-20);
    conversationRef.current = nextMessages;
    setConversation(nextMessages);
    const assistantPlaceholder: ConversationTurn = { role: "assistant", content: "" };
    conversationRef.current = [...nextMessages, assistantPlaceholder].slice(-20);
    setConversation(conversationRef.current);
    recordRoomEvent("conversation_turn_started", "أرسل المتدرب سؤالاً صوتياً أو نصياً إلى الشخصية الافتراضية.");

    const controller = new AbortController();
    aborterRef.current = controller;
    try {
      const response = await fetch("/api/clinical-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: voicePersona,
          scenario: voiceScenario,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "تعذر الاتصال بالشخصية الافتراضية.");
      }
      if (!response.body) throw new Error("لم يصل رد من خدمة المحادثة.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        const updated = [...nextMessages, { role: "assistant" as const, content: answer }].slice(-20);
        conversationRef.current = updated;
        setConversation(updated);
      }
      answer += decoder.decode();
      if (!answer.trim()) throw new Error("وصل رد فارغ من الشخصية الافتراضية.");

      const finalMessages = [...nextMessages, { role: "assistant" as const, content: answer }].slice(-20);
      conversationRef.current = finalMessages;
      setConversation(finalMessages);
      recordRoomEvent("conversation_reply_received", "أجابت الشخصية الافتراضية على سؤال المتدرب.");
      speakResponse(answer);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const message = cause instanceof Error ? cause.message : "حدث خطأ غير متوقع أثناء المحادثة.";
      setVoiceError(message);
      conversationRef.current = nextMessages;
      setConversation(nextMessages);
    } finally {
      busyRef.current = false;
      setAgentBusy(false);
      aborterRef.current = null;
    }
  };

  const startListening = () => {
    if (busyRef.current || listening) return;
    stopAvatarSpeech();
    const speechWindow = window as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setVoiceError("التعرف على الكلام غير متاح في هذا المتصفح. استخدم حقل الكتابة أسفل القاعة، أو افتح التجربة في متصفح يدعم SpeechRecognition.");
      return;
    }

    const instance = new Constructor();
    recognitionRef.current = instance;
    speechBufferRef.current = "";
    shouldSendSpeechRef.current = true;
    setVoiceInput("");
    setVoiceError("");
    instance.lang = "ar-SA";
    instance.continuous = false;
    instance.interimResults = true;

    instance.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript + " ";
        else interimText += result[0].transcript;
      }
      if (finalText) speechBufferRef.current = (speechBufferRef.current + " " + finalText).trim();
      setVoiceInput((speechBufferRef.current + (interimText ? " " + interimText : "")).trim());
    };

    instance.onerror = (event) => {
      shouldSendSpeechRef.current = false;
      setListening(false);
      setVoiceError(event.error === "not-allowed"
        ? "لم يتم السماح باستخدام الميكروفون. فعّل إذن الميكروفون من المتصفح."
        : "تعذر التقاط الصوت: " + event.error);
    };

    instance.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const recognisedText = speechBufferRef.current.trim();
      if (shouldSendSpeechRef.current && recognisedText) {
        shouldSendSpeechRef.current = false;
        void sendMessage(recognisedText);
      } else if (shouldSendSpeechRef.current && !recognisedText) {
        shouldSendSpeechRef.current = false;
        setVoiceError("لم ألتقط كلاماً واضحاً. حاول مرة أخرى أو اكتب رسالتك.");
      }
    };

    try {
      instance.start();
      setListening(true);
      recordRoomEvent("microphone_started", "بدأ المتدرب التحدث إلى الشخصية الافتراضية.");
    } catch {
      shouldSendSpeechRef.current = false;
      setListening(false);
      setVoiceError("تعذر تشغيل الميكروفون. تحقق من أذونات الموقع والجهاز.");
    }
  };

  const stopListening = () => {
    shouldSendSpeechRef.current = true;
    recognitionRef.current?.stop();
    setListening(false);
  };

  const handleAvatarUpload = (file?: File) => {
    if (!file) return;
    if (!/\.glb$/i.test(file.name)) {
      setVoiceError("ارفع ملف GLB فقط حتى يحتوي ملف الشخصية على الخامات والحركة في ملف واحد.");
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      setVoiceError("حجم ملف الشخصية أكبر من 80 ميجابايت. استخدم نسخة محسّنة للنظارة.");
      return;
    }
    if (uploadedAvatarObjectUrlRef.current) URL.revokeObjectURL(uploadedAvatarObjectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    uploadedAvatarObjectUrlRef.current = objectUrl;
    setUploadedAvatarUrl(objectUrl);
    setUploadedAvatarName(file.name);
    setVoiceError("");
    recordRoomEvent("avatar_model_loaded", "تم تحميل موديل بشري مخصص داخل القاعة.");
  };

  const removeCustomAvatar = () => {
    if (uploadedAvatarObjectUrlRef.current) URL.revokeObjectURL(uploadedAvatarObjectUrlRef.current);
    uploadedAvatarObjectUrlRef.current = null;
    setUploadedAvatarUrl(null);
    setUploadedAvatarName("");
  };

  const updateFormulationField = (field: keyof ClinicalFormulation, value: string) => {
    setClinicalFormulation((current) => ({ ...current, [field]: value }));
  };

  const changeCase = (id: string) => {
    recognitionRef.current?.abort();
    shouldSendSpeechRef.current = false;
    aborterRef.current?.abort();
    stopAvatarSpeech();
    busyRef.current = false;
    conversationRef.current = [];
    setCaseId(id);
    setStepIndex(0);
    setAnswers({});
    setFeedback("");
    setCompleted(false);
    setSavedScore(null);
    setSavedActivityId(null);
    setClinicalFormulation({ ...EMPTY_CLINICAL_FORMULATION });
    setVrHeadTrackingSamples(0);
    setVrHeadMetrics(null);
    setVrHandMetrics(null);
    setSpatialTelemetryConsent(false);
    setError("");
    setVoiceError("");
    setAgentBusy(false);
    setListening(false);
    setConversation([]);
    setVoiceInput("");
    setRoomEvents([{ type: "room_entered", label: "بدء حالة تدريبية جديدة", occurredAt: new Date().toISOString() }]);
    window.history.replaceState(null, "", "/simulation?case=" + id);
  };

  const choose = (choiceId: string) => {
    const choice = activeStep.choices.find((item) => item.id === choiceId);
    setAnswers((current) => ({ ...current, [activeStep.id]: choiceId }));
    setFeedback(choice?.feedback ?? "");
    recordRoomEvent("assessment_choice_selected", activeStep.title + ": " + (choice?.label ?? choiceId));
  };

  const moveToStep = (index: number) => {
    const nextIndex = Math.max(0, Math.min(activeCase.steps.length - 1, index));
    setStepIndex(nextIndex);
    setFeedback(activeCase.steps[nextIndex].choices.find((choice) => choice.id === answers[activeCase.steps[nextIndex].id])?.feedback ?? "");
    recordRoomEvent("step_changed", "الانتقال إلى المرحلة: " + activeCase.steps[nextIndex].title);
  };

  const finish = async () => {
    if (answeredCount !== activeCase.steps.length || !formulationComplete || saving || listening || agentBusy) return;
    setSaving(true);
    setError("");
    const completionEvent: RoomEvent = {
      type: "assessment_completed",
      label: "إنهاء التقييم داخل القاعة الافتراضية",
      occurredAt: new Date().toISOString(),
    };
    const finalRoomEvents = [...roomEvents, completionEvent].slice(-120);
    setRoomEvents(finalRoomEvents);

    try {
      const response = await fetch("/api/platform/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: activeCase.id,
          answers: activeCase.steps.map((step) => ({ stepId: step.id, choiceId: answers[step.id] })),
          clinicalFormulation,
          roomEvents: finalRoomEvents,
          conversationTurns: conversationRef.current,
          experienceMode: immersiveMode ? "webxr-immersive-vr" : "browser-3d-room",
          avatarModelSource: uploadedAvatarUrl ? "custom-glb" : defaultAvatarModelUrl ? "library-avatar" : "age-appropriate-model-required",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر حفظ نتيجة التدريب.");
      setSavedScore(result.score);
      setSavedActivityId(typeof result.activityId === "string" ? result.activityId : null);
      setVrHeadTrackingSamples(Number(result.vrHeadTrackingSamples) || 0);
      setVrHeadMetrics(result.vrHeadMetrics ?? null);
      setVrHandMetrics(result.vrHandMetrics ?? null);
      setCompleted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ نتيجة التدريب.");
    } finally {
      setSaving(false);
    }
  };

  const restart = () => {
    setStepIndex(0);
    setAnswers({});
    setFeedback("");
    setCompleted(false);
    setSavedScore(null);
    setSavedActivityId(null);
    setClinicalFormulation({ ...EMPTY_CLINICAL_FORMULATION });
    setVrHeadTrackingSamples(0);
    setVrHeadMetrics(null);
    setVrHandMetrics(null);
    setSpatialTelemetryConsent(false);
    setError("");
    setRoomEvents((current) => [
      ...current,
      { type: "assessment_restarted", label: "إعادة المحاكاة", occurredAt: new Date().toISOString() },
    ].slice(-120));
  };

  return (
    <PlatformLayout
      title="قاعة المحاكاة والمقابلة السريرية"
      eyebrow="IMMERSIVE VR LIVE PATIENT"
      description="واجه شخصية بشرية ثلاثية الأبعاد وجهاً لوجه، تحدث معها بالصوت، ثم أكمل خطوات التقييم واحفظ نتيجة التدريب."
    >
      <div className="simulation-toolbar">
        <label>اختر الحالة
          <select value={caseId} onChange={(event) => changeCase(event.target.value)}>
            {trainingCases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <div><span className="simulation-live-indicator" /> {immersiveMode ? "النظارة داخل جلسة VR غامرة" : "معاينة ثلاثية الأبعاد · لا يوجد مريض حقيقي"}</div>
      </div>

      <div className="simulation-vr-consent">
        <label>
          <input
            type="checkbox"
            checked={spatialTelemetryConsent}
            onChange={(event) => {
              const allowed = event.target.checked;
              setSpatialTelemetryConsent(allowed);
              if (!allowed) {
                setRoomEvents((current) => current.filter((item) => !["head_pose_sample", "hand_tracking_sample", "hand_pinch_interaction"].includes(item.type)));
                setVrHeadTrackingSamples(0);
                setVrHeadMetrics(null);
                setVrHandMetrics(null);
              }
              recordRoomEvent("spatial_telemetry_consent", allowed
                ? "وافق المتدرب على تسجيل مؤشرات وضع الرأس واليدين لغرض المراجعة التدريبية."
                : "ألغى المتدرب الموافقة على تسجيل مؤشرات وضع الرأس واليدين؛ أزيلت العينات غير المحفوظة.");
            }}
          />
          <span><b>الموافقة على مؤشرات الحركة المكانية (اختياري)</b><small>عند التفعيل تُسجّل عينات تقريبية لاتجاه الرأس وإيماءات اليدين وتُعرض كأدلة وصفية في تقرير التدريب، ولا تُستخدم لتشخيص أو تقييم التواصل البصري. القاعة تعمل دون تفعيل هذا الخيار.</small></span>
        </label>
      </div>

      <div className="simulation-layout">
        <section className="simulation-room-panel">
          <div className="simulation-panel-head">
            <div>
              <strong>غرفة المقابلة السريرية</strong>
              <small>اجلس أمام الشخصية، افتح الميكروفون من لوحة المقابلة داخل المشهد، واتبع الحوار بصوتها وحركة وجهها</small>
            </div>
            <span className="room-ready-chip"><i /> الغرفة جاهزة</span>
          </div>

          <div className="simulation-avatar-toolbar">
            <div><b>الشخصية:</b> {avatarModelLabel}</div>
            <label className="simulation-avatar-upload">
              <Upload size={14} /> تحميل شخصية GLB مخصصة
              <input type="file" accept=".glb,model/gltf-binary" onChange={(event) => handleAvatarUpload(event.target.files?.[0])} />
            </label>
            {uploadedAvatarUrl && <button type="button" className="simulation-remove-avatar" onClick={removeCustomAvatar}>العودة للشخصية الافتراضية</button>}
          </div>

          <div className="simulation-stage-wrap">
            <ClinicalRoomStage
              onSelect={setSelectedTarget}
              onRoomEvent={recordRoomEvent}
              onImmersiveChange={setImmersiveMode}
              spatialTelemetryEnabled={spatialTelemetryConsent}
              realtimeStatus={realtimeStatus}
              realtimeMuted={realtimeMuted}
              onStartRealtimeVoice={() => realtimeControlsRef.current?.start()}
              onStopRealtimeVoice={() => realtimeControlsRef.current?.stop()}
              onToggleRealtimeMute={() => realtimeControlsRef.current?.toggleMute()}
              scenarioTitle={activeCase.title}
              avatarModelUrl={avatarModelUrl}
              avatarSpeaking={avatarSpeaking}
              avatarMotion={avatarSpeaking ? "talk" : listening || agentBusy ? "listen" : "idle"}
              voiceStatus={voiceStatus}
              latestUserText={latestUserText}
              latestAssistantText={latestAssistantText}
              listening={listening}
              busy={agentBusy}
              onStartListening={startListening}
              onStopListening={stopListening}
              onStopSpeaking={stopAvatarSpeech}
              step={{
                title: activeStep.title,
                focus: activeStep.focus,
                prompt: activeStep.prompt,
                choices: activeStep.choices.map((choice) => ({
                  id: choice.id,
                  label: choice.label,
                  score: choice.score,
                  feedback: choice.feedback,
                })),
              }}
              stepIndex={stepIndex}
              stepCount={activeCase.steps.length}
              selectedChoiceId={answers[activeStep.id] ?? null}
              completed={completed}
              score={savedScore}
              saving={saving}
              canFinish={answeredCount === activeCase.steps.length && formulationComplete}
              onChoose={choose}
              onPrevious={() => moveToStep(stepIndex - 1)}
              onNext={() => moveToStep(stepIndex + 1)}
              onFinish={finish}
              onRestart={restart}
            />
          </div>

          <div className="simulation-scene-footer">
            <span>العنصر المحدد: <b>{selectedTarget}</b></span>
            <span>في النظارة: وجّه المؤشر إلى لوحة المقابلة واضغط لبدء الكلام</span>
          </div>

          <RealtimeClinicalVoice
            personaId={voicePersona}
            scenario={voiceScenario}
            onConnecting={() => {
              recognitionRef.current?.abort();
              shouldSendSpeechRef.current = false;
              aborterRef.current?.abort();
              busyRef.current = false;
              setAgentBusy(false);
              setListening(false);
              stopAvatarSpeech();
            }}
            onStatusChange={setRealtimeStatus}
            onMutedChange={setRealtimeMuted}
            onControlsReady={registerRealtimeControls}
            onSpeakingChange={setAvatarSpeaking}
            onEvent={recordRoomEvent}
            onTranscript={(turn) => {
              const nextConversation = [...conversationRef.current, turn].slice(-20);
              conversationRef.current = nextConversation;
              setConversation(nextConversation);
              recordRoomEvent(turn.role === "user" ? "realtime_user_transcript" : "realtime_assistant_transcript", turn.role === "user" ? "تم حفظ نص كلام المتدرب من الاتصال الصوتي الحي." : "تم حفظ رد الشخصية من الاتصال الصوتي الحي.");
            }}
          />

          <div className="simulation-voice-console">
            <div className="simulation-voice-heading">
              <div><strong>الحوار مع الشخصية</strong><small>{voiceStatus}</small></div>
              <div className="simulation-voice-actions">
                <button type="button" className={listening ? "recording" : ""} onClick={listening ? stopListening : startListening} disabled={agentBusy || realtimeActive}>
                  {listening ? <MicOff size={15} /> : <Mic size={15} />}{listening ? "إنهاء الكلام" : "تحدث"}
                </button>
                <button type="button" onClick={() => setAudioEnabled((value) => !value)}>
                  {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}{audioEnabled ? "صوت الشخصية مفعل" : "تفعيل الصوت"}
                </button>
              </div>
            </div>
            <div className="simulation-voice-transcript">
              {latestUserText && <p><b>أنت:</b> {latestUserText}</p>}
              {latestAssistantText && <p><b>الشخصية:</b> {latestAssistantText}</p>}
              {!latestUserText && !latestAssistantText && <p>ابدأ بسؤال مفتوح. ستسمع رد الشخصية وترى حركة فمها أثناء التحدث.</p>}
            </div>
            <div className="simulation-voice-input">
              <textarea value={voiceInput} onChange={(event) => setVoiceInput(event.target.value)} rows={2} placeholder="اكتب رسالتك إذا لم يتوفر التعرف الصوتي..." />
              <button type="button" onClick={() => void sendMessage(voiceInput)} disabled={!voiceInput.trim() || agentBusy || realtimeActive}><Sparkles size={14} /> إرسال للشخصية</button>
            </div>
            {voiceError && <p className="simulation-error" role="alert">{voiceError}</p>}
            <small className="simulation-voice-privacy">تُرسل نصوص المحادثة إلى وكيل الذكاء الاصطناعي وتُحفظ مع نتيجة التدريب للمراجعة التعليمية. لا يُحفظ الصوت الخام. لا تستخدم بيانات مرضى حقيقية.</small>
          </div>

          <div className="simulation-case-brief">
            <div>
              <span className="portal-chip">{activeCase.track}</span>
              <h2>{activeCase.title}</h2>
              <p>{activeCase.briefing}</p>
            </div>
            <div className="case-brief-meta"><span>{activeCase.ageGroup}</span><span>{activeCase.setting}</span></div>
          </div>
        </section>

        <aside className="simulation-assessment-panel">
          {!completed ? (
            <>
              <div className="simulation-panel-head">
                <div><strong>مسار التقييم المهني</strong><small>المرحلة {stepIndex + 1} من {activeCase.steps.length}</small></div>
                <b>{Math.round(answeredCount / activeCase.steps.length * 100)}%</b>
              </div>
              <div className="simulation-progress"><i style={{ width: (answeredCount / activeCase.steps.length * 100) + "%" }} /></div>
              <div className="simulation-step-list">
                {activeCase.steps.map((step, index) => (
                  <button key={step.id} className={index === stepIndex ? "active" : answers[step.id] ? "done" : ""} onClick={() => moveToStep(index)}>
                    <span>{answers[step.id] ? <CheckCircle2 size={15} /> : String(index + 1).padStart(2, "0")}</span>{step.title}
                  </button>
                ))}
              </div>
              <div className="simulation-current-task">
                <span>{activeStep.focus}</span>
                <h3>{activeStep.title}</h3>
                <p>{activeStep.prompt}</p>
              </div>
              <div className="simulation-choice-list">
                {activeStep.choices.map((choice) => (
                  <button key={choice.id} className={answers[activeStep.id] === choice.id ? "chosen" : ""} onClick={() => choose(choice.id)}>
                    <i />{choice.label}
                  </button>
                ))}
              </div>
              {feedback && <div className="simulation-feedback"><Sparkles size={15} /><p>{feedback}</p></div>}
              {error && <p className="simulation-error" role="alert">{error}</p>}
              <div className="simulation-step-actions">
                <button className="simulation-prev" onClick={() => moveToStep(stepIndex - 1)} disabled={stepIndex === 0}>السابق</button>
                {stepIndex < activeCase.steps.length - 1 ? (
                  <button className="simulation-next" onClick={() => moveToStep(stepIndex + 1)}>المرحلة التالية <ArrowRight size={14} /></button>
                ) : (
                  <button className="simulation-next" onClick={finish} disabled={saving || listening || agentBusy || answeredCount !== activeCase.steps.length || !formulationComplete}>
                    {saving ? "جارٍ حساب وحفظ التقييم..." : <><ClipboardCheck size={15} /> إنهاء وحفظ الجلسة</>}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="simulation-result">
              <CheckCircle2 size={36} />
              <span>اكتملت المحاكاة</span>
              <strong>{savedScore}<small> / 100</small></strong>
              <p>{savedScore !== null && savedScore >= 80 ? "أداء تدريبي متقدم. راجع الملاحظات لتعزيز المهارات." : savedScore !== null && savedScore >= 60 ? "أداء جيد مع فرص لتحسين بعض خطوات الممارسة." : "راجع التغذية الراجعة وأعد المحاكاة لتعزيز المهارات."}</p>
              {savedActivityId && <section className="simulation-saved-report">
                <div className="simulation-saved-report-head">
                  <div><b>تقرير دراسة الحالة المحفوظ</b><small>رقم الجلسة: {savedActivityId}</small></div>
                  <button type="button" onClick={() => window.print()}><Printer size={14} /> طباعة التقرير</button>
                </div>
                <p><strong>المقياس التدريبي المختار:</strong> {selectedPracticeScale?.title || "غير محدد"}</p>
                <div><strong>المشكلة كما عرضتها الحالة</strong><p>{clinicalFormulation.presentingConcern}</p></div>
                <div><strong>التاريخ والسياق</strong><p>{clinicalFormulation.historyAndContext}</p></div>
                <div><strong>الملاحظات القابلة للوصف</strong><p>{clinicalFormulation.observations}</p></div>
                <div><strong>نقاط القوة وعوامل الحماية</strong><p>{clinicalFormulation.strengths}</p></div>
                <div><strong>الفرضيات التعليمية والأدلة</strong><p>{clinicalFormulation.hypotheses}</p></div>
                <div><strong>المعلومات التي ما زالت ناقصة</strong><p>{clinicalFormulation.missingInformation}</p></div>
                <div><strong>الخطوات التالية والإحالة</strong><p>{clinicalFormulation.nextSteps}</p></div>
                <small className="simulation-report-footnote">تم حفظ التقرير لأغراض التعلم والمراجعة. اكتمال الحقول لا يثبت صحة الفرضيات ولا ينتج تشخيصاً رسمياً.</small>
              </section>}
              {immersiveMode && <div className="simulation-vr-evidence"><b>بيانات النظارة المسجلة</b><span>{vrHeadTrackingSamples} عينة لاتجاه الرأس والمسافة من موضع الحالة</span>{vrHeadMetrics && <><span>متوسط زاوية اتجاه الرأس: {vrHeadMetrics.averageHeadAngleDegrees ?? "—"}°</span><span>متوسط المسافة من الحالة: {vrHeadMetrics.averageDistanceCm ?? "—"} سم</span><span>نسبة العينات ضمن زاوية 30°: {vrHeadMetrics.orientedWithin30DegreesPercent ?? "—"}%</span></>}<span>رصد اليدين: {vrHandMetrics?.samples ?? 0} عينة؛ تفاعلات القرص: {vrHandMetrics?.pinchInteractions ?? 0}</span><span>اليد المرصودة: {vrHandMetrics?.handsObserved?.map((hand) => hand === "left" ? "اليسرى" : "اليمنى").join("، ") || "لم تُرصد يد خلال الجلسة"}</span><small>مؤشرات وضع الرأس والإيماءات المكانية لا تقيس حركة العين أو التواصل البصري ولا تمثل حكماً سريرياً. قد لا تظهر بيانات اليدين إذا لم يدعم الجهاز أو المتصفح تتبع اليد.</small></div>}
              <div className="simulation-result-breakdown">
                {activeCase.steps.map((step) => {
                  const choice = step.choices.find((item) => item.id === answers[step.id]);
                  return <div key={step.id}><span>{step.title}</span><b>{choice?.score ?? 0}/20</b><small>{choice?.feedback}</small></div>;
                })}
              </div>
              <p className="simulation-result-dialogue">تم حفظ {conversation.length} رسالة نصية من الحوار ضمن سجل النشاط للمراجعة، دون حفظ تسجيل صوتي.</p>
              <button className="simulation-next" onClick={restart}><RotateCcw size={15} /> إعادة المحاكاة</button>
            </div>
          )}
          <div className="simulation-safety-note"><ShieldCheck size={15} /><p>{activeCase.safetyNote}</p></div>
        </aside>
      </div>

      <section className="portal-card simulation-formulation-card">
        <div className="simulation-formulation-heading">
          <div><span>CASE FORMULATION WORKSPACE</span><h2>دراسة الحالة وصياغة الفرضيات</h2><p>استكمل التقرير اعتماداً على مقابلتك وملاحظتك للحالة الافتراضية. افصل بين ما ورد في السيناريو وما لاحظته وما تفترضه مهنياً.</p></div>
          <div className="simulation-formulation-count">{completedFormulationFields}<small> / 8 حقول</small></div>
        </div>
        <div className="simulation-formulation-progress"><i style={{ width: (completedFormulationFields / 8 * 100) + "%" }} /></div>
        <div className="simulation-formulation-grid">
          <label>1. المشكلة أو الاحتياج كما عرضته الحالة
            <textarea value={clinicalFormulation.presentingConcern} onChange={(event) => updateFormulationField("presentingConcern", event.target.value)} minLength={12} maxLength={1200} rows={3} placeholder="اكتب وصفاً محايداً للمشكلة من منظور الحالة أو الأسرة، دون إضافة استنتاج تشخيصي." />
          </label>
          <label>2. التاريخ والسياق الاجتماعي والنمائي
            <textarea value={clinicalFormulation.historyAndContext} onChange={(event) => updateFormulationField("historyAndContext", event.target.value)} minLength={20} maxLength={1200} rows={4} placeholder="ما المعلومات المعروفة عن الأسرة، النمو، المدرسة، البيئة، بداية الصعوبة وتطورها؟" />
          </label>
          <label>3. الملاحظات السلوكية القابلة للوصف
            <textarea value={clinicalFormulation.observations} onChange={(event) => updateFormulationField("observations", event.target.value)} minLength={20} maxLength={1200} rows={4} placeholder="سجل أمثلة محددة شاهدتها أو وردت في الحوار، وحدد مصدر كل ملاحظة." />
          </label>
          <label>4. نقاط القوة وعوامل الحماية
            <textarea value={clinicalFormulation.strengths} onChange={(event) => updateFormulationField("strengths", event.target.value)} minLength={12} maxLength={1200} rows={3} placeholder="ما المهارات والاهتمامات والموارد والعلاقات الداعمة؟" />
          </label>
          <label>5. الفرضيات التعليمية والأدلة والبدائل
            <textarea value={clinicalFormulation.hypotheses} onChange={(event) => updateFormulationField("hypotheses", event.target.value)} minLength={20} maxLength={1200} rows={4} placeholder="اكتب فرضية أو أكثر، وما الذي يدعمها وما الذي قد يفسر الموقف بطريقة أخرى. لا تكتب تشخيصاً نهائياً." />
          </label>
          <label>6. المعلومات التي تحتاج إلى استكمال
            <textarea value={clinicalFormulation.missingInformation} onChange={(event) => updateFormulationField("missingInformation", event.target.value)} minLength={12} maxLength={1200} rows={3} placeholder="ما المصادر أو المقابلات أو الفحوصات أو السياقات التي لم تُستكشف بعد؟" />
          </label>
          <label>7. الخطوات التالية وخطة الدعم أو الإحالة
            <textarea value={clinicalFormulation.nextSteps} onChange={(event) => updateFormulationField("nextSteps", event.target.value)} minLength={20} maxLength={1200} rows={4} placeholder="حدد خطوة عملية آمنة، ومن ينبغي إشراكه، وما الذي يتطلب إحالة إلى مختص مخول." />
          </label>
          <label>8. المقياس أو النموذج التدريبي الذي ستستخدمه
            <select value={clinicalFormulation.selectedScaleId} onChange={(event) => updateFormulationField("selectedScaleId", event.target.value)}>
              <option value="">اختر أداة تدريبية مناسبة</option>
              {practiceScales.map((scale) => <option key={scale.id} value={scale.id}>{scale.title}</option>)}
            </select>
            <small>{selectedPracticeScale?.purpose || "اختر أداة من المكتبة. جميع النماذج الحالية تدريبية وغير مقننة."}</small>
          </label>
        </div>
        <div className="simulation-formulation-footer">
          <span>{formulationComplete ? "اكتملت الحقول المطلوبة. يمكنك إنهاء الجلسة وحفظ التقرير." : "أكمل الحقول الثمانية للانتقال إلى حفظ نتيجة المحاكاة."}</span>
          <small>المؤشر يقيس اكتمال الحقول فقط، ولا يقيم صحة التشخيص أو دقة الفرضيات. استخدم حالات خيالية ولا تكتب بيانات تعريفية لمستفيد حقيقي.</small>
        </div>
        {error && !formulationComplete && <p className="simulation-error" role="alert">{error}</p>}
      </section>

      <div className="simulation-bottom-links">
        <Link href="/posture">تقييم لغة الجسد <ArrowRight size={14} /></Link>
        <Link href="/supervision">إشراف أكاديمي مباشر <ArrowRight size={14} /></Link>
        <Link href="/competencies">ملف الكفاءات المهنية <ArrowRight size={14} /></Link>
      </div>
      <div className="portal-callout simulation-disclaimer">
        <Info size={16} /> الحوار الصوتي يستخدم التعرف على الكلام والصوت المنطوق المتاحين في المتصفح، وقد تختلف جودتهما حسب النظارة والمتصفح واللغة المثبتة. تقييم الدرجة يعتمد على Rubric الحالة؛ ويُحفظ نص الحوار كدليل للمراجعة ولا يصدر حكماً مهنياً آلياً نهائياً.
      </div>
    </PlatformLayout>
  );
}

export default function SimulationPage() {
  return <Suspense fallback={<div className="simulation-stage-loading">تحميل القاعة...</div>}><SimulationWorkspace /></Suspense>;
}
