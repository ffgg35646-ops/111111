"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, ClipboardCheck, ExternalLink, Headset, Mic, Monitor, ShieldCheck } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type RuntimeCheck = {
  checkedAt: string;
  secureContext: boolean;
  webxrApi: boolean;
  immersiveVr: boolean | null;
  microphoneApi: boolean;
  realtimeTransport: boolean;
  speechRecognition: boolean;
  speechSynthesis: boolean;
};

const acceptanceSteps = [
  "فتح المنصة من متصفح النظارة عبر HTTPS وتأكيد اكتشاف WebXR.",
  "السماح بالميكروفون واختبار العربية في التعرف على الكلام والصوت المنطوق.",
  "بدء اتصال Realtime والتأكد من سماع الحالة ومقاطعة الرد عند بدء الكلام.",
  "طرح أسئلة مختلفة والتأكد من أن الإجابات تتغير وفق ملف الحالة والسياق المخفي.",
  "التنقل بين خطوات التقييم والتفاعل مع اللوحة بوحدة التحكم أو تتبع اليد إذا كان متاحاً.",
  "إنهاء المقابلة والتأكد من حفظ المحادثة والروبريك والتقرير في حساب المتدرب.",
  "اختبار انقطاع الشبكة واستعادة الاتصال وراحة المستخدم ومعدل الإطارات قبل اعتماد الجهاز.",
];

export default function SimulationVrReadinessPage() {
  const [runtime, setRuntime] = useState<RuntimeCheck | null>(null);
  const [checking, setChecking] = useState(false);

  async function checkRuntime() {
    setChecking(true);
    try {
      const nav = navigator as Navigator & {
        xr?: { isSessionSupported?: (mode: "immersive-vr") => Promise<boolean> };
        mediaDevices?: { getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream> };
      };
      const speech = window as Window & {
        SpeechRecognition?: unknown;
        webkitSpeechRecognition?: unknown;
      };
      let immersiveVr: boolean | null = null;
      if (nav.xr?.isSessionSupported) {
        try {
          immersiveVr = await nav.xr.isSessionSupported("immersive-vr");
        } catch {
          immersiveVr = false;
        }
      }
      setRuntime({
        checkedAt: new Date().toLocaleString("ar-EG"),
        secureContext: window.isSecureContext,
        webxrApi: Boolean(nav.xr),
        immersiveVr,
        microphoneApi: Boolean(nav.mediaDevices?.getUserMedia),
        realtimeTransport: typeof window.RTCPeerConnection !== "undefined",
        speechRecognition: Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition),
        speechSynthesis: "speechSynthesis" in window,
      });
    } finally {
      setChecking(false);
    }
  }

  const rows = runtime ? [
    ["HTTPS / سياق آمن", runtime.secureContext, "WebXR والميكروفون يحتاجان عادةً إلى مصدر آمن."],
    ["WebXR API", runtime.webxrApi, "وجود الواجهة البرمجية في المتصفح."],
    ["Immersive VR", runtime.immersiveVr, "اختبار دعم جلسة immersive-vr من المتصفح الحالي."],
    ["واجهة الميكروفون", runtime.microphoneApi, "هذه نتيجة توفر API فقط، وليست موافقة على استخدام الميكروفون."],
    ["WebRTC", runtime.realtimeTransport, "المسار المستخدم للصوت الحي ثنائي الاتجاه."],
    ["التعرف على الكلام", runtime.speechRecognition, "يتعلق بتوافر التعرف الصوتي في المتصفح؛ قد تختلف جودة العربية."],
    ["الصوت المنطوق", runtime.speechSynthesis, "المسار الاحتياطي لنطق الردود."],
  ] as const : [];

  return <PlatformLayout title="جاهزية المحاكاة والواقع الافتراضي" description="فحص فعلي لقدرات المتصفح، وخيارات أجهزة Quest، ومتطلبات اعتماد تجربة المقابلة قبل الشراء أو التعاقد.">
    <section className="portal-card" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className="track-icon"><Headset size={22}/></span>
        <div><h2 style={{ margin: 0 }}>اختبار المتصفح الحالي</h2><p style={{ margin: "4px 0 0" }}>الاختبار يقرأ قدرات المتصفح الذي فتح هذه الصفحة. لا يمنح شهادة توافق لطراز نظارة لم يتم اختباره على الجهاز نفسه.</p></div>
      </div>
      <button className="portal-button" type="button" disabled={checking} onClick={() => void checkRuntime()}>{checking ? "جارٍ فحص المتصفح..." : "اختبر WebXR والصوت على هذا الجهاز"}</button>
      {runtime && <div style={{ display: "grid", gap: 8 }}>
        <small style={{ color: "#71848a" }}>آخر فحص: {runtime.checkedAt}</small>
        {rows.map(([label, value, note]) => <div key={label} style={{ display: "flex", gap: 9, justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e7edef", padding: "8px 0" }}>
          <div style={{ display: "grid", gap: 3 }}><strong style={{ fontSize: 12 }}>{label}</strong><small style={{ color: "#7b8c91" }}>{note}</small></div>
          <span style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", color: value === true ? "#16836f" : value === false ? "#a65d42" : "#8b7b54", fontSize: 11, fontWeight: 700 }}>
            {value === true ? <CheckCircle2 size={16}/> : <CircleAlert size={16}/>}
            {value === true ? "متاح" : value === false ? "غير متاح" : "لم يُحسم"}
          </span>
        </div>)}
        <div className="portal-callout">لا يطلب الفحص إذن الميكروفون ولا يبدأ جلسة صوت. نتيجة WebXR تعكس المتصفح الحالي فقط؛ يجب فتح الرابط نفسه داخل Quest Browser لتقييم النظارة.</div>
      </div>}
    </section>

    <div className="portal-section-title"><div><h2>ما الذي يعمل في نسخة الويب الحالية؟</h2><p>المكونات الموجودة في المشروع، وما تتطلبه من إعداد قبل التشغيل</p></div></div>
    <div className="portal-grid">
      <article className="portal-card"><Monitor size={21} color="#188579"/><h3>قاعة ثلاثية الأبعاد</h3><p>غرفة مقابلة Three.js / React Three Fiber بلوحات مكانية وخيارات تقييم وشخصية افتراضية. تتضمن طبقة WebXR للعرض الغامر عند دعم المتصفح والجهاز.</p><small>موجودة في المشروع؛ لم يثبت اختبارها بعد على نظارة فعلية.</small></article>
      <article className="portal-card"><Mic size={21} color="#188579"/><h3>مقابلة نصية وصوتية</h3><p>محادثة نصية مع نموذج AI، وصوت حي ثنائي الاتجاه عبر WebRTC عند إعداد Realtime API، مع مسار متناوب يستخدم SpeechRecognition وSpeechSynthesis.</p><small>الصوت الحي يحتاج OPENAI_API_KEY، والمسار النصي يحتاج AI_GATEWAY_API_KEY أو بيئة Vercel المضبوطة.</small></article>
      <article className="portal-card"><ClipboardCheck size={21} color="#188579"/><h3>تقرير أداء قابل للمراجعة</h3><p>اختيارات السيناريو، صياغة الحالة، نص الحوار، روبريك بإصدار محفوظ، تحليل نقاط القوة والتحسين، ثم مراجعة بشرية مستقلة من المدرب.</p><small>الحفظ يحتاج MongoDB، والتحليل الآلي يحتاج خدمة AI مهيأة. حكم المشرف البشري يظل منفصلاً.</small></article>
    </div>

    <div className="portal-section-title"><div><h2>أجهزة مناسبة لمرحلة التجربة</h2><p>أسعار رصد سوقي إرشادية في مصر وليست عرض شراء أو سعراً مضموناً</p></div></div>
    <div className="portal-grid">
      <article className="portal-card">
        <span className="portal-chip">خيار اقتصادي للتجربة الأولى</span>
        <h3>Meta Quest 3S — 128GB</h3>
        <strong style={{ fontSize: 22, color: "#167d72" }}>23,999 جنيه مصري</strong>
        <p>رصد Carrefour Egypt، والمنتج معروض من بائع طرف ثالث (D Tech Store). شاشة 1832×1920 لكل عين وعدسات Fresnel؛ خيار أقل كلفة لاختبار سير العمل.</p>
        <a href="https://www.carrefouregypt.com/mafegy/en/gaming-headset/meta-quest-3s-128gb-white/p/2251857000745" target="_blank" rel="noreferrer">تحقق من السعر والمخزون لدى Carrefour <ExternalLink size={13}/></a>
        <small>السعر والمخزون والتوصيل والضمان تتغير وقد تختلف حسب البائع والمنطقة.</small>
      </article>
      <article className="portal-card">
        <span className="portal-chip">اختيار أفضل للوضوح البصري</span>
        <h3>Meta Quest 3 — 512GB</h3>
        <strong style={{ fontSize: 22, color: "#167d72" }}>من 35,999 جنيه مصري</strong>
        <p>رصد PriceTeq لأسعار مصر من متاجر متعددة. دقة 2064×2208 لكل عين وعدسات Pancake و4K+ Infinite Display؛ خيار أنسب لمراجعة تفاصيل المشهد والقراءة داخل النظارة.</p>
        <a href="https://priceteq.com/eg/product/6e21be15-20ab-4e6c-8854-2ab468b57e55" target="_blank" rel="noreferrer">راجع مقارنة الأسعار والمخزون <ExternalLink size={13}/></a>
        <small>السعر المرصود الأدنى ليس ضماناً للتوفر أو الضمان المحلي.</small>
      </article>
    </div>
    <div className="portal-callout"><ShieldCheck size={16}/> كلا الجهازين يوفّران تتبع الرأس واليد ووحدات التحكم وفق مواصفات Meta. هذا لا يعني أن مشروع ETZAN اجتاز اعتماد الجهاز؛ التوافق النهائي يحتاج جلسة اختبار فعلية على نفس الطراز وإصدار النظام والمتصفح.</div>

    <section className="portal-card" style={{ marginTop: 18 }}>
      <h2>مقارنة سريعة قبل الشراء</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540, fontSize: 12 }}>
          <thead><tr><th style={{ textAlign: "right", padding: 10 }}>البند</th><th style={{ textAlign: "right", padding: 10 }}>Quest 3S 128GB</th><th style={{ textAlign: "right", padding: 10 }}>Quest 3 512GB</th></tr></thead>
          <tbody>
            <tr><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>دقة كل عين</td><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>1832×1920</td><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>2064×2208</td></tr>
            <tr><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>العدسات</td><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>Fresnel</td><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>Pancake</td></tr>
            <tr><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>المعالج والذاكرة</td><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>XR2 Gen 2 · 8GB</td><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>XR2 Gen 2 · 8GB</td></tr>
            <tr><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>السعر المرصود</td><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>23,999 EGP</td><td style={{ padding: 10, borderTop: "1px solid #e7edef" }}>35,999 EGP وما فوق</td></tr>
          </tbody>
        </table>
      </div>
      <p style={{ marginBottom: 0 }}>مصدر المواصفات: <a href="https://www.meta.com/quest/compare/" target="_blank" rel="noreferrer">مقارنة Meta الرسمية</a>. يلزم شراء نظارة واحدة أولاً كجهاز تجريبي قبل شراء دفعة للمؤسسة.</p>
    </section>

    <div className="portal-section-title"><div><h2>ما الذي يلزم لتشغيل VR أصلي؟</h2><p>المشروع الأصلي موجود كمصدر C++/OpenXR، لكنه ليس APK أو نسخة Windows جاهزة</p></div></div>
    <section className="portal-card">
      <div style={{ display: "grid", gap: 10 }}>
        <p><b>المتاح بالمستودع:</b> Unreal project source، VR Pawn، HMD tracking، وحدات تحكم، محاولة hand tracking عبر OpenXR، غرفة مقابلة، وقناة Telemetry مؤمنة إلى المنصة.</p>
        <p><b>المطلوب قبل تسليم تطبيق Quest:</b> Unreal Engine 5.8، Visual Studio مع C++ workload، Android SDK/NDK وJava toolchain وفق نسخة المحرك، إعداد OpenXR/Meta XR، تعيين شخصية Skeletal Mesh/Blueprint مرخصة، Build/Package APK، توقيع وتجربة التثبيت على الجهاز.</p>
        <p><b>حد معروف:</b> محادثة Realtime الصوتية الموجودة في الويب لم تُدمج بعد داخل تطبيق Unreal الأصلي. تحتاج Unreal audio/WebRTC integration واختبار الميكروفون والصوت المكاني منفصلين. اتصال telemetry لا يعادل اتصال الصوت.</p>
        <p><b>الترخيص والتكلفة:</b> سعر النظارة وحده لا يشمل تطوير تطبيق Unreal أو ترخيص الشخصية أو تجهيز مشهد أو دعم فني أو ملحقات. لا يوجد عرض سعر موثق لتلك الأعمال بعد؛ لا ينبغي التعاقد عليها قبل تحديد نطاق العمل واختبار نموذج أولي.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <a href="https://developers.meta.com/vr/documentation/web/webxr-overview/" target="_blank" rel="noreferrer">دليل WebXR الرسمي <ExternalLink size={13}/></a>
          <a href="https://developers.meta.com/vr/documentation/unreal/unreal-quick-start-install-unreal-engine/" target="_blank" rel="noreferrer">تجهيز Unreal وQuest <ExternalLink size={13}/></a>
          <a href="https://developers.meta.com/vr/documentation/unreal/unreal-ide-guide-android/" target="_blank" rel="noreferrer">بناء وتغليف APK للأجهزة <ExternalLink size={13}/></a>
        </div>
      </div>
    </section>

    <section className="portal-card" style={{ marginTop: 18 }}>
      <h2>اختبار القبول قبل اعتماد الجهاز</h2>
      <ol style={{ lineHeight: 2, paddingInlineStart: 22 }}>
        {acceptanceSteps.map((item) => <li key={item}>{item}</li>)}
      </ol>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <Link className="portal-button" href="/simulation">فتح غرفة المحاكاة</Link>
        <Link className="portal-button secondary" href="/simulation/manage">إدارة السيناريوهات والمعايير</Link>
        <Link className="portal-button secondary" href="/platform-admin/activities">مراجعة تقارير المتدربين</Link>
      </div>
    </section>
  </PlatformLayout>;
}
