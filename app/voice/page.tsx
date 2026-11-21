"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, AudioLines, Bot, Check, CircleAlert, LoaderCircle, Mic, MicOff, Pause, Send, Settings2, ShieldCheck, Square, UserRound, Video, Volume2, VolumeX } from "lucide-react";
import "./voice.css";

type PersonaId = "father" | "mother" | "child" | "teen";
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

const personas: { id: PersonaId; name: string; role: string; description: string }[] = [
  { id:"father",name:"الأب السعودي",role:"ولي أمر / مرافق",description:"رجل سعودي يتحدث بصفته أباً يرافق أحد أفراد أسرته." },
  { id:"mother",name:"الأم السعودية",role:"ولية أمر / مرافقة",description:"امرأة سعودية تتحدث عن تجربتها وما تعرفه عن الحالة." },
  { id:"child",name:"الطفل السعودي",role:"طفل افتراضي",description:"طفل يتحدث بجمل قصيرة ومفردات مناسبة لعمره." },
  { id:"teen",name:"المراهق السعودي",role:"مراجع مراهق",description:"مراهق يحتاج إلى حوار هادئ وبناء الثقة." },
];

export default function VoiceAgentPage() {
  const [persona,setPersona] = useState<PersonaId>("father");
  const [scenario,setScenario] = useState("");
  const [messages,setMessages] = useState<Message[]>([]);
  const [draft,setDraft] = useState("");
  const [busy,setBusy] = useState(false);
  const [listening,setListening] = useState(false);
  const [speaking,setSpeaking] = useState(false);
  const [voiceEnabled,setVoiceEnabled] = useState(true);
  const [interim,setInterim] = useState("");
  const [error,setError] = useState("");
  const [supported,setSupported] = useState(true);
  const recognition = useRef<RecognitionInstance | null>(null);
  const aborter = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);
  const activePersona = personas.find(item=>item.id===persona)!;

  useEffect(()=>{
    const speechWindow=window as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition));

    const params=new URLSearchParams(window.location.search);
    const incomingPersona=params.get("persona");
    const incomingScenario=params.get("scenario");
    if(incomingPersona&&personas.some(item=>item.id===incomingPersona)){
      setPersona(incomingPersona as PersonaId);
    }
    if(incomingScenario){
      setScenario(incomingScenario.slice(0,5000));
    }

    return ()=>{recognition.current?.abort();aborter.current?.abort();window.speechSynthesis?.cancel();};
  },[]);

  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"});},[messages,interim]);

  const stopSpeaking = useCallback(()=>{
    window.speechSynthesis?.cancel();setSpeaking(false);
  },[]);

  const speak = useCallback((text:string)=>{
    if(!voiceEnabled||!("speechSynthesis" in window))return;
    window.speechSynthesis.cancel();
    const chunks=text.match(/[^.!؟?]+[.!؟?]*/g) ?? [text];
    chunks.filter(chunk=>chunk.trim()).forEach(chunk=>{
      const utterance=new SpeechSynthesisUtterance(chunk.trim());
      utterance.lang="ar-SA";utterance.rate=0.94;utterance.pitch=1;
      const voices=window.speechSynthesis.getVoices();
      const arabic=voices.find(voice=>voice.lang.toLowerCase().startsWith("ar-sa"))??voices.find(voice=>voice.lang.toLowerCase().startsWith("ar"));
      if(arabic)utterance.voice=arabic;
      utterance.onstart=()=>setSpeaking(true);
      utterance.onend=()=>setSpeaking(window.speechSynthesis.speaking);
      utterance.onerror=()=>setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    });
  },[voiceEnabled]);

  const send = useCallback(async (raw:string)=>{
    const text=raw.trim();
    if(!text||busy)return;
    stopSpeaking();setError("");setDraft("");setInterim("");
    const next=[...messages,{role:"user" as const,content:text,id:nextId.current++}];
    setMessages(next);setBusy(true);
    const assistantId=nextId.current++;
    setMessages([...next,{role:"assistant",content:"",id:assistantId}]);
    const controller=new AbortController();aborter.current=controller;
    try{
      const response=await fetch("/api/clinical-agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({personaId:persona,scenario,messages:next.map(({role,content})=>({role,content}))}),signal:controller.signal});
      if(!response.ok){
        const payload=await response.json().catch(()=>({}));
        throw new Error(payload.error||"تعذر الاتصال بوكيل المحادثة.");
      }
      if(!response.body)throw new Error("لم يصل رد من خدمة المحادثة.");
      const reader=response.body.getReader();const decoder=new TextDecoder();let answer="";
      while(true){
        const {done,value}=await reader.read();if(done)break;
        answer+=decoder.decode(value,{stream:true});
        setMessages(current=>current.map(message=>message.id===assistantId?{...message,content:answer}:message));
      }
      answer+=decoder.decode();
      if(!answer.trim())throw new Error("وصل رد فارغ من وكيل المحادثة.");
      setMessages(current=>current.map(message=>message.id===assistantId?{...message,content:answer}:message));
      speak(answer);
    }catch(cause){
      if(cause instanceof Error&&cause.name==="AbortError")return;
      const message=cause instanceof Error?cause.message:"حدث خطأ غير متوقع.";
      setError(message);setMessages(current=>current.filter(item=>item.id!==assistantId));
    }finally{setBusy(false);aborter.current=null;}
  },[busy,messages,persona,scenario,speak,stopSpeaking]);

  const startListening=()=>{
    stopSpeaking();
    const speechWindow=window as SpeechWindow;
    const Constructor=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
    if(!Constructor){setError("التعرف الصوتي غير مدعوم في هذا المتصفح. استخدم الكتابة أو افتح الصفحة في متصفح يدعم التعرف على الكلام.");return;}
    setError("");const instance=new Constructor();recognition.current=instance;
    instance.lang="ar-SA";instance.continuous=true;instance.interimResults=true;
    instance.onresult=(event)=>{
      let finalText="",partial="";
      for(let i=event.resultIndex;i<event.results.length;i++){
        const result=event.results[i];
        if(result.isFinal)finalText+=result[0].transcript+" ";
        else partial+=result[0].transcript;
      }
      if(finalText)setDraft(current=>(current?current+" ":"")+finalText.trim());
      setInterim(partial);
    };
    instance.onerror=(event)=>{setError(event.error==="not-allowed"?"لم يتم السماح باستخدام الميكروفون. فعّل إذن الميكروفون من إعدادات المتصفح.":"تعذر التقاط الصوت: "+event.error);setListening(false);};
    instance.onend=()=>{setListening(false);setInterim("");};
    try{instance.start();setListening(true);}catch{setError("تعذر تشغيل الميكروفون.");}
  };

  const stopListening=()=>{recognition.current?.stop();setListening(false);setInterim("");};
  const reset=()=>{recognition.current?.abort();aborter.current?.abort();stopSpeaking();setMessages([]);setDraft("");setInterim("");setError("");setBusy(false);setListening(false);};

  return <main className="voice-workspace" dir="rtl">
    <header className="voice-topbar"><Link href="/characters" className="voice-back"><ArrowRight size={17}/> العودة للشخصيات</Link><div className="voice-top-state"><span className="voice-green-dot"/> وكيل محادثة سريري</div><Link href="/supervision" className="voice-reset"><Video size={14}/> غرفة إشراف مشتركة</Link><button className="voice-reset" onClick={reset}><Square size={13}/> إنهاء الجلسة</button></header>
    <div className="voice-main">
      <div className="voice-title-row"><div><div className="voice-eyebrow"><AudioLines size={15}/> المحاكاة الصوتية الذكية</div><h1>محادثة حرة مع الشخصية الافتراضية</h1><p>تحدث بصوتك، واستمع إلى رد الشخصية، وتابع الحوار بصورة طبيعية.</p></div><div className="voice-secure"><ShieldCheck size={16}/> لا يتم حفظ التسجيل الصوتي في هذه الواجهة</div></div>
      <div className="voice-layout">
        <section className="conversation-card">
          <div className="conversation-header"><div className="agent-avatar"><UserRound size={22}/></div><div><strong>{activePersona.name}</strong><small>{activePersona.role} · شخصية محاكاة</small></div><span className="agent-online"><i/> جاهز للمحادثة</span></div>
          <div className="conversation-feed" ref={scrollRef}>
            {messages.length===0&&<div className="conversation-welcome"><div className="welcome-symbol"><AudioLines size={28}/></div><h2>ابدأ الحوار مع {activePersona.name}</h2><p>{activePersona.description} اطرح أسئلة مفتوحة وتابع الإجابات كما تفعل في مقابلة سريرية.</p><div className="suggested-prompts">{["ممكن تحكي لي إيش اللي جابكم اليوم؟","متى بدأت المشكلة؟","كيف أثرت الحالة على حياتكم اليومية؟"].map(prompt=><button key={prompt} onClick={()=>setDraft(prompt)}>{prompt}</button>)}</div></div>}
            {messages.map(message=><div key={message.id} className={"chat-message "+message.role}><div className="message-avatar">{message.role==="user"?<UserRound size={15}/>:<Bot size={15}/>}</div><div className="message-content"><span>{message.role==="user"?"أنت":"الشخصية الافتراضية"}</span><p>{message.content||"يكتب الرد الآن..."}</p></div></div>)}
            {interim&&<div className="interim-text">يتم التعرف على كلامك: {interim}</div>}
            {busy&&<div className="agent-thinking"><LoaderCircle size={15}/> الشخصية تفكر في الرد...</div>}
          </div>
          {error&&<div className="voice-error"><CircleAlert size={16}/>{error}</div>}
          <div className="voice-composer"><textarea value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void send(draft);}}} placeholder="اكتب رسالتك أو اضغط الميكروفون وتحدث..." rows={2}/><div className="composer-actions"><div className="composer-left"><button className={"mic-button "+(listening?"recording":"")} onClick={listening?stopListening:startListening} disabled={busy} title={listening?"إيقاف الاستماع":"ابدأ التحدث"}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button><button className={"sound-toggle "+(!voiceEnabled?"muted":"")} onClick={()=>{setVoiceEnabled(value=>!value);stopSpeaking();}} title={voiceEnabled?"إيقاف الصوت":"تفعيل الصوت"}>{voiceEnabled?<Volume2 size={17}/>:<VolumeX size={17}/>}</button>{speaking&&<button className="sound-toggle" onClick={stopSpeaking}><Pause size={16}/> إيقاف الصوت</button>}</div><div className="composer-right">{busy&&<button className="stop-response" onClick={()=>aborter.current?.abort()}>إيقاف الرد</button>}<button className="send-button" onClick={()=>void send(draft)} disabled={!draft.trim()||busy}><Send size={16}/> إرسال</button></div></div>
          </div>
          {!supported&&<div className="browser-note">التعرف على الكلام غير متاح في هذا المتصفح؛ يمكنك الكتابة، وسيعمل الصوت المنطوق إذا كان مدعوماً.</div>}
        </section>
        <aside className="voice-side">
          <section className="voice-panel"><div className="panel-heading"><UserRound size={17}/><div><strong>اختيار الشخصية</strong><small>حدد الطرف الذي ستجري معه المقابلة</small></div></div><div className="persona-options">{personas.map(item=><button key={item.id} className={persona===item.id?"chosen":""} onClick={()=>{setPersona(item.id);reset();}}><span className="persona-icon"><UserRound size={17}/></span><span><b>{item.name}</b><small>{item.role}</small></span>{persona===item.id&&<Check size={16}/>}</button>)}</div></section>
          <section className="voice-panel"><div className="panel-heading"><Settings2 size={17}/><div><strong>سياق الحالة التدريبية</strong><small>يحدده المشرف قبل بدء المحاكاة</small></div></div><textarea className="scenario-field" value={scenario} onChange={event=>setScenario(event.target.value)} placeholder="اكتب ملخص الحالة، المعلومات المعروفة للشخصية، والمعلومات التي لا تكشف إلا عند السؤال المناسب..." rows={6}/><small className="scenario-hint">لا تستخدم بيانات تعريفية حقيقية للمرضى. هذه المعلومات ترسل إلى مزود نموذج الذكاء الاصطناعي عند كل رسالة.</small></section>
          <section className="voice-panel voice-rules"><div className="panel-heading"><ShieldCheck size={17}/><div><strong>ضوابط المحاكاة</strong><small>مفعّلة في وكيل الحوار</small></div></div><ul><li>الرد باللهجة السعودية البيضاء.</li><li>عدم اختراع تفاصيل طبية غير موجودة.</li><li>كشف المعلومات حسب أسئلة المتدرب.</li><li>عدم إصدار تشخيص أو وصف علاج.</li><li>إيقاف التمثيل عند ظهور خطر حاد وطلب تدخل المشرف.</li></ul></section>
        </aside>
      </div>
      <footer className="voice-footnote">المحادثة مخصصة للتدريب والمحاكاة، وليست خدمة تشخيص أو علاج. جودة التعرف على الصوت والصوت المنطوق تعتمد على دعم المتصفح والأصوات المثبتة على الجهاز.</footer>
    </div>
  </main>;
}
