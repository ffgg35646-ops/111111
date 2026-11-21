"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { createXRStore, IfInSessionMode, XR } from "@react-three/xr";
import { CanvasTexture, SRGBColorSpace } from "three";
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

function PatientFigure({ onSelect }: { onSelect: () => void }) {
  return (
    <group
      position={[0, 0, -2.35]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 1.12, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.72, 5, 14]} />
        <meshStandardMaterial color="#668e91" roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.86, 0.015]} castShadow>
        <sphereGeometry args={[0.235, 28, 24]} />
        <meshStandardMaterial color="#bd896f" roughness={0.86} />
      </mesh>
      <mesh position={[0, 1.63, 0.015]} castShadow>
        <cylinderGeometry args={[0.085, 0.105, 0.16, 16]} />
        <meshStandardMaterial color="#bd896f" />
      </mesh>
      <mesh position={[-0.075, 1.91, 0.22]}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshBasicMaterial color="#263940" />
      </mesh>
      <mesh position={[0.075, 1.91, 0.22]}>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshBasicMaterial color="#263940" />
      </mesh>
      <mesh position={[0, 1.83, 0.235]}>
        <boxGeometry args={[0.055, 0.012, 0.012]} />
        <meshBasicMaterial color="#805d52" />
      </mesh>
      <mesh position={[-0.35, 1.22, 0]} rotation={[0, 0, -0.34]} castShadow>
        <capsuleGeometry args={[0.085, 0.58, 4, 10]} />
        <meshStandardMaterial color="#bd896f" />
      </mesh>
      <mesh position={[0.35, 1.22, 0]} rotation={[0, 0, 0.34]} castShadow>
        <capsuleGeometry args={[0.085, 0.58, 4, 10]} />
        <meshStandardMaterial color="#bd896f" />
      </mesh>
      <mesh position={[-0.15, 0.48, 0]} castShadow>
        <capsuleGeometry args={[0.095, 0.55, 4, 10]} />
        <meshStandardMaterial color="#334c58" />
      </mesh>
      <mesh position={[0.15, 0.48, 0]} castShadow>
        <capsuleGeometry args={[0.095, 0.55, 4, 10]} />
        <meshStandardMaterial color="#334c58" />
      </mesh>
    </group>
  );
}

function AssessmentBoard({
  scenarioTitle,
  step,
  stepIndex,
  stepCount,
  selectedChoiceId,
  completed,
  score,
  saving,
  canFinish,
  onChoose,
  onPrevious,
  onNext,
  onFinish,
  onRestart,
}: Omit<ClinicalRoomStageProps, "onSelect" | "onRoomEvent">) {
  return (
    <group position={[-2.7, 1.55, -0.35]} rotation={[0, 0.32, 0]}>
      <mesh>
        <planeGeometry args={[3.12, 2.72]} />
        <meshStandardMaterial color="#142f39" roughness={0.82} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.31, 0.012]}>
        <planeGeometry args={[3.12, 0.035]} />
        <meshBasicMaterial color="#5fc4b3" />
      </mesh>

      {completed ? (
        <>
          <CanvasLabel text="اكتملت المحاكاة" position={[0, 0.92, 0.025]} size={[2.8, 0.32]} fontSize={48} />
          <CanvasLabel text={scenarioTitle} position={[0, 0.58, 0.025]} size={[2.8, 0.3]} fontSize={31} color="#a7c9c7" />
          <CanvasLabel text={String(score ?? 0) + " / 100"} position={[0, 0.04, 0.025]} size={[2.8, 0.72]} fontSize={112} color="#75d6c3" />
          <CanvasLabel text="تم حفظ نتيجة التدريب في سجل النشاط" position={[0, -0.48, 0.025]} size={[2.8, 0.28]} fontSize={29} color="#d0e0e0" />
          <WorldButton label="إعادة المحاكاة" position={[0, -1.05, 0.045]} onClick={onRestart} width={2.4} height={0.34} />
        </>
      ) : (
        <>
          <CanvasLabel text={scenarioTitle} position={[0, 1.08, 0.025]} size={[2.86, 0.27]} fontSize={33} />
          <CanvasLabel
            text={"المرحلة " + (stepIndex + 1) + " من " + stepCount}
            position={[0, 0.81, 0.025]}
            size={[2.82, 0.22]}
            fontSize={29}
            color="#73cbbd"
          />
          <CanvasLabel text={step.focus} position={[0, 0.55, 0.025]} size={[2.84, 0.24]} fontSize={31} color="#c5d9d8" />
          <CanvasLabel text={step.prompt} position={[0, 0.31, 0.025]} size={[2.84, 0.36]} fontSize={25} color="#e1ebeb" />
          {step.choices.slice(0, 4).map((choice, index) => (
            <WorldButton
              key={choice.id}
              label={choice.label}
              position={[0, 0.015 - index * 0.34, 0.045]}
              onClick={() => onChoose(choice.id)}
              selected={selectedChoiceId === choice.id}
              width={2.84}
              height={0.29}
            />
          ))}
          <WorldButton
            label="السابق"
            position={[-0.78, -1.23, 0.045]}
            onClick={onPrevious}
            disabled={stepIndex === 0}
            width={1.18}
            height={0.28}
          />
          <WorldButton
            label={stepIndex === stepCount - 1 ? (saving ? "جارٍ الحفظ" : "إنهاء وتقييم") : "المرحلة التالية"}
            position={[0.78, -1.23, 0.045]}
            onClick={stepIndex === stepCount - 1 ? onFinish : onNext}
            disabled={saving || (stepIndex === stepCount - 1 ? !canFinish : !selectedChoiceId)}
            width={1.4}
            height={0.28}
          />
        </>
      )}
    </group>
  );
}

function ClinicScene({
  onSelect,
  onRoomEvent,
  boardProps,
}: {
  onSelect: (target: string) => void;
  onRoomEvent?: (type: string, label: string) => void;
  boardProps: Omit<ClinicalRoomStageProps, "onSelect" | "onRoomEvent">;
}) {
  const selectPatient = () => {
    onSelect("الشخصية الافتراضية");
    onRoomEvent?.("patient_selected", "تم تحديد الشخصية الافتراضية داخل القاعة");
  };

  const openCaseFile = () => {
    onSelect("ملف الحالة");
    onRoomEvent?.("case_file_opened", "فتح ملف الحالة داخل القاعة");
  };

  return (
    <group>
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
      <PatientFigure onSelect={selectPatient} />

      <mesh position={[-3.2, 0.48, 1.18]} castShadow>
        <boxGeometry args={[0.9, 0.1, 0.68]} />
        <meshStandardMaterial color="#b68f6a" />
      </mesh>
      <group
        position={[-3.2, 0.62, 1.18]}
        onClick={(event) => {
          event.stopPropagation();
          openCaseFile();
        }}
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

      <AssessmentBoard {...boardProps} />
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
      setXrMessage("تم تشغيل وضع الواقع الافتراضي. استخدم المؤشر أو وحدات التحكم لاختيار الإجابات داخل القاعة.");
    } catch (error) {
      setXrMessage(error instanceof Error ? error.message : "تعذر تشغيل وضع VR في هذا المتصفح.");
    }
  };

  const boardProps = {
    scenarioTitle: props.scenarioTitle,
    step: props.step,
    stepIndex: props.stepIndex,
    stepCount: props.stepCount,
    selectedChoiceId: props.selectedChoiceId,
    completed: props.completed,
    score: props.score,
    saving: props.saving,
    canFinish: props.canFinish,
    onChoose: props.onChoose,
    onPrevious: props.onPrevious,
    onNext: props.onNext,
    onFinish: props.onFinish,
    onRestart: props.onRestart,
  };

  return (
    <div className="clinical-room-canvas">
      <div className="clinical-room-actions">
        <button type="button" onClick={enterVR}>دخول VR بالنظارة</button>
        <span>التقييم التفاعلي موجود داخل القاعة</span>
        {xrMessage && <small role="status">{xrMessage}</small>}
      </div>
      <Canvas shadows camera={{ position: [0, 1.65, 6.5], fov: 50 }} dpr={[1, 1.5]}>
        <XR store={xrStore}>
          <color attach="background" args={["#eaf0f1"]} />
          <ambientLight intensity={1.35} />
          <directionalLight position={[4, 8, 5]} intensity={2.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
          <directionalLight position={[-5, 4, -3]} intensity={0.65} />
          <ClinicScene onSelect={props.onSelect} onRoomEvent={props.onRoomEvent} boardProps={boardProps} />
          <IfInSessionMode deny={["immersive-vr", "immersive-ar"]}>
            <OrbitControls makeDefault target={[0, 1.35, -1]} minDistance={2.7} maxDistance={13} maxPolarAngle={Math.PI / 2.03} />
          </IfInSessionMode>
        </XR>
      </Canvas>
      <div className="clinical-room-compass"><span /> قاعة سريرية تفاعلية · WebXR · التقييم داخل المشهد</div>
    </div>
  );
}
