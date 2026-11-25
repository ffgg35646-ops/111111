"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF, useTexture } from "@react-three/drei";
import { createXRStore, IfInSessionMode, XR } from "@react-three/xr";
import * as THREE from "three";
import { CanvasTexture, SRGBColorSpace, Vector3 } from "three";
import "./clinical-room-stage.css";
import { SaudiDoctorAttire } from "@/components/saudi-doctor-attire";

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
  roomId: string;
  roomLabel: string;
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
  const faceSource = useTexture("/clinic/doctor-face.jpg");
  const facePhotoTexture = useMemo(() => {
    const image = faceSource.image as HTMLImageElement | undefined;
    if (!image?.width || !image?.height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) return null;
    // Crop the face from the supplied close-up reference, excluding the corridor background.
    context.drawImage(image, 620, 82, 132, 166, 0, 0, 512, 512);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  }, [faceSource]);
  const { actions, names, ref } = useAnimations(gltf.animations);
  const blinkRef = useRef({ next: 2.6, started: -1 });

  const faceMeshesRef = useRef<Array<{
    morphTargetDictionary: Record<string, number>;
    morphTargetInfluences: number[];
  }>>([]);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const jawObjectRef = useRef<{ rotation: THREE.Euler } | null>(null);
  const mouthObjectRef = useRef<THREE.Mesh | null>(null);
  const eyeObjectsRef = useRef<Array<{ object: { scale: THREE.Vector3; rotation: THREE.Euler }; baseScale: THREE.Vector3; base: THREE.Euler }>>([]);
  const gestureArmsRef = useRef<Array<{ object: { rotation: THREE.Euler }; base: THREE.Euler; side: number }>>([]);
  const headObjectRef = useRef<{ rotation: THREE.Euler } | null>(null);
  const headBaseRef = useRef<THREE.Euler | null>(null);
  const eyeBonesRef = useRef<Array<{ bone: THREE.Bone; base: THREE.Euler }>>([]);
  const gazeRef = useRef({ nextAt: 0.8, x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const faces: Array<{
      morphTargetDictionary: Record<string, number>;
      morphTargetInfluences: number[];
    }> = [];
    const bones: THREE.Bone[] = [];
    eyeObjectsRef.current = [];
    gestureArmsRef.current = [];
    headObjectRef.current = null;
    jawObjectRef.current = null;
    headBoneRef.current = null;
    model.traverse((object) => {
      const mesh = object as unknown as {
        isMesh?: boolean;
        morphTargetDictionary?: Record<string, number>;
        morphTargetInfluences?: number[];
      };
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        faces.push({
          morphTargetDictionary: mesh.morphTargetDictionary,
          morphTargetInfluences: mesh.morphTargetInfluences,
        });
      }
      const animatedNode = object as unknown as { scale: THREE.Vector3; rotation: THREE.Euler };
      if (/^jaw$/i.test(object.name)) jawObjectRef.current = animatedNode;
      if (/^(left|right)_eye$/i.test(object.name)) {
        eyeObjectsRef.current.push({
          object: animatedNode,
          baseScale: animatedNode.scale.clone(),
          base: new THREE.Euler(animatedNode.rotation.x, animatedNode.rotation.y, animatedNode.rotation.z),
        });
      }
      if (/^(left|right)_arm$/i.test(object.name)) gestureArmsRef.current.push({ object: animatedNode, base: new THREE.Euler(animatedNode.rotation.x, animatedNode.rotation.y, animatedNode.rotation.z), side: /^left/i.test(object.name) ? -1 : 1 });
      if (/^head$/i.test(object.name)) headObjectRef.current = animatedNode;
      const bone = object as unknown as THREE.Bone;
      if (bone.isBone && /left.?eye|right.?eye/i.test(bone.name)) bones.push(bone);
      if (bone.isBone && /mixamorig:head|head$/i.test(bone.name)) headBoneRef.current = bone;
    });
    faceMeshesRef.current = faces;
    const head = headBoneRef.current as THREE.Bone | null;
    headBaseRef.current = head ? new THREE.Euler(head.rotation.x, head.rotation.y, head.rotation.z) : null;
    eyeBonesRef.current = bones.map((bone) => ({
      bone,
      base: new THREE.Euler(bone.rotation.x, bone.rotation.y, bone.rotation.z),
    }));
  }, [model]);

  useEffect(() => {
    if (!facePhotoTexture) return;
    const head = model.getObjectByName("Head");
    if (!head) return;

    // A curved facial shell uses the original close-up photo on the live 3D head.
    // The first half-turn of the sphere faces the camera (+Z), and its UVs already span 0..1.
    const geometry = new THREE.SphereGeometry(1.008, 64, 48, 0, Math.PI, 0, Math.PI);
    const material = new THREE.MeshStandardMaterial({
      map: facePhotoTexture,
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const faceShell = new THREE.Mesh(geometry, material);
    faceShell.name = "DoctorPhotoFaceShell";
    faceShell.renderOrder = 2;
    // Keep the photographic skin slightly behind the separately modelled eyes and nose.
    faceShell.position.z = -0.06;
    head.add(faceShell);

    return () => {
      head.remove(faceShell);
      geometry.dispose();
      material.dispose();
    };
  }, [model, facePhotoTexture]);

  useEffect(() => {
    const head = model.getObjectByName("Head");
    if (!head) return;
    const geometry = new THREE.SphereGeometry(1, 24, 16);
    const material = new THREE.MeshStandardMaterial({ color: "#54262a", roughness: 0.94, side: THREE.DoubleSide });
    const mouth = new THREE.Mesh(geometry, material);
    mouth.name = "RealtimeMouthOpening";
    mouth.position.set(0, -0.4, 0.94);
    mouth.scale.set(0.34, 0.018, 0.075);
    head.add(mouth);
    mouthObjectRef.current = mouth;
    return () => {
      head.remove(mouth);
      geometry.dispose();
      material.dispose();
      mouthObjectRef.current = null;
    };
  }, [model]);

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
    if (jawObjectRef.current) {
      jawObjectRef.current.rotation.x = THREE.MathUtils.damp(
        jawObjectRef.current.rotation.x,
        speaking ? 0.12 + jawTarget * 0.42 : 0,
        15,
        delta,
      );
    }
    if (headObjectRef.current && !headBoneRef.current) {
      const attentiveNod = motion === "listen" ? Math.sin(elapsed * 1.15) * 0.035 : 0;
      headObjectRef.current.rotation.x = THREE.MathUtils.damp(headObjectRef.current.rotation.x, attentiveNod, 5, delta);
      headObjectRef.current.rotation.y = Math.sin(elapsed * 0.29) * 0.025;
      headObjectRef.current.rotation.z = Math.sin(elapsed * 0.23) * 0.008;
    }
    // Restrained hand gestures use the named arm nodes in the bundled doctor model.
    gestureArmsRef.current.forEach(({ object, base, side }) => {
      const talkingGesture = speaking || motion === "talk";
      const targetX = base.x + (talkingGesture ? Math.sin(elapsed * 3.1 + side) * 0.075 : 0);
      const targetZ = base.z + (talkingGesture ? side * (0.035 + Math.max(0, Math.sin(elapsed * 2.1)) * 0.09) : 0);
      object.rotation.x = THREE.MathUtils.damp(object.rotation.x, targetX, 5, delta);
      object.rotation.z = THREE.MathUtils.damp(object.rotation.z, targetZ, 5, delta);
    });

    for (const mesh of faceMeshesRef.current) {
      const dictionary = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      const jawIndex = dictionary.jawOpen ?? dictionary.JawOpen ?? dictionary.mouthOpen ?? dictionary["mouth-open"];
      if (jawIndex !== undefined) {
        // eslint-disable-next-line react-hooks/immutability -- Three.js morph weights are updated in the render loop, not React state.
        influences[jawIndex] = THREE.MathUtils.damp(influences[jawIndex] ?? 0, jawTarget, 13, delta);
      }
      for (const name of ["eyeBlinkLeft", "eyeBlinkRight"]) {
        const index = dictionary[name];
        if (index !== undefined) {
          // eslint-disable-next-line react-hooks/immutability -- Three.js morph weights are updated in the render loop, not React state.
          influences[index] = THREE.MathUtils.damp(influences[index] ?? 0, blinkWeight, 20, delta);
        }
      }
    }

    // Small natural head motion; the main talking gestures come from the embedded mocap clip.
    const headBone = headBoneRef.current;
    const headBase = headBaseRef.current;
    if (headBone && headBase) {
      headBone.rotation.x = headBase.x + Math.sin(elapsed * 0.41) * (motion === "listen" ? 0.018 : 0.01);
      headBone.rotation.y = headBase.y + Math.sin(elapsed * 0.29) * 0.026;
      headBone.rotation.z = headBase.z + Math.sin(elapsed * 0.23) * 0.008;
    }

    const gaze = gazeRef.current;
    if (elapsed >= gaze.nextAt) {
      gaze.targetX = (Math.random() - 0.5) * 0.055;
      gaze.targetY = (Math.random() - 0.5) * 0.035;
      gaze.nextAt = elapsed + 0.6 + Math.random() * 1.8;
    }
    gaze.x = THREE.MathUtils.damp(gaze.x, gaze.targetX, 8, delta);
    gaze.y = THREE.MathUtils.damp(gaze.y, gaze.targetY, 8, delta);
    eyeBonesRef.current.forEach(({ bone, base }) => {
      bone.rotation.set(base.x + gaze.y, base.y + gaze.x, base.z);
    });
    eyeObjectsRef.current.forEach(({ object, baseScale, base }) => {
      object.scale.y = THREE.MathUtils.damp(object.scale.y, baseScale.y * (1 - blinkWeight * 0.96), 24, delta);
      object.rotation.x = base.x + gaze.y * 0.45;
      object.rotation.y = base.y + gaze.x * 0.65;
    });
    if (mouthObjectRef.current) {
      const open = speaking || motion === "talk" ? 0.025 + Math.min(0.105, Math.max(0.018, speechLevel * 0.16)) : 0.018;
      mouthObjectRef.current.scale.y = THREE.MathUtils.damp(mouthObjectRef.current.scale.y, open, 17, delta);
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
        <SaudiDoctorAttire model={model} />
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

function Clinic3DRoom({
  onSelectTarget,
}: {
  onSelectTarget: (target: string, eventLabel: string) => void;
}) {
  const activate = (target: string, label: string) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelectTarget(target, label);
  };
  const pointer = {
    onPointerOver: () => { document.body.style.cursor = "pointer"; },
    onPointerOut: () => { document.body.style.cursor = "auto"; },
  };

  return (
    <group>
      {/* Architectural shell */}
      <mesh position={[0, -0.09, -1.45]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 13]} />
        <meshStandardMaterial color="#c9c3b7" roughness={0.76} />
      </mesh>
      <mesh position={[0, 3.02, -6.15]} receiveShadow>
        <boxGeometry args={[14, 6.2, 0.22]} />
        <meshStandardMaterial color="#e9e4d9" roughness={0.9} />
      </mesh>
      <mesh position={[-6.95, 3.02, -0.1]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[12.1, 6.2, 0.22]} />
        <meshStandardMaterial color="#e4dfd4" roughness={0.9} />
      </mesh>
      <mesh position={[6.95, 3.02, -0.1]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[12.1, 6.2, 0.22]} />
        <meshStandardMaterial color="#e4dfd4" roughness={0.9} />
      </mesh>
      <mesh position={[0, 6.12, -1.45]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 12.5]} />
        <meshStandardMaterial color="#f2f0e9" roughness={0.95} />
      </mesh>

      {/* Floor inlay and skirting */}
      <mesh position={[0, -0.075, -1.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[13.7, 12.7]} />
        <meshStandardMaterial color="#d8d2c7" roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.08, -6.01]}>
        <boxGeometry args={[13.8, 0.18, 0.08]} />
        <meshStandardMaterial color="#aa9d89" roughness={0.72} />
      </mesh>
      <mesh position={[-6.81, 0.08, -0.05]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[11.9, 0.18, 0.08]} />
        <meshStandardMaterial color="#aa9d89" roughness={0.72} />
      </mesh>

      {/* Rear window with real 3D mullions */}
      <group position={[0, 3.05, -5.99]}>
        <mesh>
          <boxGeometry args={[4.45, 2.38, 0.11]} />
          <meshPhysicalMaterial color="#9ebfca" roughness={0.16} metalness={0.08} transmission={0.22} transparent opacity={0.72} />
        </mesh>
        {[ -2.18, 0, 2.18 ].map((x) => (
          <mesh key={x} position={[x, 0, 0.075]}>
            <boxGeometry args={[0.075, 2.48, 0.12]} />
            <meshStandardMaterial color="#f4f1e9" metalness={0.28} roughness={0.34} />
          </mesh>
        ))}
        {[-1.17, 0, 1.17].map((y) => (
          <mesh key={y} position={[0, y, 0.075]}>
            <boxGeometry args={[4.5, 0.07, 0.12]} />
            <meshStandardMaterial color="#f4f1e9" metalness={0.25} roughness={0.36} />
          </mesh>
        ))}
        <mesh position={[0, -1.29, 0.08]}>
          <boxGeometry args={[4.75, 0.16, 0.22]} />
          <meshStandardMaterial color="#b5a48e" roughness={0.6} />
        </mesh>
      </group>

      {/* Consultation-room sign and wall clock */}
      <group position={[0, 4.85, -5.99]}>
        <mesh>
          <boxGeometry args={[2.25, 0.66, 0.08]} />
          <meshStandardMaterial color="#f7f6ef" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.25, 0.05]}>
          <boxGeometry args={[2.25, 0.08, 0.035]} />
          <meshStandardMaterial color="#4b9c88" />
        </mesh>
        <CanvasLabel text="عيادة الاستشارات النفسية" position={[0, -0.03, 0.06]} size={[2.05, 0.22]} fontSize={26} color="#32564d" />
        <CanvasLabel text="CONSULTATION ROOM" position={[0, -0.22, 0.06]} size={[1.9, 0.14]} fontSize={15} color="#687a72" />
      </group>
      <group position={[4.8, 4.25, -5.98]}>
        <mesh>
          <cylinderGeometry args={[0.34, 0.34, 0.075, 48]} />
          <meshStandardMaterial color="#f9f7ed" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0, 0.045]}>
          <circleGeometry args={[0.29, 48]} />
          <meshBasicMaterial color="#f8f6ef" />
        </mesh>
        <mesh position={[0, 0.11, 0.058]}>
          <boxGeometry args={[0.018, 0.19, 0.012]} />
          <meshBasicMaterial color="#4a514e" />
        </mesh>
        <mesh position={[0.08, 0, 0.06]}>
          <boxGeometry args={[0.15, 0.018, 0.012]} />
          <meshBasicMaterial color="#4a514e" />
        </mesh>
      </group>

      {/* Consultation desk, drawers, monitor and keyboard */}
      <group position={[2.95, 0, -3.65]}>
        <mesh position={[0, 0.93, 0]} castShadow receiveShadow
          onClick={activate("مكتب الطبيب", "تفاعل المتدرب مع سطح مكتب الطبيب وأدوات المقابلة.")} {...pointer}>
          <boxGeometry args={[2.65, 0.16, 1.18]} />
          <meshStandardMaterial color="#76543b" roughness={0.38} metalness={0.04} />
        </mesh>
        <mesh position={[0, 0.83, 0]}>
          <boxGeometry args={[2.42, 0.045, 1.02]} />
          <meshStandardMaterial color="#b58a62" roughness={0.48} />
        </mesh>
        {[-1.04, 1.04].map((x) => (
          <mesh key={x} position={[x, 0.43, 0]} castShadow>
            <boxGeometry args={[0.43, 0.82, 0.92]} />
            <meshStandardMaterial color="#d9d4c8" roughness={0.72} />
          </mesh>
        ))}
        {[-1.04, 1.04].map((x) => (
          <mesh key={x} position={[x, 0.55, 0.48]}>
            <boxGeometry args={[0.16, 0.025, 0.025]} />
            <meshStandardMaterial color="#8c806e" metalness={0.55} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 1.42, -0.34]} castShadow
          onClick={activate("الشاشة التعليمية", "تم فتح نقطة التفاعل الخاصة بشاشة الطبيب التعليمية.")} {...pointer}>
          <boxGeometry args={[0.92, 0.58, 0.075]} />
          <meshStandardMaterial color="#252c30" roughness={0.28} metalness={0.35} />
        </mesh>
        <mesh position={[0, 1.42, -0.297]}>
          <planeGeometry args={[0.81, 0.47]} />
          <meshBasicMaterial color="#9bbdbb" />
        </mesh>
        <mesh position={[0, 1.12, -0.33]}>
          <boxGeometry args={[0.13, 0.12, 0.11]} />
          <meshStandardMaterial color="#52595b" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh position={[-0.05, 1.04, 0.21]} rotation={[-0.08, 0, 0]}>
          <boxGeometry args={[0.62, 0.025, 0.29]} />
          <meshStandardMaterial color="#343b3e" roughness={0.58} />
        </mesh>
        <mesh position={[0.82, 1.035, 0.15]}>
          <cylinderGeometry args={[0.07, 0.07, 0.018, 24]} />
          <meshStandardMaterial color="#e8e5dc" roughness={0.5} />
        </mesh>
        <mesh position={[0.82, 1.13, 0.15]}>
          <cylinderGeometry args={[0.014, 0.014, 0.18, 12]} />
          <meshStandardMaterial color="#4c5955" metalness={0.35} roughness={0.4} />
        </mesh>
      </group>

      {/* Doctor's ergonomic chair */}
      <group position={[2.95, 0, -4.85]}>
        <mesh position={[0, 0.74, 0]} castShadow>
          <boxGeometry args={[0.76, 0.16, 0.68]} />
          <meshStandardMaterial color="#526b70" roughness={0.62} />
        </mesh>
        <mesh position={[0, 1.27, -0.25]} castShadow>
          <boxGeometry args={[0.76, 0.94, 0.15]} />
          <meshStandardMaterial color="#526b70" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.065, 0.08, 0.64, 20]} />
          <meshStandardMaterial color="#737b7b" metalness={0.55} roughness={0.34} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.06, 24]} />
          <meshStandardMaterial color="#555e60" metalness={0.58} roughness={0.35} />
        </mesh>
        {[0, 1, 2, 3, 4].map((index) => (
          <mesh key={index} position={[Math.cos(index * Math.PI * 2 / 5) * 0.28, 0.035, Math.sin(index * Math.PI * 2 / 5) * 0.28]}>
            <sphereGeometry args={[0.075, 16, 12]} />
            <meshStandardMaterial color="#353b3d" roughness={0.55} />
          </mesh>
        ))}
      </group>

      {/* Visitor sofa and table */}
      <group position={[-3.15, 0, -2.6]}>
        <mesh position={[0, 0.44, 0]} castShadow
          onClick={activate("منطقة جلوس المراجع", "اختار المتدرب مقاعد الجلوس المخصصة للمراجع داخل العيادة.")} {...pointer}>
          <boxGeometry args={[2.35, 0.42, 0.86]} />
          <meshStandardMaterial color="#8b9188" roughness={0.88} />
        </mesh>
        <mesh position={[0, 1.02, -0.31]} castShadow>
          <boxGeometry args={[2.35, 0.94, 0.24]} />
          <meshStandardMaterial color="#777f78" roughness={0.9} />
        </mesh>
        {[-1.18, 1.18].map((x) => (
          <mesh key={x} position={[x, 0.76, 0.02]} castShadow>
            <boxGeometry args={[0.16, 0.82, 0.94]} />
            <meshStandardMaterial color="#65756d" roughness={0.86} />
          </mesh>
        ))}
        {[-0.72, 0, 0.72].map((x) => (
          <mesh key={x} position={[x, 0.73, 0.06]} rotation={[0, 0, (x === 0 ? 0 : x * 0.025)]}>
            <boxGeometry args={[0.55, 0.3, 0.72]} />
            <meshStandardMaterial color="#a6aaa0" roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0, 0.28, 0]}>
          <boxGeometry args={[2.05, 0.12, 0.68]} />
          <meshStandardMaterial color="#5f665f" roughness={0.8} />
        </mesh>
      </group>
      <group position={[-1.6, 0, -1.28]}>
        <mesh position={[0, 0.48, 0]} castShadow>
          <boxGeometry args={[1.2, 0.1, 0.72]} />
          <meshStandardMaterial color="#8b674a" roughness={0.42} />
        </mesh>
        {[-0.48, 0.48].map((x) => (
          <mesh key={x} position={[x, 0.23, 0]}>
            <boxGeometry args={[0.07, 0.46, 0.07]} />
            <meshStandardMaterial color="#5b5147" metalness={0.18} roughness={0.55} />
          </mesh>
        ))}
        <mesh position={[0, 0.57, 0]}>
          <boxGeometry args={[0.4, 0.018, 0.25]} />
          <meshStandardMaterial color="#f1ece0" roughness={0.9} />
        </mesh>
      </group>

      {/* Reference library */}
      <group position={[-5.55, 0, -4.55]}>
        <mesh position={[0, 1.42, 0]} castShadow
          onClick={activate("مكتبة المراجع", "اختار المتدرب مكتبة المراجع والأدوات المهنية.")} {...pointer}>
          <boxGeometry args={[1.45, 2.85, 0.46]} />
          <meshStandardMaterial color="#806044" roughness={0.56} />
        </mesh>
        {[-0.65, -0.05, 0.55, 1.15, 1.75, 2.35].map((y) => (
          <mesh key={y} position={[0, y, 0.25]}>
            <boxGeometry args={[1.35, 0.055, 0.5]} />
            <meshStandardMaterial color="#bb9a72" roughness={0.56} />
          </mesh>
        ))}
        {Array.from({ length: 15 }).map((_, index) => (
          <mesh key={index} position={[-0.55 + (index % 5) * 0.27, 0.16 + Math.floor(index / 5) * 0.61, 0.12]} rotation={[0, 0, (index % 3 - 1) * 0.045]}>
            <boxGeometry args={[0.17, 0.39 + (index % 3) * 0.05, 0.18]} />
            <meshStandardMaterial color={["#718e83", "#b58a62", "#9c7770", "#c3b9a5"][index % 4]} roughness={0.88} />
          </mesh>
        ))}
      </group>

      {/* Plant and clinical side cabinet */}
      <group position={[-5.0, 0, -1.8]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.28, 0.34, 0.58, 32]} />
          <meshStandardMaterial color="#9d876e" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.035, 0.06, 0.5, 12]} />
          <meshStandardMaterial color="#6a7655" roughness={0.95} />
        </mesh>
        {Array.from({ length: 9 }).map((_, index) => (
          <mesh key={index} position={[Math.sin(index * 2.4) * 0.23, 0.95 + (index % 3) * 0.12, Math.cos(index * 2.4) * 0.19]} rotation={[0.3, index, Math.cos(index) * 0.45]} scale={[0.55, 1.05, 0.23]}>
            <sphereGeometry args={[0.32, 16, 12]} />
            <meshStandardMaterial color={index % 2 ? "#65876b" : "#789776"} roughness={0.92} />
          </mesh>
        ))}
      </group>
      <group position={[5.4, 0, -1.8]}>
        <mesh position={[0, 0.74, 0]} castShadow
          onClick={activate("خزانة الأدوات", "تفاعل المتدرب مع خزانة أدوات العيادة.")} {...pointer}>
          <boxGeometry args={[1.15, 1.45, 0.58]} />
          <meshStandardMaterial color="#d5d3ca" roughness={0.82} />
        </mesh>
        <mesh position={[0, 1.52, 0]}>
          <boxGeometry args={[1.18, 0.1, 0.62]} />
          <meshStandardMaterial color="#9d9a8e" roughness={0.64} />
        </mesh>
        <mesh position={[0, 0.72, 0.31]}>
          <boxGeometry args={[0.045, 0.16, 0.035]} />
          <meshStandardMaterial color="#8a806e" metalness={0.55} roughness={0.35} />
        </mesh>
      </group>

      {/* Wall art and soft architectural lighting */}
      <group position={[6.82, 3.35, -2.65]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <boxGeometry args={[1.2, 1.65, 0.09]} />
          <meshStandardMaterial color="#b99e7e" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, 0.055]}>
          <planeGeometry args={[1.06, 1.5]} />
          <meshBasicMaterial color="#d8e2d9" />
        </mesh>
        <CanvasLabel text="الصحة النفسية" position={[0, 0.05, 0.07]} size={[0.95, 0.24]} fontSize={21} color="#466c61" />
        <CanvasLabel text="رعاية · دعم · تمكين" position={[0, -0.25, 0.07]} size={[0.95, 0.2]} fontSize={16} color="#65796f" />
      </group>
      <mesh position={[0, 5.98, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[8.5, 0.05, 0.05]} />
        <meshStandardMaterial color="#ded9ce" />
      </mesh>
    </group>
  );
}

function ClinicScene({ props }: { props: ClinicalRoomStageProps }) {
  const lastEnteredRoom = useRef<string | null>(null);

  useEffect(() => {
    if (lastEnteredRoom.current === props.roomId) return;
    lastEnteredRoom.current = props.roomId;
    props.onRoomEvent?.(
      "clinic_room_entered",
      "دخل المتدرب إلى " + props.roomLabel + "؛ أصبحت نقاط الغرفة والطبيب متاحة للتفاعل الفردي.",
    );
  }, [props.roomId, props.roomLabel, props.onRoomEvent]);

  const selectDoctor = () => {
    props.onSelect("الطبيب النفسي السعودي");
    props.onRoomEvent?.("doctor_selected", "تم تحديد الطبيب النفسي السعودي الافتراضي داخل العيادة.");
  };

  const selectRoomTarget = (target: string, eventLabel: string) => {
    props.onSelect(target);
    props.onRoomEvent?.("clinic_object_selected", eventLabel);
  };

  return (
    <group>
      <HeadsetAssessmentTelemetry onRoomEvent={props.onRoomEvent} enabled={props.spatialTelemetryEnabled} />
      <HandTrackingTelemetry onRoomEvent={props.onRoomEvent} enabled={props.spatialTelemetryEnabled} />

      <Clinic3DRoom onSelectTarget={selectRoomTarget} />

      {props.avatarModelUrl ? (
        <Suspense fallback={<DoctorAssetPending />}>
          <RealisticDoctor
            modelUrl={props.avatarModelUrl}
            speaking={props.avatarSpeaking}
            speechLevel={props.avatarSpeechLevel}
            motion={props.avatarMotion}
            onSelect={selectDoctor}
          />
        </Suspense>
      ) : (
        <DoctorAssetPending />
      )}

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
      props.onStartRealtimeVoice();
      props.onRoomEvent?.("clinic_voice_start_requested", "طلب المتدرب بدء الحوار الصوتي الحي بعد نجاح دخول جلسة WebXR.");
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
        <button type="button" onClick={enterVR}>دخول VR وبدء الحوار مع الطبيب</button>
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
