"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Radio, Volume2 } from "lucide-react";

type TranscriptTurn = { role: "user" | "assistant"; content: string };

type RealtimeClinicalVoiceProps = {
  scenario: string;
  onTranscript: (turn: TranscriptTurn) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onEvent?: (type: string, label: string) => void;
  onConnecting?: () => void;
  onStatusChange?: (status: "idle" | "connecting" | "live" | "error") => void;
  onMutedChange?: (muted: boolean) => void;
  onControlsReady?: (controls: { start: () => void; stop: () => void; toggleMute: () => void } | null) => void;
};

type RealtimeEvent = {
  type?: string;
  transcript?: string;
  delta?: string;
  error?: { message?: string };
};

export function RealtimeClinicalVoice({
  scenario,
  onTranscript,
  onSpeakingChange,
  onEvent,
  onConnecting,
  onStatusChange,
  onMutedChange,
  onControlsReady,
}: RealtimeClinicalVoiceProps) {
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "error">("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const assistantTranscriptRef = useRef("");
  const mountedRef = useRef(true);

  useEffect(() => { onStatusChange?.(status); }, [onStatusChange, status]);

  const cleanup = useCallback((notify = true) => {
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.getSenders().forEach((sender) => {
      if (sender.track) sender.track.stop();
    });
    peerRef.current?.close();
    peerRef.current = null;
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    assistantTranscriptRef.current = "";
    onSpeakingChange?.(false);
    if (notify) {
      setMuted(false);
      onMutedChange?.(false);
    }
  }, [onMutedChange, onSpeakingChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup(false);
    };
  }, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setStatus("idle");
    setSessionId("");
    setError("");
    onEvent?.("realtime_voice_ended", "تم إنهاء الاتصال الصوتي ثنائي الاتجاه.");
  }, [cleanup, onEvent]);

  const start = useCallback(async () => {
    if (status === "connecting" || status === "live") return;
    setStatus("connecting");
    setError("");
    onConnecting?.();
    onEvent?.("realtime_voice_connecting", "جارٍ إنشاء اتصال صوتي حي ثنائي الاتجاه.");

    try {
      if (!navigator.mediaDevices?.getUserMedia || !("RTCPeerConnection" in window)) {
        throw new Error("المتصفح أو النظارة لا يدعمان اتصال WebRTC والميكروفون المطلوب للصوت الحي.");
      }

      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      microphoneRef.current = microphone;

      const tokenResponse = await fetch("/api/clinical-agent/realtime-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
        cache: "no-store",
      });
      const tokenPayload = await tokenResponse.json().catch(() => ({})) as {
        value?: string;
        error?: string;
        session?: { id?: string };
      };
      if (!tokenResponse.ok || !tokenPayload.value) {
        throw new Error(tokenPayload.error || "تعذر الحصول على مفتاح اتصال مؤقت للصوت الحي.");
      }

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      microphone.getAudioTracks().forEach((track) => peer.addTrack(track, microphone));

      peer.ontrack = (event) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => {
          if (mountedRef.current) setError("الاتصال قائم؛ اضغط تشغيل الصوت للسماح بسماع الشخصية.");
        });
      };

      peer.onconnectionstatechange = () => {
        if (!mountedRef.current) return;
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
          cleanup();
          setStatus("error");
          setError("انقطع اتصال WebRTC. أنهِ الاتصال ثم أعد المحاولة.");
          onSpeakingChange?.(false);
        }
      };

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.addEventListener("open", () => {
        if (mountedRef.current) {
          setStatus("live");
          setSessionId(tokenPayload.session?.id ?? "");
          onEvent?.("realtime_voice_connected", "تم الاتصال الصوتي الحي بالشخصية الافتراضية.");
        }
      });
      channel.addEventListener("message", (messageEvent) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse(String(messageEvent.data)) as RealtimeEvent;
        } catch {
          return;
        }

        const type = event.type ?? "";
        if (type === "input_audio_buffer.speech_started") {
          onSpeakingChange?.(false);
        } else if (type === "response.audio.delta") {
          onSpeakingChange?.(true);
        } else if (type === "response.done") {
          onSpeakingChange?.(false);
          const transcript = assistantTranscriptRef.current.trim();
          if (transcript) {
            onTranscript({ role: "assistant", content: transcript.slice(0, 1800) });
            assistantTranscriptRef.current = "";
          }
        } else if (type === "conversation.item.input_audio_transcription.completed" && event.transcript?.trim()) {
          onTranscript({ role: "user", content: event.transcript.trim().slice(0, 1800) });
          onEvent?.("realtime_user_transcript", "تم توثيق النص المستخرج من كلام المتدرب.");
        } else if (type === "response.output_audio_transcript.delta" && typeof event.delta === "string") {
          assistantTranscriptRef.current += event.delta;
        } else if (type === "response.output_audio_transcript.done" && typeof event.transcript === "string") {
          assistantTranscriptRef.current = event.transcript;
        } else if (type === "error") {
          setError(event.error?.message || "أبلغت خدمة الصوت الحي عن خطأ.");
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (peer.iceGatheringState !== "complete") {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            peer.removeEventListener("icegatheringstatechange", onIceChange);
            reject(new Error("انتهت مهلة تجهيز اتصال النظارة. تحقق من الشبكة وحاول مجدداً."));
          }, 10000);
          const onIceChange = () => {
            if (peer.iceGatheringState !== "complete") return;
            window.clearTimeout(timeout);
            peer.removeEventListener("icegatheringstatechange", onIceChange);
            resolve();
          };
          peer.addEventListener("icegatheringstatechange", onIceChange);
          onIceChange();
        });
      }

      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error("تعذر إنشاء عرض WebRTC من المتصفح.");
      const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + tokenPayload.value,
          "Content-Type": "application/sdp",
        },
        body: sdp,
        cache: "no-store",
      });
      const answerSdp = await answerResponse.text();
      if (!answerResponse.ok) {
        throw new Error("رفضت خدمة Realtime بدء الاتصال (" + answerResponse.status + "). تحقق من النموذج وإعدادات الحساب.");
      }
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (cause) {
      cleanup();
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "تعذر تشغيل الصوت الحي.");
      onEvent?.("realtime_voice_failed", "فشل إنشاء الاتصال الصوتي الحي.");
    }
  }, [cleanup, onConnecting, onEvent, onSpeakingChange, onTranscript, scenario, status]);

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    microphoneRef.current?.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
    onMutedChange?.(nextMuted);
    onEvent?.("realtime_microphone_toggled", nextMuted ? "كتم ميكروفون الصوت الحي." : "إعادة فتح ميكروفون الصوت الحي.");
  }, [muted, onEvent, onMutedChange]);

  useEffect(() => {
    onControlsReady?.({
      start: () => { void start(); },
      stop,
      toggleMute,
    });
    return () => onControlsReady?.(null);
  }, [onControlsReady, start, stop, toggleMute]);

  return (
    <section className="simulation-realtime-voice" aria-label="المقابلة الصوتية الحية">
      <div className="simulation-realtime-copy">
        <div className="simulation-realtime-title"><Radio size={16} /><strong>محادثة صوتية حية ثنائية الاتجاه</strong><span className={status === "live" ? "is-live" : ""}>{status === "live" ? "متصل" : status === "connecting" ? "جارٍ الاتصال" : status === "error" ? "تعذر الاتصال" : "غير متصل"}</span></div>
        <small>تحدث بصورة طبيعية، والشخصية تستمع وترد بالصوت فوراً ويمكنك مقاطعتها أثناء الرد. تحتاج إلى OPENAI_API_KEY على الخادم.</small>
        {sessionId && <small className="simulation-realtime-session">جلسة: {sessionId}</small>}
      </div>
      <div className="simulation-realtime-actions">
        {status === "live" ? (
          <>
            <button type="button" onClick={toggleMute} className="simulation-realtime-muted">{muted ? <MicOff size={14} /> : <Mic size={14} />}{muted ? "فتح الميكروفون" : "كتم الميكروفون"}</button>
            <button type="button" onClick={stop} className="simulation-realtime-stop"><PhoneOff size={14} /> إنهاء الاتصال</button>
          </>
        ) : (
          <button type="button" onClick={() => void start()} disabled={status === "connecting"}><Phone size={14} /> {status === "connecting" ? "جارٍ الاتصال..." : status === "error" ? "إعادة المحاولة" : "ابدأ المقابلة الصوتية"}</button>
        )}
        <button type="button" className="simulation-realtime-volume" onClick={() => void audioRef.current?.play()}><Volume2 size={14} /> تشغيل صوت الشخصية</button>
      </div>
      {error && <p role="alert" className="simulation-realtime-error">{error}</p>}
      <audio ref={audioRef} autoPlay playsInline />
    </section>
  );
}
