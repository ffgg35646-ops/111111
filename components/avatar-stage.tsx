"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";

type MorphMesh = THREE.Mesh & {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
};

const FACE_PRESETS: Record<string, Record<string, number>> = {
  "محايد": {},
  "اهتمام": { browInnerUp: 0.18, eyeWideLeft: 0.1, eyeWideRight: 0.1, mouthSmileLeft: 0.08, mouthSmileRight: 0.08 },
  "ابتسامة": { mouthSmileLeft: 0.32, mouthSmileRight: 0.32, cheekSquintLeft: 0.12, cheekSquintRight: 0.12 },
  "تأمل": { browDownLeft: 0.12, browDownRight: 0.12, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 },
  "قلق مهني": { browInnerUp: 0.28, mouthFrownLeft: 0.12, mouthFrownRight: 0.12 },
  "استغراب": { browInnerUp: 0.65, eyeWideLeft: 0.45, eyeWideRight: 0.45, jawOpen: 0.12 },
};

function LoadedModel({ url, expression, motion }: { url: string; expression: string; motion: string }) {
  const gltf = useGLTF(url);
  const { actions, names, ref } = useAnimations(gltf.animations);
  const blinkRef = useRef({ next: 2.8, started: -1 });
  const model = gltf.scene;

  const faceMeshes = useMemo(() => {
    const found: MorphMesh[] = [];
    model.traverse((object) => {
      const mesh = object as MorphMesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) found.push(mesh);
    });
    return found;
  }, [model]);

  const headBone = useMemo(() => {
    const matches: THREE.Bone[] = [];
    model.traverse((object) => {
      if ((object as THREE.Bone).isBone && /mixamorig:head|head$/i.test(object.name)) {
        matches.push(object as THREE.Bone);
      }
    });
    return matches[0] ?? null;
  }, [model]);

  const headBase = useMemo(
    () => headBone ? new THREE.Euler(headBone.rotation.x, headBone.rotation.y, headBone.rotation.z) : null,
    [headBone],
  );

  useEffect(() => {
    const preferredName = motion === "talk"
      ? names.find((name) => /talk|gestic/i.test(name))
      : motion === "listen"
        ? names.find((name) => /think|idle/i.test(name))
        : names.find((name) => /idle/i.test(name));
    const selected = preferredName ?? names.find((name) => /idle/i.test(name)) ?? names[0];

    Object.values(actions).forEach((action) => action?.fadeOut(0.2));
    if (selected) actions[selected]?.reset().fadeIn(0.25).play();

    return () => Object.values(actions).forEach((action) => action?.fadeOut(0.12));
  }, [actions, names, motion]);

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
    const targets = FACE_PRESETS[expression] ?? {};
    const speech = motion === "talk" ? 0.13 : 0;

    for (const mesh of faceMeshes) {
      const dictionary = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      const namesToUpdate = new Set([...Object.keys(targets), "jawOpen", "eyeBlinkLeft", "eyeBlinkRight"]);
      for (const name of namesToUpdate) {
        const index = dictionary[name];
        if (index === undefined) continue;
        let target = targets[name] ?? 0;
        if (name === "jawOpen") target = Math.max(target, speech);
        if (name === "eyeBlinkLeft" || name === "eyeBlinkRight") target = Math.max(target, blinkWeight);
        influences[index] = THREE.MathUtils.damp(influences[index] ?? 0, target, 14, delta);
      }
    }

    // Gentle head micro-movement keeps the listening/talking character from feeling frozen.
    if (headBone && headBase) {
      headBone.rotation.x = headBase.x + Math.sin(elapsed * 0.43) * 0.012;
      headBone.rotation.y = headBase.y + Math.sin(elapsed * 0.31) * 0.025;
      headBone.rotation.z = headBase.z + Math.sin(elapsed * 0.27) * 0.008;
    }
  });

  return <group ref={ref} position={[0, -1, 0]}><primitive object={model} /></group>;
}

export default function AvatarStage({ modelUrl, expression, motion }: { modelUrl: string | null; expression: string; motion: string }) {
  return (
    <Canvas camera={{ position: [0, 1.35, 3.6], fov: 34 }} dpr={[1, 1.5]} shadows>
      <color attach="background" args={["#eef2f3"]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[3, 5, 4]} intensity={2.0} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.85} />
      <Grid position={[0, -1.01, 0]} args={[10, 10]} cellSize={0.5} cellThickness={0.5} sectionSize={2} sectionThickness={1} fadeDistance={12} infiniteGrid />
      {modelUrl && <Suspense fallback={null}><LoadedModel url={modelUrl} expression={expression} motion={motion} /></Suspense>}
      <OrbitControls makeDefault target={[0, 0, 0]} minDistance={1.3} maxDistance={7} maxPolarAngle={Math.PI / 1.85} />
    </Canvas>
  );
}
