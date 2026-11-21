"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, CameraOff, Eye, Gauge, Info, ShieldCheck, UserRound, Video } from "lucide-react";
import { FaceLandmarker, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import "./posture.css";

type Metric = { label: string; value: string; detail: string; tone: "good" | "warn" | "neutral" };
type VisionLandmark = { x: number; y: number; z?: number; visibility?: number };
type PoseResult = { landmarks: VisionLandmark[][] };
type FaceResult = { faceLandmarks: VisionLandmark[][] };

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function angleFromVertical(dx: number, dy: number) {
  return Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI;
}
function metricTone(value: number, good: number, warning: number): Metric["tone"] {
  return value <= good ? "good" : value <= warning ? "warn" : "neutral";
}

export default function PostureAssessmentPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const faceRef = useRef<FaceLandmarker | null>(null);
  const lastVideoTime = useRef(-1);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: "استقامة الجذع", value: "بانتظار الكاميرا", detail: "يظهر بعد رصد الكتفين والوركين", tone: "neutral" },
    { label: "ميل الرأس", value: "بانتظار الكاميرا", detail: "يظهر بعد رصد الوجه والكتفين", tone: "neutral" },
    { label: "اتجاه النظر", value: "بانتظار الكاميرا", detail: "تقدير بصري تقريبي لاتجاه الوجه والعينين", tone: "neutral" },
    { label: "المسافة من الكاميرا", value: "غير معايرة", detail: "تقدير نسبي لحجم الوجه داخل الإطار", tone: "neutral" },
  ]);
  const [deviceTilt, setDeviceTilt] = useState("غير متاح");
  const [cameraNote, setCameraNote] = useState("ضع الكاميرا أمامك بحيث يظهر الرأس والكتفان والجزء العلوي من الجسم.");

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    poseRef.current?.close();
    faceRef.current?.close();
    poseRef.current = null;
    faceRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }, []);

  const analyze = useCallback(() => {
    const video = videoRef.current;
    const pose = poseRef.current;
    const face = faceRef.current;
    if (!video || !pose || !face || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(analyze);
      return;
    }
    if (video.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = video.currentTime;
      const timestamp = performance.now();
      const poseResult = pose.detectForVideo(video, timestamp) as PoseResult;
      const faceResult = face.detectForVideo(video, timestamp) as FaceResult;
      const body = poseResult.landmarks?.[0];
      const facePoints = faceResult.faceLandmarks?.[0];
      const next: Metric[] = [];

      if (body && body.length > 24 && (body[11]?.visibility ?? 0) > 0.35 && (body[12]?.visibility ?? 0) > 0.35) {
        const shoulderMid = { x: (body[11].x + body[12].x) / 2, y: (body[11].y + body[12].y) / 2 };
        const hipMid = { x: (body[23].x + body[24].x) / 2, y: (body[23].y + body[24].y) / 2 };
        const shoulderTilt = Math.atan2(Math.abs(body[12].y - body[11].y), Math.abs(body[12].x - body[11].x)) * 180 / Math.PI;
        const torsoLean = angleFromVertical(shoulderMid.x - hipMid.x, hipMid.y - shoulderMid.y);
        const asymmetry = Math.min(90, Math.abs(shoulderTilt));
        const combined = Math.max(torsoLean, asymmetry);
        next.push({
          label: "استقامة الجذع والكتفين",
          value: combined < 8 ? "متوازن تقريباً" : combined < 17 ? "ميل بسيط" : "ميل ملحوظ",
          detail: `انحراف هندسي تقريبي ${combined.toFixed(0)}° — يعتمد على وضع الكاميرا وظهور الجسم`,
          tone: metricTone(combined, 8, 17),
        });
        const nose = body[0];
        const earMid = body[7] && body[8] ? { x: (body[7].x + body[8].x) / 2, y: (body[7].y + body[8].y) / 2 } : nose;
        const headLean = angleFromVertical(nose.x - shoulderMid.x, shoulderMid.y - nose.y);
        next.push({
          label: "محاذاة الرأس",
          value: headLean < 12 ? "محاذاة جيدة تقريباً" : headLean < 23 ? "راجع وضع الرأس" : "ميل أمامي/جانبي ملحوظ",
          detail: `تقدير زاوية الرأس ${headLean.toFixed(0)}°، وليس قياساً طبياً`,
          tone: metricTone(headLean, 12, 23),
        });
      } else {
        next.push({ label: "استقامة الجذع والكتفين", value: "الجسم غير ظاهر بالكامل", detail: "أظهر الكتفين والوركين أمام الكاميرا", tone: "neutral" });
        next.push({ label: "محاذاة الرأس", value: "تعذر القياس", detail: "حافظ على ظهور الرأس والكتفين", tone: "neutral" });
      }

      if (facePoints && facePoints.length > 473) {
        const leftEye = facePoints[33], rightEye = facePoints[263], nose = facePoints[1];
        const leftIris = facePoints[468], rightIris = facePoints[473];
        const eyeMidX = (leftEye.x + rightEye.x) / 2;
        const eyeWidth = Math.max(0.001, Math.abs(rightEye.x - leftEye.x));
        const irisMidX = (leftIris.x + rightIris.x) / 2;
        const horizontalOffset = Math.abs((irisMidX - eyeMidX) / eyeWidth);
        const noseOffset = Math.abs((nose.x - eyeMidX) / eyeWidth);
        const gazeScore = Math.max(horizontalOffset, noseOffset * 0.5);
        next.push({
          label: "التواصل البصري التقريبي",
          value: gazeScore < 0.12 ? "النظر باتجاه الكاميرا" : gazeScore < 0.25 ? "النظر منحرف قليلاً" : "النظر بعيد عن الكاميرا",
          detail: "تقدير اتجاه العينين والوجه؛ لا يثبت الانتباه أو جودة التواصل",
          tone: metricTone(gazeScore, 0.12, 0.25),
        });
        const faceWidth = Math.abs(rightEye.x - leftEye.x);
        next.push({
          label: "المسافة من الكاميرا",
          value: faceWidth > 0.27 ? "قريب نسبياً" : faceWidth > 0.14 ? "ضمن نطاق المعاينة" : "بعيد نسبياً",
          detail: "تقدير نسبي من حجم الوجه في الصورة، وليس قياساً بالسنتيمتر",
          tone: faceWidth > 0.27 || faceWidth < 0.14 ? "warn" : "good",
        });
      } else {
        next.push({ label: "التواصل البصري التقريبي", value: "لم يتم رصد الوجه", detail: "اجعل وجهك باتجاه الكاميرا وبإضاءة مناسبة", tone: "neutral" });
        next.push({ label: "المسافة من الكاميرا", value: "غير متاحة", detail: "يلزم ظهور الوجه بوضوح", tone: "neutral" });
      }
      setMetrics(next);
      setCameraNote(body && facePoints ? "تم رصد الجسم والوجه. تحرك بشكل طبيعي لملاحظة تغير المؤشرات." : "حسّن الإضاءة وموضع الكاميرا، وأظهر الرأس والكتفين والوركين.");
    }
    rafRef.current = requestAnimationFrame(analyze);
  }, []);

  const startCamera = async () => {
    setError("");
    setLoading(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("المتصفح لا يدعم الوصول إلى الكاميرا. استخدم HTTPS أو localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("تعذر تجهيز معاينة الكاميرا.");
      video.srcObject = stream;
      await video.play();
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      const [pose, face] = await Promise.all([
        PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numPoses: 1 }),
        FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: false }),
      ]);
      poseRef.current = pose;
      faceRef.current = face;
      setRunning(true);
      rafRef.current = requestAnimationFrame(analyze);
    } catch (cause) {
      stopCamera();
      setError(cause instanceof Error ? cause.message : "تعذر تشغيل الكاميرا أو نماذج الرؤية.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      setDeviceTilt(`ميل الجهاز: ${event.beta.toFixed(0)}° / ${event.gamma.toFixed(0)}°`);
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      stopCamera();
    };
  }, [stopCamera]);

  return <main className="posture-shell" dir="rtl">
    <header className="posture-topbar">
      <Link href="/" className="posture-back"><ArrowRight size={17}/> العودة للوحة التحكم</Link>
      <span className="posture-private"><ShieldCheck size={16}/> تحليل محلي داخل المتصفح</span>
    </header>
    <div className="posture-content">
      <div className="posture-heading">
        <div><div className="posture-eyebrow"><UserRound size={15}/> تقييم مهارات التواصل غير اللفظي</div><h1>محاكاة التموضع ولغة الجسد والتواصل البصري</h1><p>مؤشرات مباشرة تساعد المتدرب على مراجعة وضعية الجلوس واتجاه النظر والمسافة من الكاميرا أثناء المحاكاة.</p></div>
        <div className="posture-sensor"><Video size={17}/><span>كاميرا الجهاز</span><small>{deviceTilt}</small></div>
      </div>
      <div className="posture-grid">
        <section className="posture-camera-card">
          <div className="posture-card-head"><div><strong>منطقة الاستشعار والتحليل</strong><small>تحتاج الكاميرا إلى إظهار الرأس والكتفين والوركين</small></div><span className={running ? "sensor-live" : "sensor-idle"}>{running ? "تحليل مباشر" : "متوقف"}</span></div>
          <div className="posture-video-wrap">
            <video ref={videoRef} autoPlay muted playsInline className={running ? "posture-video active" : "posture-video"} />
            {!running && <div className="posture-video-placeholder"><div><Camera size={31}/></div><strong>معاينة الكاميرا</strong><p>لن يبدأ التحليل إلا بعد ضغطك على زر التشغيل والسماح باستخدام الكاميرا.</p></div>}
          </div>
          <div className="posture-camera-foot"><span><i/> {cameraNote}</span>{running ? <button className="posture-stop" onClick={stopCamera}><CameraOff size={16}/> إيقاف الكاميرا</button> : <button className="posture-start" onClick={startCamera} disabled={loading}>{loading ? "جارٍ تجهيز المستشعرات..." : <><Camera size={16}/> بدء التقييم</>}</button>}</div>
          {error && <div className="posture-error">{error}</div>}
        </section>
        <aside className="posture-side">
          <section className="posture-metrics-card"><div className="posture-section-title"><Gauge size={17}/><div><strong>مؤشرات الأداء اللحظية</strong><small>تقديرات إرشادية وليست حكماً سريرياً</small></div></div>
            <div className="posture-metrics">{metrics.map(metric=><article className="posture-metric" key={metric.label}><div className={`metric-state ${metric.tone}`}/><div><strong>{metric.label}</strong><b>{metric.value}</b><small>{metric.detail}</small></div></article>)}</div>
          </section>
          <section className="posture-tips-card"><div className="posture-section-title"><Eye size={17}/><div><strong>إرشادات وضعية التقييم</strong><small>للحصول على قراءة أكثر استقراراً</small></div></div><ul><li>ضع الكاميرا بمستوى العينين وأمامك مباشرة.</li><li>اجلس بوضع طبيعي مع إظهار الرأس والكتفين والوركين.</li><li>حافظ على إضاءة أمامية وخلفية غير مزدحمة.</li><li>انظر إلى موضع الكاميرا عند مخاطبة الحالة الافتراضية.</li><li>اترك مسافة تسمح بظهور الجزء العلوي من الجسم.</li></ul></section>
        </aside>
      </div>
      <section className="posture-disclaimer"><Info size={17}/><p><strong>حدود القياس والخصوصية:</strong> تُعالج إطارات الكاميرا محلياً في المتصفح ولا تُرفع إلى الخادم ولا تُسجل. تقدير النظر لا يقيس الانتباه أو النية، والمسافة نسبية وغير معايرة بالسنتيمتر. لا يمكن استنتاج جودة التعاطف أو تشخيص حالة نفسية من هذه المؤشرات. قراءة ميل الجهاز اختيارية وتعمل فقط على الأجهزة التي توفر مستشعر الاتجاه.</p></section>
    </div>
  </main>;
}
