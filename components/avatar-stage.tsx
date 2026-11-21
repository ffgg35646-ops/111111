"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function LoadedModel({ url, expression, motion }: { url: string; expression: string; motion: string }) {
  const gltf = useGLTF(url);
  const cloned = useMemo(()=>gltf.scene.clone(true),[gltf.scene]);
  const { actions, names, ref } = useAnimations(gltf.animations);
  useEffect(()=>{
    Object.values(actions).forEach(action=>action?.fadeOut(0.2));
    const preferred = names.find(name=>name.toLowerCase().includes(motion.toLowerCase()))
      ?? names.find(name=>motion==="idle"&&name.toLowerCase().includes("idle"))
      ?? (motion==="talk"?names.find(name=>/talk|speak/i.test(name)):undefined)
      ?? (motion==="listen"?names.find(name=>/listen/i.test(name)):undefined)
      ?? (motion==="nod"?names.find(name=>/nod/i.test(name)):undefined);
    if(preferred){actions[preferred]?.reset().fadeIn(0.2).play();}
    return ()=>{Object.values(actions).forEach(action=>action?.fadeOut(0.1));};
  },[actions,names,motion]);
  useFrame(()=>{
    const target = expression.toLowerCase();
    cloned.traverse(object=>{
      const mesh=object as THREE.Mesh;
      const morphDictionary = mesh.morphTargetDictionary;
      const morphInfluences = mesh.morphTargetInfluences;
      if(!mesh.isMesh||!morphDictionary||!morphInfluences)return;
      Object.entries(morphDictionary).forEach(([name,index])=>{
        const key=name.toLowerCase();
        const matches=(target==="محايد"&&/neutral|default/i.test(key))
          ||(target==="قلق"&&/fear|worried|anxious/i.test(key))
          ||(target==="حزن"&&/sad|frown/i.test(key))
          ||(target==="غضب"&&/angry|mad/i.test(key))
          ||(target==="ابتسامة"&&/smile|happy/i.test(key))
          ||(target==="بكاء تمثيلي"&&/cry|sad/i.test(key))
          ||(target==="استغراب"&&/surprise|astonish/i.test(key))
          ||(target==="خوف"&&/fear|scared/i.test(key))
          ||(target==="خجل"&&/shy|embarrass/i.test(key))
          ||(target==="فضول"&&/curious/i.test(key))
          ||(target==="تردد"&&/uncertain|hesitat/i.test(key))
          ||(target==="ارتياح"&&/relax|relief/i.test(key))
          ||(target==="توتر"&&/nervous|tense/i.test(key))
          ||(target==="انزعاج"&&/annoy|disgust/i.test(key))
          ||(target==="اهتمام"&&/interest|attentive/i.test(key));
        morphInfluences[index]=THREE.MathUtils.damp(morphInfluences[index] ?? 0,matches?0.85:0,5,1/60);
      });
    });
  });
  return <group ref={ref} position={[0,-1,0]}><primitive object={cloned}/></group>;
}

export default function AvatarStage({modelUrl,expression,motion}:{modelUrl:string|null;expression:string;motion:string}) {
  return <Canvas camera={{position:[0,1.35,3.6],fov:34}} dpr={[1,1.75]} shadows>
    <color attach="background" args={["#eef2f3"]}/>
    <ambientLight intensity={1.5}/>
    <directionalLight position={[3,5,4]} intensity={2.2} castShadow/>
    <directionalLight position={[-3,2,-2]} intensity={0.8}/>
    <Grid position={[0,-1.01,0]} args={[10,10]} cellSize={0.5} cellThickness={0.5} sectionSize={2} sectionThickness={1} fadeDistance={12} infiniteGrid/>
    {modelUrl&&<Suspense fallback={null}><LoadedModel url={modelUrl} expression={expression} motion={motion}/></Suspense>}
    <OrbitControls makeDefault target={[0,0,0]} minDistance={1.3} maxDistance={7} maxPolarAngle={Math.PI/1.85}/>
  </Canvas>;
}
