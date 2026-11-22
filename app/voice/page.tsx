"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, AudioLines, Bot, CircleAlert, LoaderCircle, Mic, MicOff,
  Pause, Send, ShieldCheck, Square, UserRound, Video, Volume2, VolumeX,
} from "lucide-react";
import "./voice.css";

type Message = { role: "user" | "assistant"; content: string; id: number };
type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative };
type RecognitionEvent = Event & { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = Event & { error: string };
type RecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => RecognitionInstance;
  webkitSpeechRecognition?: new () => RecognitionInstance;
};

function VoiceAgentWorkspace() {
  const params = useSearchParams();
  const [scenario, setScenario] = useState(() => params.get("scenario")?.slice(0, 5000) ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recognition = useRef<RecognitionInstance | null>(null);
  const aborter = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);

  useEffect(() => () => {
    recognition.current?.abort();
    aborter.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, interim]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const chunks = text.match(/[^.!؟?]+[.!؟?]*/g) ?? [text];
    chunks.filter((chunk) => chunk.trim()).forEach((chunk) => {
      const utterance = new SpeechSynthesisUtterance(chunk.trim());
      utterance.lang = "ar-SA";
      utterance.rate = 0.94;
      utterance.pitch = 1;
      const voices = window.speechSynthesis.getVoices();
      const arabic = voices.find((voice) => voice.lang.toLowerCase().startsWith("ar-sa"))
        ?? voices.find((voice) => voice.lang.toLowerCase().startsWith("ar"));
      if (arabic) utterance.voice = arabic;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(window.speechSynthesis.speaking);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    });
  }, [voiceEnabled]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    stopSpeaking();
    setError("");
    setDraft("");
    setInterim("");
    const next = [...messages, { role: "user" as const, content: text, id: nextId.current++ }];
    setMessages(next);
    setBusy(true);
    const assistantId = nextId.current++;
    setMessages([...next, { role: "assistant", content: "", id: assistantId }]);
    const controller = new AbortController();
    aborter.current = controller;
    try {
      const response = await fetch("/api/clinical-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, messages: next.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "تعذر الاتصال بالطبيب الافتراضي.");
      }
      if (!response.body) throw new Error("لم يصل رد من خدمة المحادثة.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: answer } : message));
      }
      answer += decoder.decode();
      if (!answer.trim()) throw new Error("وصل رد فارغ من الطبيب الافتراضي.");
      setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: answer } : message));
      speak(answer);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const message = cause instanceof Error ? cause.message : "حدث خطأ غير متوقع.";
      setError(message);
      setMessages((current) => current.filter((item) => item.id !== assistantId));
    } finally {
      setBusy(false);
      aborter.current = null;
    }
  }, [busy, messages, scenario, speak, stopSpeaking]);

  const startListening = () => {
    stopSpeaking();
    const speechWindow = window as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setError("التعرف الصوتي غير مدعوم في هذا المتصفح. استخدم الكتابة أو افتح الصفحة في متصفح يدعم التعرف على الكلام.");
      return;
    }
    setError("");
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = "ar-SA";
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let finalText = "";
      let partial = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript + " ";
        else partial += result[0].transcript;
      }
      if (finalText) setDraft((current) => (current ? current + " " : "") + finalText.trim());
      setInterim(partial);
    };
    instance.onerror = (event) => {
      setError(event.error === "not-allowed"
        ? "لم يتم السماح باستخدام الميكروفون. فعّل إذن الميكروفون من إعدادات المتصفح."
        : "تعذر التقاط الصوت: " + event.error);
      setListening(false);
    };
    instance.onend = () => { setListening(false); setInterim(""); };
    try { instance.start(); setListening(true); }
    catch { setError("تعذر تشغيل الميكروفون."); }
  };

  const stopListening = () => {
    recognition.current?.stop();
    setListening(false);
    setInterim("");
  };

  const reset = () => {
    recognition.current?.abort();
    aborter.current?.abort();
    stopSpeaking();
    setMessages([]);
    setDraft("");
    setInterim("");
    setError("");
    setBusy(false);
    setListening(false);
  };

  return (
    <main className="voice-workspace" dir="rtl">
      <header className="voice-topbar">
        <Link href="/characters" className="voice-back"><ArrowRight size={17} /> العودة للطبيب الافتراضي</Link>
        <div className="voice-top-state"><span className="voice-green-dot" /> طبيب نفسي افتراضي سعودي</div>
        <Link href="/supervision" className="voice-reset"><Video size={14} /> غرفة إشراف مشتركة</Link>
        <button className="voice-reset" onClick={reset}><Square size={13} /> إنهاء الجلسة</button>
      </header>

      <div className="voice-main">
        <div className="voice-title-row">
          <div>
            <div className="voice-eyebrow"><AudioLines size={15} /> المحادثة التعليمية الذكية</div>
            <h1>محادثة مع الطبيب النفسي الافتراضي السعودي</h1>
            <p>طبيب واحد ثابت يشرح المفاهيم، يدربك على المقابلة، ويرشدك في دراسة الحالة والمقاييس.</p>
          </div>
          <div className="voice-secure"><ShieldCheck size={16} /> لا يتم حفظ التسجيل الصوتي في هذه الواجهة</div>
        </div>

        <section className="doctor-chat-identity">
          <div className="agent-avatar"><UserRound size={22} /></div>
          <div><strong>الطبيب النفسي الافتراضي السعودي</strong><small>مدرب سريري ومشرف تعليمي · الهوية لا تتغير بين الحالات</small></div>
        </section>

        <div className="voice-layout">
          <section className="conversation-card">
            <div className="conversation-header">
              <div className="agent-avatar"><UserRound size={22} /></div>
              <div><strong>الطبيب النفسي السعودي</strong><small>المتحدث الافتراضي الثابت</small></div>
              <span className="agent-online"><i /> جاهز للمحادثة</span>
            </div>
            <div className="conversation-feed" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="conversation-welcome">
                  <div className="welcome-symbol"><AudioLines size={28} /></div>
                  <h2>ابدأ الحوار مع الطبيب</h2>
                  <p>اطلب منه شرح مفهوم، أو ناقش خطوة في دراسة الحالة، أو تدرب على المقابلة والتفكير الإكلينيكي.</p>
                  <div className="suggested-prompts">
                    {["علمني كيف أبدأ المقابلة السريرية", "كيف أفرق بين الملاحظة والفرضية؟", "اشرح لي صياغة الحالة في CBT"].map((prompt) => <button key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <div key={message.id} className={"chat-message " + message.role}>
                  <div className="message-avatar">{message.role === "user" ? <UserRound size={15} /> : <Bot size={15} />}</div>
                  <div className="message-content"><span>{message.role === "user" ? "أنت" : "الطبيب الافتراضي"}</span><p>{message.content || "يكتب الطبيب رده الآن..."}</p></div>
                </div>
              ))}
              {interim && <div className="interim-text">يتم التعرف على كلامك: {interim}</div>}
              {busy && <div className="agent-thinking"><LoaderCircle size={15} /> الطبيب يجهّز الشرح...</div>}
            </div>
            {error && <div className="voice-error"><CircleAlert size={16} />{error}</div>}
            <div className="voice-composer">
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(draft); } }} placeholder="اكتب سؤالك أو اضغط الميكروفون وتحدث..." rows={2} />
              <div className="composer-actions">
                <div className="composer-left">
                  <button className={"mic-button " + (listening ? "recording" : "")} onClick={listening ? stopListening : startListening} disabled={busy} title={listening ? "إيقاف الاستماع" : "ابدأ التحدث"}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>
                  <button className={"sound-toggle " + (!voiceEnabled ? "muted" : "")} onClick={() => { setVoiceEnabled((value) => !value); stopSpeaking(); }} title={voiceEnabled ? "إيقاف الصوت" : "تفعيل الصوت"}>{voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
                  {speaking && <button className="sound-toggle" onClick={stopSpeaking}><Pause size={16} /> إيقاف الصوت</button>}
                </div>
                <div className="composer-right">
                  {busy && <button className="stop-response" onClick={() => aborter.current?.abort()}>إيقاف الرد</button>}
                  <button className="send-button" onClick={() => void send(draft)} disabled={!draft.trim() || busy}><Send size={16} /> إرسال</button>
                </div>
              </div>
            </div>
          </section>

          <aside className="voice-side">
            <section className="voice-panel">
              <div className="panel-heading"><ShieldCheck size={17} /><div><strong>هوية الطبيب</strong><small>شخصية واحدة لجميع المسارات</small></div></div>
              <div className="doctor-profile-card">
                <b>طبيب نفسي افتراضي سعودي</b>
                <p>مدرب في مهارات المقابلة، دراسة الحالة، CBT، الاضطرابات النمائية، طيف التوحد والخدمة الاجتماعية.</p>
                <small>لا يتقمص دور المريض ولا يصدر تشخيصاً رسمياً.</small>
              </div>
            </section>
            <section className="voice-panel">
              <div className="panel-heading"><Settings2 size={17} /><div><strong>سياق الجلسة</strong><small>يمكن تمرير حالة أو مادة تعليمية من المنصة</small></div></div>
              <textarea className="scenario-field" value={scenario} onChange={(event) => setScenario(event.target.value)} placeholder="أضف ملخص الحالة أو المادة العلمية التي تريد من الطبيب استخدامها..." rows={6} />
              <small className="scenario-hint">لا تستخدم بيانات تعريفية حقيقية للمرضى. هذه المعلومات ترسل إلى مزود نموذج الذكاء الاصطناعي عند كل رسالة. لا يدّعي الطبيب الاطلاع على ملفات لم تُرفق في السياق.</small>
            </section>
            <section className="voice-panel voice-rules">
              <div className="panel-heading"><ShieldCheck size={17} /><div><strong>ضوابط المحاكاة</strong><small>تُطبق على الطبيب الافتراضي</small></div></div>
              <ul><li>الرد باللهجة السعودية البيضاء.</li><li>التدريب على جمع الأدلة وصياغة الفرضيات.</li><li>عدم اختراع معلومات أو مراجع.</li><li>عدم إصدار تشخيص رسمي أو وصف علاج.</li><li>إيقاف التدريب عند ظهور خطر حاد وطلب تدخل المشرف.</li></ul>
            </section>
          </aside>
        </div>
        <footer className="voice-footnote">المحادثة مخصصة للتدريب والمحاكاة، وليست خدمة تشخيص أو علاج. الصوت في هذه الصفحة يستخدم ميزة النطق في المتصفح؛ الاتصال الصوتي الحي المخصص للمحاكاة متاح في قاعة المحاكاة عند إعداد مفتاح Realtime.</footer>
      </div>
    </main>
  );
}

export default function VoiceAgentPage() {
  return <Suspense fallback={<main className="voice-workspace" dir="rtl">تحميل الطبيب الافتراضي...</main>}><VoiceAgentWorkspace /></Suspense>;
}
