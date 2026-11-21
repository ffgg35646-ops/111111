"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, type Participant } from "livekit-client";
import {
  Activity, Check, ClipboardCheck, Copy, MessageSquareText, Send, ShieldCheck, Signal, Users, Wifi,
} from "lucide-react";
import "@livekit/components-styles";
import "./live-supervision-room.css";

type Role = "supervisor" | "trainee";
type RoomTelemetry = {
  type: string;
  label: string;
  value: number | string | boolean | null;
  unit?: string;
  source?: string;
  occurredAt: string;
};
type CoachMessage = { id: string; text: string; sender: string; role: Role; sentAt: string };
type Props = {
  token: string;
  serverUrl: string;
  roomName: string;
  role: Role;
  liveKitToken: string;
  supervisorName: string;
  traineeName: string;
  traineeCode: string;
  scenarioTitle: string;
  inviteUrl: string;
};

const rubric = [
  { key: "communication", label: "التواصل السريري الواضح" },
  { key: "activeListening", label: "الإنصات وجمع المعلومات" },
  { key: "clinicalAssessment", label: "الاستدلال والتقييم السريري" },
  { key: "empathy", label: "التعاطف واحترام المراجع" },
  { key: "nonverbalCommunication", label: "لغة الجسد والتواصل البصري" },
  { key: "safetyAndProfessionalism", label: "السلامة والسلوك المهني" },
] as const;

type RubricKey = (typeof rubric)[number]["key"];

function RoomTools({ role, supervisorName, traineeName, traineeCode, scenarioTitle, liveKitToken, inviteUrl }: Props) {
  const room = useRoomContext();
  const [coachDraft, setCoachDraft] = useState("");
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [telemetry, setTelemetry] = useState<RoomTelemetry[]>([]);
  const [scores, setScores] = useState<Record<RubricKey, number>>({
    communication: 3,
    activeListening: 3,
    clinicalAssessment: 3,
    empathy: 3,
    nonverbalCommunication: 3,
    safetyAndProfessionalism: 3,
  });
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedReport, setSavedReport] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      try {
        const event = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
        if (topic === "clinical-coaching" && event.type === "coach-note" && typeof event.text === "string") {
          setCoachMessages((current) => [{
            id: typeof event.id === "string" ? event.id : crypto.randomUUID(),
            text: event.text as string,
            sender: typeof event.sender === "string" ? event.sender : participant?.identity ?? "مشارك",
            role: event.role === "supervisor" ? "supervisor" : "trainee",
            sentAt: typeof event.sentAt === "string" ? event.sentAt : new Date().toISOString(),
          }, ...current].slice(0, 60));
        }

        if (topic === "vr-telemetry" && typeof event.type === "string") {
          const value = typeof event.value === "number" && Number.isFinite(event.value)
            ? event.value
            : typeof event.value === "string" || typeof event.value === "boolean"
              ? event.value
              : null;
          setTelemetry((current) => [{
            type: event.type as string,
            label: typeof event.label === "string" ? event.label : event.type as string,
            value,
            unit: typeof event.unit === "string" ? event.unit : "",
            source: typeof event.source === "string" ? event.source : "VR",
            occurredAt: typeof event.occurredAt === "string" ? event.occurredAt : new Date().toISOString(),
          }, ...current].slice(0, 300));
        }
      } catch {
        // Ignore unsupported or malformed room data packets.
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  const averageScore = useMemo(() =>
    (Object.values(scores).reduce((total, value) => total + value, 0) / rubric.length).toFixed(2),
  [scores]);

  const sendCoachNote = async () => {
    const text = coachDraft.trim();
    if (!text || role !== "supervisor") return;
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          type: "coach-note",
          id: crypto.randomUUID(),
          text,
          sender: supervisorName || "المشرف الأكاديمي",
          role,
          sentAt: new Date().toISOString(),
        })),
        { reliable: true, topic: "clinical-coaching" },
      );
      setCoachDraft("");
      setError("");
    } catch {
      setError("تعذر إرسال التوجيه. تحقق من اتصال الغرفة.");
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("تعذر النسخ تلقائياً. انسخ رابط الدعوة من صفحة إنشاء الغرفة.");
    }
  };

  const saveReport = async () => {
    if (role !== "supervisor") return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/competencies/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          liveKitToken,
          traineeCode,
          traineeName,
          scenarioTitle,
          scores,
          feedbackNotes,
          telemetry,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر حفظ التقرير.");
      setSavedReport(result.reportId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر حفظ التقرير.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="supervision-workspace">
      <section className="live-call-panel">
        <div className="live-call-heading">
          <div><span className="live-label"><i/> غرفة مباشرة</span><h2>{scenarioTitle || "جلسة إشراف سريري"}</h2><p>الغرفة: {roomNameLabel(room.name)}</p></div>
          <div className="live-call-badges"><span><Users size={14}/> مشرف + متدرب</span><span><Wifi size={14}/> اتصال مشفر عبر WebRTC</span></div>
        </div>
        <VideoConference />
        <RoomAudioRenderer />
      </section>

      <aside className="supervision-sidebar">
        <section className="supervisor-summary">
          <div className="supervisor-avatar"><ShieldCheck size={20}/></div>
          <div><strong>{role === "supervisor" ? supervisorName || "المشرف الأكاديمي" : "أنت: المتدرب"}</strong><small>{role === "supervisor" ? `متابعة أداء: ${traineeName || "المتدرب"}` : "جلسة تحت إشراف أكاديمي مباشر"}</small></div>
        </section>

        {role === "supervisor" && <button className="invite-copy-button" onClick={copyInvite}><Copy size={15}/>{copied ? "تم نسخ رابط المتدرب" : "نسخ رابط دعوة المتدرب"}</button>}

        <section className="supervision-card">
          <div className="supervision-card-title"><MessageSquareText size={17}/><div><strong>التوجيه الحي</strong><small>تصل ملاحظات المشرف للطرفين فوراً</small></div></div>
          <div className="coach-message-list">
            {coachMessages.length === 0 && <p className="coach-empty">لا توجد توجيهات بعد. يمكن للمشرف إرسال ملاحظة أثناء الجلسة.</p>}
            {coachMessages.map((message) => <article className={message.role === "supervisor" ? "coach-message coach-from-supervisor" : "coach-message"} key={message.id}><small>{message.role === "supervisor" ? "توجيه المشرف" : "رد المتدرب"}</small><p>{message.text}</p><time>{new Date(message.sentAt).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"})}</time></article>)}
          </div>
          {role === "supervisor" ? <div className="coach-compose"><textarea value={coachDraft} onChange={(event)=>setCoachDraft(event.target.value)} rows={3} maxLength={600} placeholder="اكتب توجيهاً قصيراً للمتدرب أثناء المحاكاة..."/><button onClick={sendCoachNote} disabled={!coachDraft.trim()}><Send size={14}/> إرسال التوجيه</button></div> : <p className="trainee-coach-hint">ستظهر توجيهات المشرف هنا أثناء الجلسة.</p>}
        </section>

        <section className="supervision-card telemetry-card">
          <div className="supervision-card-title"><Activity size={17}/><div><strong>مخرجات محرك VR</strong><small>بيانات الأجهزة والأحداث المرسلة للغرفة</small></div><span className="telemetry-count">{telemetry.length}</span></div>
          {telemetry.length === 0 ? <p className="coach-empty">بانتظار بيانات من تطبيق VR. يمكن لمحرك Unreal / OpenXR إرسال أحداث القياس إلى قناة vr-telemetry.</p> : <div className="telemetry-list">{telemetry.slice(0,8).map((event,index)=><div key={`${event.occurredAt}-${index}`}><strong>{event.label}</strong><b>{String(event.value ?? "—")} {event.unit}</b><small>{event.source} · {new Date(event.occurredAt).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</small></div>)}</div>}
        </section>

        {role === "supervisor" && <section className="supervision-card report-card">
          <div className="supervision-card-title"><ClipboardCheck size={17}/><div><strong>تقييم الكفاءات المهنية</strong><small>درجة كل كفاءة من 1 إلى 5</small></div></div>
          <div className="rubric-list">{rubric.map((item)=><label key={item.key}><span>{item.label}</span><select value={scores[item.key]} onChange={(event)=>setScores((current)=>({...current,[item.key]:Number(event.target.value)}))}>{[1,2,3,4,5].map((score)=><option value={score} key={score}>{score} / 5</option>)}</select></label>)}</div>
          <div className="report-average"><span>المتوسط الإجمالي</span><strong>{averageScore} / 5</strong></div>
          <textarea className="report-notes" value={feedbackNotes} onChange={(event)=>setFeedbackNotes(event.target.value)} rows={3} maxLength={3000} placeholder="ملاحظات المشرف وخطة التحسين..."/>
          <button className="save-report-button" onClick={saveReport} disabled={saving}>{saving ? "جارٍ حفظ التقرير..." : <><Check size={15}/> حفظ في ملف الكفاءات</>}</button>
          {savedReport && <p className="report-saved">تم حفظ التقرير بنجاح · {savedReport.slice(0,8)}</p>}
        </section>}

        {role === "trainee" && <section className="supervision-card trainee-guidance"><div className="supervision-card-title"><ShieldCheck size={17}/><div><strong>إرشادات الجلسة</strong><small>للمتدرب</small></div></div><p>تابع توجيهات المشرف أثناء المحاكاة. يتم إرسال ملاحظاته مباشرة داخل الغرفة، ولا يتم تسجيل الصوت أو الفيديو تلقائياً من هذه الواجهة.</p></section>}
      </aside>
      {error && <div className="supervision-error" role="alert">{error}</div>}
    </div>
  );
}

function roomNameLabel(value?: string) {
  return value ? value.replace(/^clinical-/, "").slice(0, 8).toUpperCase() : "جلسة مباشرة";
}

export default function LiveSupervisionRoom(props: Props) {
  const [connectionError, setConnectionError] = useState("");
  const title = props.role === "supervisor" ? "المشرف الأكاديمي" : "المتدرب";

  return (
    <div className="livekit-root" data-lk-theme="default">
      <LiveKitRoom
        serverUrl={props.serverUrl}
        token={props.token}
        connect={true}
        audio={true}
        video={true}
        onError={(error) => setConnectionError(error.message)}
        onDisconnected={() => setConnectionError("انقطع اتصال الغرفة. يمكنك إعادة تحميل الصفحة للانضمام من جديد إذا كان رابط الدعوة ما زال صالحاً.")}
      >
        <div className="livekit-room-topbar"><div><span className="live-status-dot"/> إشراف سريري متعدد المستخدمين</div><strong>{title}</strong></div>
        <RoomTools {...props}/>
      </LiveKitRoom>
      {connectionError && <div className="livekit-connection-alert">{connectionError}</div>}
    </div>
  );
}
