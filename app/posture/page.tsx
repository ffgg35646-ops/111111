"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, CameraOff, Eye, Gauge, Info, ShieldCheck, UserRound, Video } from "lucide-react";
import { FaceLandmarker, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Room, RoomEvent } from "livekit-client";
import { publishVrTelemetry } from "@/components/vr-telemetry-bridge";
import "./posture.css";

type Metric = { label: string; value: string; detail: string; tone: "good" | "warn" | "neutral" };
type VisionLandmark = { x: number; y: number; z?: number; visibility?: number };
type PoseResult = { landmarks: VisionLandmark[][] };
type FaceResult = { faceLandmarks: VisionLandmark[][] };
type VrDeviceConnection = { serverUrl: string; roomName: string; token: string; role: "vr-device" };

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
  const analyzeRef = useRef<() => void>(() => {});
  const lastTelemetryAt = useRef(0);
  const vrRoomRef = useRef<Room | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deviceConnectionText, setDeviceConnectionText] = useState("");
  const [connectingVrRoom, setConnectingVrRoom] = useState(false);
  const [vrConnected, setVrConnected] = useState(false);
  const [vrConnectionStatus, setVrConnectionStatus] = useState("غير مرتبط بغرفة إشراف");
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: "استقامة الجذع", value: "بانتظار الكاميرا", detail: "يظهر بعد رصد الكتفين والوركين", tone: "neutral" },
    { label: "ميل الرأس", value: "بانتظار الكاميرا", detail: "يظهر بعد رصد الوجه والكتفين", tone: "neutral" },
    { label: "اتجاه النظر", value: "بانتظار الكاميرا", detail: "تقدير بصري تقريبي لاتجاه الوجه والعينين", tone: "neutral" },
    { label: "المسافة من الكاميرا", value: "غير معايرة", detail: "تقدير نسبي لحجم الوجه داخل الإطار", tone: "neutral" },
  ]);
  const [deviceTilt, setDeviceTilt] = useState("غير متاح");
  const [cameraNote, setCameraNote] = useState("ضع الكاميرا أمامك بحيث يظهر الرأس والكتفان والجزء العلوي من الجسم.");

  const connectVrDevice = async () => {
    setError("");
    setConnectingVrRoom(true);
    let candidateRoom: Room | null = null;
    try {
      const config = JSON.parse(deviceConnectionText) as Partial<VrDeviceConnection>;
      if (
        typeof config.serverUrl !== "string" ||
        typeof config.roomName !== "string" ||
        typeof config.token !== "string" ||
        config.role !== "vr-device"
      ) {
        throw new Error("بيانات الربط غير مكتملة. استخدم JSON الذي ينسخه المشرف من غرفة الإشراف.");
      }
      const endpoint = new URL(config.serverUrl);
      if (endpoint.protocol !== "wss:" && endpoint.protocol !== "ws:") {
        throw new Error("عنوان LiveKit غير صحيح.");
      }
      if (vrRoomRef.current) await vrRoomRef.current.disconnect();
      const room = new Room();
      candidateRoom = room;
      room.on(RoomEvent.Disconnected, () => {
        if (vrRoomRef.current === room) {
          vrRoomRef.current = null;
          setVrConnected(false);
          setVrConnectionStatus("انقطع الاتصال بغرفة الإشراف. أعد الربط عند الحاجة.");
        }
      });
      await room.connect(config.serverUrl, config.token);
      if (room.name !== config.roomName) {
        await room.disconnect();
        throw new Error("رمز الجهاز لا يطابق الغرفة المحددة.");
      }
      vrRoomRef.current = room;
      setVrConnected(true);
      setDeviceConnectionText("");
      setVrConnectionStatus(`متصل بالغرفة ${config.roomName.slice(-8)} — إرسال بيانات فقط`);
      lastTelemetryAt.current = 0;
    } catch (cause) {
      if (candidateRoom && candidateRoom !== vrRoomRef.current) {
        await candidateRoom.disconnect().catch(() => undefined);
      }
      setVrConnectionStatus("تعذر الاتصال بغرفة الإشراف");
      setError(cause instanceof Error ? cause.message : "تعذر ربط مستشعرات الوضعية بغرفة الإشراف.");
    } finally {
      setConnectingVrRoom(false);
    }
  };

  const disconnectVrDevice = async () => {
    const room = vrRoomRef.current;
    vrRoomRef.current = null;
    if (room) await room.disconnect();
    setDeviceConnectionText("");
    setVrConnected(false);
    setVrConnectionStatus("غير مرتبط بغرفة إشراف");
  };

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
      rafRef.current = requestAnimationFrame(() => analyzeRef.current());
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
      let postureNumericScore: number | null = null;
      let gazeNumericScore: number | null = null;

      if (body && body.length > 24 && (body[11]?.visibility ?? 0) > 0.35 && (body[12]?.visibility ?? 0) > 0.35) {
        const shoulderMid = { x: (body[11].x + body[12].x) / 2, y: (body[11].y + body[12].y) / 2 };
        const hipMid = { x: (body[23].x + body[24].x) / 2, y: (body[23].y + body[24].y) / 2 };
        const shoulderTilt = Math.atan2(Math.abs(body[12].y - body[11].y), Math.abs(body[12].x - body[11].x)) * 180 / Math.PI;
        const torsoLean = angleFromVertical(shoulderMid.x - hipMid.x, hipMid.y - shoulderMid.y);
        const asymmetry = Math.min(90, Math.abs(shoulderTilt));
        const combined = Math.max(torsoLean, asymmetry);
        postureNumericScore = Math.max(0, Math.min(5, Number((5 - combined / 20).toFixed(2))));
        next.push({
          label: "استقامة الجذع والكتفين",
          value: combined < 8 ? "متوازن تقريباً" : combined < 17 ? "ميل بسيط" : "ميل ملحوظ",
          detail: `انحراف هندسي تقريبي ${combined.toFixed(0)}° — يعتمد على وضع الكاميرا وظهور الجسم`,
          tone: metricTone(combined, 8, 17),
        });
        const nose = body[0];
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
        gazeNumericScore = Math.max(0, Math.min(5, Number((5 - gazeScore * 12).toFixed(2))));
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

      const telemetryRoom = vrRoomRef.current;
      const now = Date.now();
      if (telemetryRoom && now - lastTelemetryAt.current >= 3000) {
        lastTelemetryAt.current = now;
        const events: Promise<void>[] = [];
        if (postureNumericScore !== null) {
          events.push(publishVrTelemetry(telemetryRoom, {
            type: "posture_score",
            label: "استقامة الجذع والكتفين",
            value: postureNumericScore,
            unit: "/5",
            source: "web-vr",
          }));
        }
        if (gazeNumericScore !== null) {
          events.push(publishVrTelemetry(telemetryRoom, {
            type: "gaze_score",
            label: "اتجاه النظر نحو الكاميرا",
            value: gazeNumericScore,
            unit: "/5",
            source: "web-vr",
          }));
        }
        void Promise.all(events).then(() => {
          setVrConnectionStatus("متصل — تم إرسال قياسات الوضعية والنظر");
        }).catch(() => {
          setVrConnectionStatus("الاتصال قائم لكن تعذر إرسال القياسات");
        });
      }
    }
    rafRef.current = requestAnimationFrame(() => analyzeRef.current());
  }, []);

  useEffect(() => {
    analyzeRef.current = analyze;
  }, [analyze]);

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
      rafRef.current = requestAnimationFrame(() => analyzeRef.current());
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
      const room = vrRoomRef.current;
      vrRoomRef.current = null;
      if (room) void room.disconnect();
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
          <section className="posture-vr-link-card">
            <div className="posture-section-title"><ShieldCheck size={17}/><div><strong>ربط جلسة الإشراف والكفاءات</strong><small>إرسال نتائج الوضعية والنظر تلقائياً للمشرف</small></div></div>
            <textarea
              className="posture-device-config"
              value={deviceConnectionText}
              onChange={(event)=>setDeviceConnectionText(event.target.value)}
              rows={4}
              placeholder="الصق هنا بيانات اتصال محرك VR التي نسخها المشرف من الغرفة المشتركة..."
              aria-label="بيانات اتصال غرفة الإشراف"
            />
            <div className="posture-vr-actions">
              <button onClick={connectVrDevice} disabled={connectingVrRoom || vrConnected || !deviceConnectionText.trim()}>
                {connectingVrRoom ? "جارٍ الاتصال..." : vrConnected ? "متصل بغرفة الإشراف" : "ربط بغرفة الإشراف"}
              </button>
              {vrConnected && <button className="posture-vr-disconnect" onClick={disconnectVrDevice}>قطع الاتصال</button>}
            </div>
            <small className={vrConnected ? "posture-vr-status connected" : "posture-vr-status"}>{vrConnectionStatus}</small>
            <p>الصق بيانات JSON التي يرسلها المشرف إلى جهاز المتدرب. رمز الربط لا يُحفظ في قاعدة البيانات أو التخزين المحلي، ويُستخدم لإرسال القياسات فقط.</p>
          </section>
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
