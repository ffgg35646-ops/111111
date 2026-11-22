"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { createXRStore, IfInSessionMode, XR } from "@react-three/xr";
import * as THREE from "three";
import { CanvasTexture, SRGBColorSpace, Vector3 } from "three";
import "./clinical-room-stage.css";

const xrStore = createXRStore({ foveation: 1, handTracking: true });

export type ClinicalRoomChoice = {
  id: string;
  label: string;
  score?: number;
  feedback?: string;
};

export type ClinicalRoomStep = {
  title: string;
  focus: string;
  prompt: string;
  choices: ClinicalRoomChoice[];
};

type ClinicalRoomStageProps = {
  onSelect: (target: string) => void;
  onRoomEvent?: (type: string, label: string) => void;
  onImmersiveChange?: (active: boolean) => void;
  spatialTelemetryEnabled: boolean;
  realtimeStatus: "idle" | "connecting" | "live" | "error";
  realtimeMuted: boolean;
  onStartRealtimeVoice: () => void;
  onStopRealtimeVoice: () => void;
  onToggleRealtimeMute: () => void;
  scenarioTitle: string;
  avatarModelUrl: string | null;
  avatarSpeaking: boolean;
  avatarSpeechLevel: number;
  avatarMotion: "idle" | "listen" | "talk";
  voiceStatus: string;
  latestUserText: string;
  latestAssistantText: string;
  listening: boolean;
  busy: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  step: ClinicalRoomStep;
  stepIndex: number;
  stepCount: number;
  selectedChoiceId: string | null;
  completed: boolean;
  score: number | null;
  saving: boolean;
  canFinish: boolean;
  onChoose: (choiceId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  onRestart: () => void;
};

function createArabicTexture(text: string, fontSize: number, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.direction = "rtl";
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.font = "600 " + fontSize + "px \"IBM Plex Sans Arabic\", Tahoma, sans-serif";

    const words = text.replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let line = "";
    const maxWidth = canvas.width - 64;

    for (const word of words) {
      const candidate = line ? line + " " + word : word;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);

    const visibleLines = lines.slice(0, 3);
    const lineHeight = fontSize * 1.28;
    const firstY = canvas.height / 2 - ((visibleLines.length - 1) * lineHeight) / 2;
    visibleLines.forEach((value, index) => {
      context.fillText(value, canvas.width - 32, firstY + index * lineHeight, maxWidth);
    });
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function CanvasLabel({
  text,
  position,
  size,
  fontSize = 38,
  color = "#ffffff",
}: {
  text: string;
  position: [number, number, number];
  size: [number, number];
  fontSize?: number;
  color?: string;
}) {
  const texture = useMemo(
    () => createArabicTexture(text || " ", fontSize, color),
    [text, fontSize, color],
  );

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function WorldButton({
  label,
  position,
  onClick,
  selected = false,
  disabled = false,
  width = 2.82,
  height = 0.29,
}: {
  label: string;
  position: [number, number, number];
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
  width?: number;
  height?: number;
}) {
  const color = disabled ? "#31454b" : selected ? "#168d80" : "#284954";

  return (
    <group position={position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          if (!disabled) onClick();
        }}
        onPointerOver={() => {
          document.body.style.cursor = disabled ? "default" : "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <CanvasLabel
        text={label}
        position={[0, 0, 0.012]}
        size={[width - 0.12, height - 0.025]}
        fontSize={27}
        color={disabled ? "#91a2a6" : "#ffffff"}
      />
    </group>
  );
}

function Chair({
  position,
  rotation = 0,
  tone = "#547984",
}: {
  position: [number, number, number];
  rotation?: number;
  tone?: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.52, 0]} castShadow>
        <boxGeometry args={[0.68, 0.12, 0.68]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      <mesh position={[0, 0.95, -0.28]} castShadow>
        <boxGeometry args={[0.68, 0.82, 0.1]} />
        <meshStandardMaterial color={tone} />
      </mesh>
      {[[-0.25, 0.23, -0.24], [0.25, 0.23, -0.24], [-0.25, 0.23, 0.24], [0.25, 0.23, 0.24]].map((point, index) => (
        <mesh key={index} position={point as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.46, 10]} />
          <meshStandardMaterial color="#63747c" />
        </mesh>
      ))}
    </group>
  );
}

function DoctorAssetPending() {
  return (
    <group position={[0, 1.58, -2.35]}>
      <mesh>
        <planeGeometry args={[2.35, 0.92]} />
        <meshStandardMaterial color="#e0e9e9" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[2.24, 0.82]} />
        <meshBasicMaterial color="#f7faf9" />
      </mesh>
      <CanvasLabel text="الطبيب السعودي غير مربوط" position={[0, 0.13, 0.025]} size={[2.12, 0.28]} fontSize={34} color="#284954" />
      <CanvasLabel text="اربط موديل الطبيب البشري المعتمد" position={[0, -0.18, 0.025]} size={[2.12, 0.22]} fontSize={25} color="#60757b" />
    </group>
  );
}

function RealisticDoctor({
  modelUrl,
  speaking,
  speechLevel,
  motion,
  onSelect,
}: {
  modelUrl: string;
  speaking: boolean;
  speechLevel: number;
  motion: "idle" | "listen" | "talk";
  onSelect: () => void;
}) {
  const gltf = useGLTF(modelUrl);
  const model = gltf.scene;
  const { actions, names, ref } = useAnimations(gltf.animations);
  const blinkRef = useRef({ next: 2.6, started: -1 });

  const faceMeshes = useMemo(() => {
    const found: Array<{
      morphTargetDictionary: Record<string, number>;
      morphTargetInfluences: number[];
    }> = [];
    model.traverse((object) => {
      const mesh = object as THREE.Object3D & {
        isMesh?: boolean;
        morphTargetDictionary?: Record<string, number>;
        morphTargetInfluences?: number[];
      };
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        found.push({
          morphTargetDictionary: mesh.morphTargetDictionary,
          morphTargetInfluences: mesh.morphTargetInfluences,
        });
      }
    });
    return found;
  }, [model]);

  const headBone = useMemo(() => {
    let found: THREE.Bone | null = null;
    model.traverse((object) => {
      if (!found && (object as THREE.Bone).isBone && /mixamorig:head|head$/i.test(object.name)) {
        found = object as THREE.Bone;
      }
    });
    return found;
  }, [model]);
  const headBase = useMemo(
    () => headBone ? new THREE.Euler(headBone.rotation.x, headBone.rotation.y, headBone.rotation.z) : null,
    [headBone],
  );

  useEffect(() => {
    const patterns = speaking || motion === "talk"
      ? [/talk|gestic/i, /confident/i]
      : motion === "listen"
        ? [/think/i, /idle/i]
        : [/idle/i, /think/i];
    const selectedName = names.find((name) => patterns.some((pattern) => pattern.test(name))) ?? names[0];

    Object.values(actions).forEach((action) => action?.fadeOut(0.2));
    if (selectedName) actions[selectedName]?.reset().fadeIn(0.25).play();

    return () => Object.values(actions).forEach((action) => action?.fadeOut(0.12));
  }, [actions, names, speaking, motion]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.elapsedTime;
    const blink = blinkRef.current;
    if (elapsed >= blink.next) {
      blink.started = elapsed;
      blink.next = elapsed + 2.7 + Math.random() * 2.8;
    }
    const blinkWeight = blink.started >= 0 && elapsed - blink.started < 0.14
      ? Math.sin(((elapsed - blink.started) / 0.14) * Math.PI)
      : 0;
    const jawTarget = speaking ? Math.min(0.72, Math.max(0.035, speechLevel * 1.65)) : 0;

    for (const mesh of faceMeshes) {
      const dictionary = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      const jawIndex = dictionary.jawOpen ?? dictionary.JawOpen ?? dictionary.mouthOpen ?? dictionary["mouth-open"];
      if (jawIndex !== undefined) {
        influences[jawIndex] = THREE.MathUtils.damp(influences[jawIndex] ?? 0, jawTarget, 13, delta);
      }
      for (const name of ["eyeBlinkLeft", "eyeBlinkRight"]) {
        const index = dictionary[name];
        if (index !== undefined) {
          influences[index] = THREE.MathUtils.damp(influences[index] ?? 0, blinkWeight, 20, delta);
        }
      }
    }

    // Small natural head motion; the main talking gestures come from the embedded mocap clip.
    if (headBone && headBase) {
      headBone.rotation.x = headBase.x + Math.sin(elapsed * 0.41) * (motion === "listen" ? 0.018 : 0.01);
      headBone.rotation.y = headBase.y + Math.sin(elapsed * 0.29) * 0.026;
      headBone.rotation.z = headBase.z + Math.sin(elapsed * 0.23) * 0.008;
    }
  });

  return (
    <group
      position={[0, 0, -2.35]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      <group ref={ref}>
        <primitive object={model} />
      </group>
    </group>
  );
}

type AssessmentBoardProps = {
  scenarioTitle: string;
  step: ClinicalRoomStep;
  stepIndex: number;
  stepCount: number;
  selectedChoiceId: string | null;
  completed: boolean;
  score: number | null;
  saving: boolean;
  canFinish: boolean;
  onChoose: (choiceId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
  onRestart: () => void;
};

function AssessmentBoard(props: AssessmentBoardProps) {
  return (
    <group position={[-2.65, 1.55, -0.35]} rotation={[0, 0.32, 0]}>
      <mesh>
        <planeGeometry args={[3.12, 2.72]} />
        <meshStandardMaterial color="#142f39" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.31, 0.012]}>
        <planeGeometry args={[3.12, 0.035]} />
        <meshBasicMaterial color="#5fc4b3" />
      </mesh>

      {props.completed ? (
        <>
          <CanvasLabel text="اكتملت المحاكاة" position={[0, 0.92, 0.025]} size={[2.8, 0.32]} fontSize={48} />
          <CanvasLabel text={props.scenarioTitle} position={[0, 0.58, 0.025]} size={[2.8, 0.3]} fontSize={31} color="#a7c9c7" />
          <CanvasLabel text={String(props.score ?? 0) + " / 100"} position={[0, 0.04, 0.025]} size={[2.8, 0.72]} fontSize={112} color="#75d6c3" />
          <CanvasLabel text="تم حفظ نتيجة التدريب في سجل النشاط" position={[0, -0.48, 0.025]} size={[2.8, 0.28]} fontSize={29} color="#d0e0e0" />
          <WorldButton label="إعادة المحاكاة" position={[0, -1.05, 0.045]} onClick={props.onRestart} width={2.4} height={0.34} />
        </>
      ) : (
        <>
          <CanvasLabel text={props.scenarioTitle} position={[0, 1.08, 0.025]} size={[2.86, 0.27]} fontSize={33} />
          <CanvasLabel text={"المرحلة " + (props.stepIndex + 1) + " من " + props.stepCount} position={[0, 0.81, 0.025]} size={[2.82, 0.22]} fontSize={29} color="#73cbbd" />
          <CanvasLabel text={props.step.focus} position={[0, 0.55, 0.025]} size={[2.84, 0.24]} fontSize={31} color="#c5d9d8" />
          <CanvasLabel text={props.step.prompt} position={[0, 0.31, 0.025]} size={[2.84, 0.36]} fontSize={25} color="#e1ebeb" />
          {props.step.choices.slice(0, 4).map((choice, index) => (
            <WorldButton
              key={choice.id}
              label={choice.label}
              position={[0, 0.015 - index * 0.34, 0.045]}
              onClick={() => props.onChoose(choice.id)}
              selected={props.selectedChoiceId === choice.id}
              width={2.84}
              height={0.29}
            />
          ))}
          <WorldButton label="السابق" position={[-0.78, -1.23, 0.045]} onClick={props.onPrevious} disabled={props.stepIndex === 0} width={1.18} height={0.28} />
          <WorldButton
            label={props.stepIndex === props.stepCount - 1 ? (props.saving ? "جارٍ الحفظ" : "إنهاء وتقييم") : "المرحلة التالية"}
            position={[0.78, -1.23, 0.045]}
            onClick={props.stepIndex === props.stepCount - 1 ? props.onFinish : props.onNext}
            disabled={props.saving || (props.stepIndex === props.stepCount - 1 ? !props.canFinish : !props.selectedChoiceId)}
            width={1.4}
            height={0.28}
          />
        </>
      )}
    </group>
  );
}

function VoiceBoard({
  status,
  latestUserText,
  latestAssistantText,
  listening,
  busy,
  realtimeStatus,
  realtimeMuted,
  onStartRealtimeVoice,
  onStopRealtimeVoice,
  onToggleRealtimeMute,
  onStartListening,
  onStopListening,
}: {
  status: string;
  latestUserText: string;
  latestAssistantText: string;
  listening: boolean;
  busy: boolean;
  realtimeStatus: "idle" | "connecting" | "live" | "error";
  realtimeMuted: boolean;
  onStartRealtimeVoice: () => void;
  onStopRealtimeVoice: () => void;
  onToggleRealtimeMute: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
}) {
  const latest = latestAssistantText
    ? "الشخصية: " + latestAssistantText
    : latestUserText
      ? "أنت: " + latestUserText
      : "اضغط على زر الحديث وابدأ المقابلة بالصوت.";

  return (
    <group position={[2.65, 1.55, -0.35]} rotation={[0, -0.32, 0]}>
      <mesh>
        <planeGeometry args={[3.12, 3.25]} />
        <meshStandardMaterial color="#17333e" roughness={0.8} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.31, 0.012]}>
        <planeGeometry args={[3.12, 0.035]} />
        <meshBasicMaterial color="#62c9b7" />
      </mesh>
      <CanvasLabel text="المقابلة الصوتية الحية" position={[0, 1.04, 0.025]} size={[2.88, 0.28]} fontSize={35} />
      <CanvasLabel text={realtimeStatus === "live" ? "الاتصال الحي متصل" : realtimeStatus === "connecting" ? "جارٍ الاتصال بالخدمة" : realtimeStatus === "error" ? "تعذر الاتصال الحي" : status} position={[0, 0.7, 0.025]} size={[2.82, 0.24]} fontSize={31} color={realtimeStatus === "live" ? "#7fe0c8" : "#a8c9c7"} />
      <CanvasLabel text={latest} position={[0, 0.04, 0.025]} size={[2.82, 0.84]} fontSize={26} color="#e1ebeb" />
      <WorldButton
        label={realtimeStatus === "live" ? "الصوت الحي يعمل الآن" : realtimeStatus === "connecting" ? "جارٍ إنشاء الاتصال..." : "ابدأ المحادثة الصوتية الحية"}
        position={[0, -0.83, 0.045]}
        onClick={onStartRealtimeVoice}
        selected={realtimeStatus === "live"}
        disabled={realtimeStatus === "live" || realtimeStatus === "connecting"}
        width={2.74}
        height={0.34}
      />
      <WorldButton
        label={realtimeStatus === "live" ? (realtimeMuted ? "تشغيل الميكروفون" : "كتم الميكروفون") : "الوضع البديل: اضغط وتحدث"}
        position={[0, -1.22, 0.045]}
        onClick={realtimeStatus === "live" ? onToggleRealtimeMute : (listening ? onStopListening : onStartListening)}
        selected={realtimeStatus === "live" && realtimeMuted}
        disabled={realtimeStatus === "connecting" || (realtimeStatus !== "live" && busy)}
        width={2.74}
        height={0.28}
      />
      {realtimeStatus === "live" && <WorldButton
        label="إنهاء الاتصال الحي"
        position={[0, -1.52, 0.045]}
        onClick={onStopRealtimeVoice}
        width={2.74}
        height={0.24}
      />}
    </group>
  );
}


function HeadsetAssessmentTelemetry({ onRoomEvent, enabled }: { onRoomEvent?: (type: string, label: string) => void; enabled: boolean }) {
  const lastSampleAt = useRef(0);
  const scratch = useMemo(() => ({
    head: new Vector3(),
    direction: new Vector3(),
    target: new Vector3(),
  }), []);

  useFrame(({ camera, gl, clock }) => {
    if (!enabled || !gl.xr.isPresenting || clock.elapsedTime - lastSampleAt.current < 5) return;
    lastSampleAt.current = clock.elapsedTime;

    camera.getWorldPosition(scratch.head);
    camera.getWorldDirection(scratch.direction);
    scratch.target.set(0, 1.62, -2.35).sub(scratch.head).normalize();

    const headDirectionAngle = Number((scratch.direction.angleTo(scratch.target) * 180 / Math.PI).toFixed(1));
    const interactionDistanceCm = Number((scratch.head.distanceTo(new Vector3(0, 1.62, -2.35)) * 100).toFixed(0));
    if (!Number.isFinite(headDirectionAngle) || !Number.isFinite(interactionDistanceCm)) return;

    onRoomEvent?.(
      "head_pose_sample",
      "زاوية اتجاه الرأس نحو موضع الحالة: " + headDirectionAngle + " درجة؛ المسافة التقريبية: " + interactionDistanceCm + " سم",
    );
  });

  return null;
}

function HandTrackingTelemetry({ onRoomEvent, enabled }: { onRoomEvent?: (type: string, label: string) => void; enabled: boolean }) {
  const lastSampleAt = useRef(0);
  const pinchStates = useRef<Record<string, boolean>>({});

  useFrame(({ gl, clock }) => {
    if (!enabled || !gl.xr.isPresenting || clock.elapsedTime - lastSampleAt.current < 5) return;

    const xr = gl.xr as unknown as {
      getSession: () => {
        inputSources: ArrayLike<{
          handedness: string;
          hand?: { get: (jointName: string) => unknown };
        }>;
      } | null;
      getFrame: () => {
        getJointPose: (
          joint: unknown,
          referenceSpace: unknown,
        ) => { transform: { position: { x: number; y: number; z: number } } } | null;
      } | null;
      getReferenceSpace: () => unknown;
    };
    const session = xr.getSession();
    const frame = xr.getFrame();
    const referenceSpace = xr.getReferenceSpace();
    if (!session || !frame || !referenceSpace) return;

    lastSampleAt.current = clock.elapsedTime;
    const observedHands: string[] = [];

    for (const inputSource of Array.from(session.inputSources)) {
      if (!inputSource.hand) continue;
      const handedness = inputSource.handedness === "left" ? "left" : inputSource.handedness === "right" ? "right" : "unknown";
      const thumbSpace = inputSource.hand.get("thumb-tip");
      const indexSpace = inputSource.hand.get("index-finger-tip");
      if (!thumbSpace || !indexSpace) continue;

      const thumbPose = frame.getJointPose(thumbSpace, referenceSpace);
      const indexPose = frame.getJointPose(indexSpace, referenceSpace);
      if (!thumbPose || !indexPose) continue;

      const thumb = thumbPose.transform.position;
      const index = indexPose.transform.position;
      const pinchDistanceCm = Math.round(Math.hypot(
        thumb.x - index.x,
        thumb.y - index.y,
        thumb.z - index.z,
      ) * 1000) / 10;
      const isPinching = pinchDistanceCm <= 3.5;
      const previousPinching = pinchStates.current[handedness] ?? false;
      pinchStates.current[handedness] = isPinching;
      observedHands.push(handedness + ":" + (isPinching ? "pinch" : "open"));

      if (isPinching && !previousPinching) {
        onRoomEvent?.(
          "hand_pinch_interaction",
          "تم رصد إشارة قرص بين الإبهام والسبابة في اليد " + (handedness === "left" ? "اليسرى" : handedness === "right" ? "اليمنى" : "غير المحددة") + "؛ مسافة الأصابع التقريبية " + pinchDistanceCm + " سم",
        );
      }
    }

    if (observedHands.length) {
      onRoomEvent?.(
        "hand_tracking_sample",
        "عينات تتبع اليدين عبر WebXR: " + observedHands.join("، "),
      );
    }
  });

  return null;
}

function ClinicScene({ props }: { props: ClinicalRoomStageProps }) {
  const selectDoctor = () => {
    props.onSelect("الطبيب النفسي السعودي");
    props.onRoomEvent?.("doctor_selected", "تم تحديد الطبيب النفسي السعودي الافتراضي داخل القاعة");
  };
  const openCaseFile = () => {
    props.onSelect("ملف الحالة");
    props.onRoomEvent?.("case_file_opened", "فتح ملف الحالة داخل القاعة");
  };

  return (
    <group>
      <HeadsetAssessmentTelemetry onRoomEvent={props.onRoomEvent} enabled={props.spatialTelemetryEnabled} />
      <HandTrackingTelemetry onRoomEvent={props.onRoomEvent} enabled={props.spatialTelemetryEnabled} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[9, 8.5]} />
        <meshStandardMaterial color="#e7edef" roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.5, -4.25]} receiveShadow>
        <boxGeometry args={[9, 3, 0.12]} />
        <meshStandardMaterial color="#f8fbfb" />
      </mesh>
      <mesh position={[-4.45, 1.5, 0]} receiveShadow>
        <boxGeometry args={[0.12, 3, 8.5]} />
        <meshStandardMaterial color="#f4f8f8" />
      </mesh>
      <mesh position={[4.45, 1.5, -0.8]} receiveShadow>
        <boxGeometry args={[0.12, 3, 6.9]} />
        <meshStandardMaterial color="#f4f8f8" />
      </mesh>
      <mesh position={[0, 2.98, 0]}>
        <boxGeometry args={[9, 0.1, 8.5]} />
        <meshStandardMaterial color="#dbe5e7" />
      </mesh>

      <mesh position={[0, 0.78, -1.22]} castShadow receiveShadow>
        <boxGeometry args={[2.25, 0.14, 1.05]} />
        <meshStandardMaterial color="#b68f6a" />
      </mesh>
      {[[-1, 0.37, -0.84], [1, 0.37, -0.84], [-1, 0.37, -1.6], [1, 0.37, -1.6]].map((point, index) => (
        <mesh key={index} position={point as [number, number, number]} castShadow>
          <boxGeometry args={[0.1, 0.76, 0.1]} />
          <meshStandardMaterial color="#8b735d" />
        </mesh>
      ))}
      <mesh position={[0, 0.12, -1.22]} castShadow>
        <boxGeometry args={[1.9, 0.05, 0.8]} />
        <meshStandardMaterial color="#e8e1d7" />
      </mesh>

      <Chair position={[0, 0, -2.35]} rotation={0} tone="#59857f" />
      <Chair position={[0, 0, 1.45]} rotation={Math.PI} tone="#71828c" />

      {props.avatarModelUrl ? (
        <Suspense fallback={<DoctorAssetPending />}>
          <RealisticDoctor modelUrl={props.avatarModelUrl} speaking={props.avatarSpeaking} speechLevel={props.avatarSpeechLevel} motion={props.avatarMotion} onSelect={selectDoctor} />
        </Suspense>
      ) : (
        <DoctorAssetPending />
      )}

      <mesh position={[-3.2, 0.48, 1.18]} castShadow>
        <boxGeometry args={[0.9, 0.1, 0.68]} />
        <meshStandardMaterial color="#b68f6a" />
      </mesh>
      <group
        position={[-3.2, 0.62, 1.18]}
        onClick={(event) => { event.stopPropagation(); openCaseFile(); }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.58, 0.08, 0.42]} />
          <meshStandardMaterial color="#d9e4dc" />
        </mesh>
        <mesh position={[0.12, 0.055, 0]} castShadow>
          <boxGeometry args={[0.28, 0.018, 0.32]} />
          <meshStandardMaterial color="#f7f6ed" />
        </mesh>
      </group>

      <mesh position={[-2.7, 1.82, -4.16]}>
        <boxGeometry args={[1.36, 0.75, 0.035]} />
        <meshStandardMaterial color="#dcebe8" />
      </mesh>
      <mesh position={[-2.7, 1.82, -4.12]}>
        <boxGeometry args={[1.22, 0.6, 0.025]} />
        <meshStandardMaterial color="#bed6d1" />
      </mesh>
      <mesh position={[2.65, 1.15, -4.14]}>
        <boxGeometry args={[1.1, 1.52, 0.04]} />
        <meshStandardMaterial color="#a5c3bd" />
      </mesh>
      <mesh position={[2.65, 1.92, -4.1]}>
        <boxGeometry args={[1.0, 0.13, 0.05]} />
        <meshStandardMaterial color="#638c85" />
      </mesh>

      <mesh position={[0, 2.72, -2.2]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color="#f0c56e" emissive="#e2ad42" emissiveIntensity={0.5} />
      </mesh>
      <Grid position={[0, -0.035, 0]} args={[9, 8.5]} cellSize={0.5} cellThickness={0.35} sectionSize={2} sectionThickness={0.7} fadeDistance={12} infiniteGrid />

      <AssessmentBoard
        scenarioTitle={props.scenarioTitle}
        step={props.step}
        stepIndex={props.stepIndex}
        stepCount={props.stepCount}
        selectedChoiceId={props.selectedChoiceId}
        completed={props.completed}
        score={props.score}
        saving={props.saving}
        canFinish={props.canFinish}
        onChoose={props.onChoose}
        onPrevious={props.onPrevious}
        onNext={props.onNext}
        onFinish={props.onFinish}
        onRestart={props.onRestart}
      />
      <VoiceBoard
        status={props.voiceStatus}
        latestUserText={props.latestUserText}
        latestAssistantText={props.latestAssistantText}
        listening={props.listening}
        busy={props.busy}
        realtimeStatus={props.realtimeStatus}
        realtimeMuted={props.realtimeMuted}
        onStartRealtimeVoice={props.onStartRealtimeVoice}
        onStopRealtimeVoice={props.onStopRealtimeVoice}
        onToggleRealtimeMute={props.onToggleRealtimeMute}
        onStartListening={props.onStartListening}
        onStopListening={props.onStopListening}
      />
    </group>
  );
}

export default function ClinicalRoomStage(props: ClinicalRoomStageProps) {
  const [xrMessage, setXrMessage] = useState("");

  const enterVR = async () => {
    setXrMessage("جارٍ التحقق من دعم النظارة...");
    try {
      const session = await xrStore.enterVR();
      if (!session) {
        props.onImmersiveChange?.(false);
        setXrMessage("لم يتم العثور على جلسة WebXR. افتح المنصة من متصفح النظارة المتوافق عبر HTTPS.");
        return;
      }
      props.onImmersiveChange?.(true);
      session.addEventListener("end", () => props.onImmersiveChange?.(false), { once: true });
      setXrMessage("تم تشغيل الواقع الافتراضي. اقترب من الشخصية وتحدث معها من لوحة المقابلة داخل القاعة.");
    } catch (error) {
      props.onImmersiveChange?.(false);
      setXrMessage(error instanceof Error ? error.message : "تعذر تشغيل وضع VR في هذا المتصفح.");
    }
  };

  return (
    <div className="clinical-room-canvas">
      <div className="clinical-room-actions">
        <button type="button" onClick={enterVR}>دخول VR بالنظارة</button>
        <span>الطبيب الافتراضي والمقابلة الصوتية داخل القاعة</span>
        {xrMessage && <small role="status">{xrMessage}</small>}
      </div>
      <Canvas shadows camera={{ position: [0, 1.65, 6.5], fov: 50 }} dpr={[1, 1.5]}>
        <XR store={xrStore}>
          <color attach="background" args={["#eaf0f1"]} />
          <ambientLight intensity={1.35} />
          <directionalLight position={[4, 8, 5]} intensity={2.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
          <directionalLight position={[-5, 4, -3]} intensity={0.65} />
          <ClinicScene props={props} />
          <IfInSessionMode deny={["immersive-vr", "immersive-ar"]}>
            <OrbitControls makeDefault target={[0, 1.35, -1]} minDistance={2.7} maxDistance={13} maxPolarAngle={Math.PI / 2.03} />
          </IfInSessionMode>
        </XR>
      </Canvas>
      <div className="clinical-room-compass"><span /> طبيب نفسي سعودي افتراضي · حوار صوتي داخل القاعة · WebXR</div>
    </div>
  );
}
