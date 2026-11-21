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
  Activity, Check, ClipboardCheck, Copy, MessageSquareText, Send, ShieldCheck, Users, Wifi,
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
type SceneSnapshot = { sceneId: string; scenarioTitle: string; activeTask: string; position?: {x:number;y:number;z:number}; updatedAt: string };

type ParticipantRole = Role | "vr-device";

function participantRole(metadata?: string): ParticipantRole | null {
  try {
    const parsed = JSON.parse(metadata || "") as { role?: string };
    return parsed.role === "supervisor" || parsed.role === "trainee" || parsed.role === "vr-device"
      ? parsed.role
      : null;
  } catch {
    return null;
  }
}
type Props = {
  token: string;
  serverUrl: string;
  roomName: string;
  role: Role;
  liveKitToken: string;
  vrDeviceToken: string;
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

function RoomTools({ role, serverUrl, roomName, supervisorName, traineeName, traineeCode, scenarioTitle, liveKitToken, vrDeviceToken, inviteUrl }: Props) {
  const room = useRoomContext();
  const [signedRoomRole, setSignedRoomRole] = useState<Role | null>(null);
  const [humanParticipantCount, setHumanParticipantCount] = useState(1);
  const isSupervisor = signedRoomRole === "supervisor";
  const isTrainee = signedRoomRole === "trainee";
  const [sceneSnapshot, setSceneSnapshot] = useState<SceneSnapshot | null>(null);
  const [coachDraft, setCoachDraft] = useState("");
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [telemetry, setTelemetry] = useState<RoomTelemetry[]>([]);
  const [scores, setScores] = useState<Record<RubricKey, number>>({
    communication: 0,
    activeListening: 0,
    clinicalAssessment: 0,
    empathy: 0,
    nonverbalCommunication: 0,
    safetyAndProfessionalism: 0,
  });
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedReport, setSavedReport] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [deviceTokenCopied, setDeviceTokenCopied] = useState(false);

  useEffect(() => {
    const syncSignedRole = () => {
      const currentRole = participantRole(room.localParticipant.metadata);
      setSignedRoomRole(currentRole === "supervisor" || currentRole === "trainee" ? currentRole : null);
    };
    const refreshHumanParticipants = () => {
      const remoteHumans = Array.from(room.remoteParticipants.values()).filter((remote) => {
        const remoteRole = participantRole(remote.metadata);
        return remoteRole === "supervisor" || remoteRole === "trainee";
      });
      setHumanParticipantCount(remoteHumans.length + 1);
    };
    const onParticipantChanged = () => refreshHumanParticipants();
    const onMetadataChanged = (_previousMetadata: string, participant: Participant) => {
      if (participant.identity === room.localParticipant.identity) syncSignedRole();
      refreshHumanParticipants();
    };
    room.on(RoomEvent.Connected, syncSignedRole);
    room.on(RoomEvent.Connected, refreshHumanParticipants);
    room.on(RoomEvent.ParticipantConnected, onParticipantChanged);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantChanged);
    room.on(RoomEvent.ParticipantMetadataChanged, onMetadataChanged);
    syncSignedRole();
    refreshHumanParticipants();

    const onData = (
      payload: Uint8Array,
      participant?: Participant,
      _kind?: unknown,
      topic?: string,
    ) => {
      try {
        const event = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
        const senderRole = participantRole(participant?.metadata);
        if (
          topic === "clinical-coaching" &&
          event.type === "coach-note" &&
          typeof event.text === "string" &&
          (senderRole === "supervisor" || senderRole === "trainee")
        ) {
          setCoachMessages((current) => [{
            id: typeof event.id === "string" ? event.id : crypto.randomUUID(),
            text: event.text as string,
            role: senderRole,
            sender: senderRole === "supervisor" ? "المشرف الأكاديمي" : "المتدرب",
            sentAt: typeof event.sentAt === "string" ? event.sentAt : new Date().toISOString(),
          }, ...current].slice(0, 60));
        }

        if (senderRole === "vr-device" && topic === "vr-scene-state" && event.type === "scene_state") {
          const position = event.position && typeof event.position === "object"
            ? event.position as {x?:unknown;y?:unknown;z?:unknown}
            : undefined;
          setSceneSnapshot({
            sceneId: typeof event.sceneId === "string" ? event.sceneId.slice(0,80) : "clinical-room",
            scenarioTitle: typeof event.scenarioTitle === "string" ? event.scenarioTitle.slice(0,160) : "المشهد السريري المشترك",
            activeTask: typeof event.activeTask === "string" ? event.activeTask.slice(0,160) : "لا توجد خطوة نشطة",
            position: position && typeof position.x === "number" && typeof position.y === "number" && typeof position.z === "number"
              ? {x:position.x,y:position.y,z:position.z}
              : undefined,
            updatedAt: typeof event.updatedAt === "string" ? event.updatedAt : new Date().toISOString(),
          });
        }

        if (senderRole === "vr-device" && topic === "vr-telemetry" && typeof event.type === "string") {
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
      room.off(RoomEvent.Connected, syncSignedRole);
      room.off(RoomEvent.Connected, refreshHumanParticipants);
      room.off(RoomEvent.ParticipantConnected, onParticipantChanged);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantChanged);
      room.off(RoomEvent.ParticipantMetadataChanged, onMetadataChanged);
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  const allScoresSelected = Object.values(scores).every((value) => Number.isInteger(value) && value >= 1 && value <= 5);
  const averageScore = useMemo(() =>
    allScoresSelected
      ? (Object.values(scores).reduce((total, value) => total + value, 0) / rubric.length).toFixed(2)
      : "—",
  [scores, allScoresSelected]);

  const sendCoachNote = async () => {
    const text = coachDraft.trim();
    if (!text || !isSupervisor) return;
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

  const copyVrDeviceToken = async () => {
    try {
      const deviceConnection = {
        serverUrl,
        roomName,
        token: vrDeviceToken,
        role: "vr-device",
        permissions: ["roomJoin", "publishData"],
      };
      await navigator.clipboard.writeText(JSON.stringify(deviceConnection, null, 2));
      setDeviceTokenCopied(true);
      window.setTimeout(() => setDeviceTokenCopied(false), 2200);
    } catch {
      setError("تعذر نسخ بيانات محرك VR. تحقق من صلاحية الحافظة في المتصفح.");
    }
  };

  const saveReport = async () => {
    if (!isSupervisor) return;
    if (!allScoresSelected) {
      setError("أكمل تقييم الكفاءات الست قبل حفظ التقرير.");
      return;
    }
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
          <div className="live-call-badges"><span><Users size={14}/>{humanParticipantCount >= 2 ? "المشرف والمتدرب متصلان" : "بانتظار انضمام الطرف الآخر"}</span><span><Wifi size={14}/> اتصال عبر WebRTC</span></div>
        </div>
        <p className="vr-screen-share-hint">لمشاهدة تطبيق الواقع الافتراضي نفسه، يشارك المتدرب شاشة النظارة أو نافذة محرك VR من أدوات مشاركة الشاشة داخل الاجتماع.</p>
        <VideoConference />
        <RoomAudioRenderer />
      </section>

      <aside className="supervision-sidebar">
        <section className="supervisor-summary">
          <div className="supervisor-avatar"><ShieldCheck size={20}/></div>
          <div><strong>{signedRoomRole === "supervisor" ? supervisorName || "المشرف الأكاديمي" : signedRoomRole === "trainee" ? "أنت: المتدرب" : "التحقق من هوية الغرفة..."}</strong><small>{signedRoomRole === "supervisor" ? `متابعة أداء: ${traineeName || "المتدرب"}` : "جلسة تحت إشراف أكاديمي مباشر"}</small></div>
        </section>

        {isSupervisor && <>
          <button className="invite-copy-button" onClick={copyInvite}><Copy size={15}/>{copied ? "تم نسخ رابط المتدرب" : "نسخ رابط دعوة المتدرب"}</button>
          <button className="device-token-copy-button" onClick={copyVrDeviceToken} disabled={!vrDeviceToken}><Copy size={14}/>{deviceTokenCopied ? "تم نسخ بيانات الاتصال" : "نسخ بيانات ربط محرك VR"}</button>
          <p className="device-token-warning">رمز الجهاز يسمح بإرسال بيانات VR فقط، وينتهي بعد ساعتين. لا تشاركه إلا مع محرك الجلسة الموثوق.</p>
        </>}

        <section className="supervision-card">
          <div className="supervision-card-title"><MessageSquareText size={17}/><div><strong>التوجيه الحي</strong><small>تصل ملاحظات المشرف للطرفين فوراً</small></div></div>
          <div className="coach-message-list">
            {coachMessages.length === 0 && <p className="coach-empty">لا توجد توجيهات بعد. يمكن للمشرف إرسال ملاحظة أثناء الجلسة.</p>}
            {coachMessages.map((message) => <article className={message.role === "supervisor" ? "coach-message coach-from-supervisor" : "coach-message"} key={message.id}><small>{message.role === "supervisor" ? "توجيه المشرف" : "رد المتدرب"}</small><p>{message.text}</p><time>{new Date(message.sentAt).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"})}</time></article>)}
          </div>
          {isSupervisor ? <div className="coach-compose"><textarea value={coachDraft} onChange={(event)=>setCoachDraft(event.target.value)} rows={3} maxLength={600} placeholder="اكتب توجيهاً قصيراً للمتدرب أثناء المحاكاة..."/><button onClick={sendCoachNote} disabled={!coachDraft.trim()}><Send size={14}/> إرسال التوجيه</button></div> : <p className="trainee-coach-hint">ستظهر توجيهات المشرف هنا أثناء الجلسة.</p>}
        </section>

        <section className="supervision-card scene-card">
          <div className="supervision-card-title"><Activity size={17}/><div><strong>المشهد الافتراضي المشترك</strong><small>تحديث موضع المتدرب والخطوة الحالية</small></div></div>
          {sceneSnapshot ? <div className="scene-state-data">
            <strong>{sceneSnapshot.scenarioTitle}</strong>
            <span>المشهد: {sceneSnapshot.sceneId}</span>
            <span>الخطوة النشطة: {sceneSnapshot.activeTask}</span>
            {sceneSnapshot.position && <span>الموضع: X {sceneSnapshot.position.x.toFixed(2)} · Y {sceneSnapshot.position.y.toFixed(2)} · Z {sceneSnapshot.position.z.toFixed(2)}</span>}
            <small>آخر تحديث: {new Date(sceneSnapshot.updatedAt).toLocaleTimeString("ar-EG")}</small>
          </div> : <p className="coach-empty">بانتظار حالة المشهد من محرك VR. يمكن عرض المشهد المرئي عبر مشاركة شاشة النظارة أو تطبيق المحاكاة.</p>}
        </section>

        <section className="supervision-card telemetry-card">
          <div className="supervision-card-title"><Activity size={17}/><div><strong>مخرجات محرك VR</strong><small>بيانات الأجهزة والأحداث المرسلة للغرفة</small></div><span className="telemetry-count">{telemetry.length}</span></div>
          {telemetry.length === 0 ? <p className="coach-empty">بانتظار بيانات من تطبيق VR. يمكن لمحرك Unreal / OpenXR إرسال أحداث القياس إلى قناة vr-telemetry.</p> : <div className="telemetry-list">{telemetry.slice(0,8).map((event,index)=><div key={`${event.occurredAt}-${index}`}><strong>{event.label}</strong><b>{String(event.value ?? "—")} {event.unit}</b><small>{event.source} · {new Date(event.occurredAt).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</small></div>)}</div>}
        </section>

        {isSupervisor && <section className="supervision-card report-card">
          <div className="supervision-card-title"><ClipboardCheck size={17}/><div><strong>تقييم الكفاءات المهنية</strong><small>درجة كل كفاءة من 1 إلى 5</small></div></div>
          <div className="rubric-list">{rubric.map((item)=><label key={item.key}><span>{item.label}</span><select value={scores[item.key]} onChange={(event)=>setScores((current)=>({...current,[item.key]:Number(event.target.value)}))}><option value={0}>اختر الدرجة</option>{[1,2,3,4,5].map((score)=><option value={score} key={score}>{score} / 5</option>)}</select></label>)}</div>
          <div className="report-average"><span>المتوسط الإجمالي</span><strong>{averageScore} / 5</strong></div>
          <textarea className="report-notes" value={feedbackNotes} onChange={(event)=>setFeedbackNotes(event.target.value)} rows={3} maxLength={3000} placeholder="ملاحظات المشرف وخطة التحسين..."/>
          <button className="save-report-button" onClick={saveReport} disabled={saving || !allScoresSelected}>{saving ? "جارٍ حفظ التقرير..." : <><Check size={15}/> حفظ في ملف الكفاءات</>}</button>
          {savedReport && <p className="report-saved">تم حفظ التقرير بنجاح · {savedReport.slice(0,8)}</p>}
        </section>}

        {isTrainee && <section className="supervision-card trainee-guidance"><div className="supervision-card-title"><ShieldCheck size={17}/><div><strong>إرشادات الجلسة</strong><small>للمتدرب</small></div></div><p>تابع توجيهات المشرف أثناء المحاكاة. يتم إرسال ملاحظاته مباشرة داخل الغرفة، ولا يتم تسجيل الصوت أو الفيديو تلقائياً من هذه الواجهة.</p></section>}
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
        audio={false}
        video={false}
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
