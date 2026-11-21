"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";

function Chair({ position, rotation = 0, tone = "#547984" }: {position:[number,number,number];rotation?:number;tone?:string}) {
  return <group position={position} rotation={[0,rotation,0]}>
    <mesh position={[0,.52,0]} castShadow><boxGeometry args={[.68,.12,.68]}/><meshStandardMaterial color={tone}/></mesh>
    <mesh position={[0,.95,-.28]} castShadow><boxGeometry args={[.68,.82,.1]}/><meshStandardMaterial color={tone}/></mesh>
    {[[-.25,.23,-.24],[.25,.23,-.24],[-.25,.23,.24],[.25,.23,.24]].map((point,index)=>
      <mesh key={index} position={point as [number,number,number]} castShadow><cylinderGeometry args={[.035,.035,.46,10]}/><meshStandardMaterial color="#63747c"/></mesh>
    )}
  </group>;
}

function PatientFigure({ position, onSelect }: {position:[number,number,number];onSelect:()=>void}) {
  return <group position={position} onClick={(event)=>{event.stopPropagation();onSelect();}} onPointerOver={()=>{document.body.style.cursor="pointer";}} onPointerOut={()=>{document.body.style.cursor="auto";}}>
    <mesh position={[0,1.08,0]} castShadow><capsuleGeometry args={[.28,.72,5,12]}/><meshStandardMaterial color="#6e9a94"/></mesh>
    <mesh position={[0,1.82,0]} castShadow><sphereGeometry args={[.23,22,22]}/><meshStandardMaterial color="#c58e71"/></mesh>
    <mesh position={[-.34,1.22,0]} rotation={[0,0,-.35]} castShadow><capsuleGeometry args={[.08,.55,4,10]}/><meshStandardMaterial color="#c58e71"/></mesh>
    <mesh position={[.34,1.22,0]} rotation={[0,0,.35]} castShadow><capsuleGeometry args={[.08,.55,4,10]}/><meshStandardMaterial color="#c58e71"/></mesh>
    <mesh position={[-.14,.45,0]} castShadow><capsuleGeometry args={[.09,.55,4,10]}/><meshStandardMaterial color="#334c58"/></mesh>
    <mesh position={[.14,.45,0]} castShadow><capsuleGeometry args={[.09,.55,4,10]}/><meshStandardMaterial color="#334c58"/></mesh>
  </group>;
}

function ClinicScene({ onSelect }: {onSelect:(target:string)=>void}) {
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.04,0]} receiveShadow>
      <planeGeometry args={[9,8]}/><meshStandardMaterial color="#e7edef" roughness={.9}/>
    </mesh>
    <mesh position={[0,1.45,-4]} receiveShadow>
      <boxGeometry args={[9,3,.12]}/><meshStandardMaterial color="#f8fbfb"/>
    </mesh>
    <mesh position={[-4.45,1.45,0]} receiveShadow>
      <boxGeometry args={[.12,3,8]}/><meshStandardMaterial color="#f4f8f8"/>
    </mesh>
    <mesh position={[4.45,1.45,-1.15]} receiveShadow>
      <boxGeometry args={[.12,3,5.7]}/><meshStandardMaterial color="#f4f8f8"/>
    </mesh>
    <mesh position={[0,2.96,0]}>
      <boxGeometry args={[9,.1,8]}/><meshStandardMaterial color="#dbe5e7"/>
    </mesh>
    <mesh position={[0,.78,-1.1]} castShadow receiveShadow>
      <boxGeometry args={[2.25,.14,1.05]}/><meshStandardMaterial color="#b68f6a"/>
    </mesh>
    {[[-1,.37,-.72],[1,.37,-.72],[-1,.37,-1.48],[1,.37,-1.48]].map((point,index)=>
      <mesh key={index} position={point as [number,number,number]} castShadow><boxGeometry args={[.1,.76,.1]}/><meshStandardMaterial color="#8b735d"/></mesh>
    )}
    <mesh position={[0,.12,-1.1]} castShadow><boxGeometry args={[1.9,.05,.8]}/><meshStandardMaterial color="#e8e1d7"/></mesh>
    <Chair position={[0,0,-2.3]} rotation={0} tone="#59857f"/>
    <Chair position={[0,0,.25]} rotation={Math.PI} tone="#71828c"/>
    <Chair position={[-2.35,0,-2.6]} rotation={.45} tone="#82959b"/>
    <mesh position={[-2.7,1.8,-3.88]}>
      <boxGeometry args={[1.5,.72,.05]}/><meshStandardMaterial color="#edf3f3"/>
    </mesh>
    <mesh position={[-2.7,1.8,-3.82]}>
      <boxGeometry args={[1.36,.58,.03]}/><meshStandardMaterial color="#d5e6e3"/>
    </mesh>
    <mesh position={[2.6,1.1,-3.83]}>
      <boxGeometry args={[1.2,1.5,.08]}/><meshStandardMaterial color="#a5c3bd"/>
    </mesh>
    <mesh position={[2.6,1.85,-3.75]}>
      <boxGeometry args={[1.08,.16,.08]}/><meshStandardMaterial color="#638c85"/>
    </mesh>
    <mesh position={[-3.35,.8,1.3]} castShadow onClick={(event)=>{event.stopPropagation();onSelect("ملف الحالة")}}>
      <boxGeometry args={[.75,.05,.55]}/><meshStandardMaterial color="#c9d4d5"/>
    </mesh>
    <PatientFigure position={[0,0,-2.3]} onSelect={()=>onSelect("الشخصية الافتراضية")} />
    <mesh position={[0,2.6,-2.25]}>
      <sphereGeometry args={[.055,12,12]}/><meshStandardMaterial color="#f0c56e" emissive="#e2ad42" emissiveIntensity={.4}/>
    </mesh>
    <mesh position={[-3.2,2.7,-2.6]}>
      <sphereGeometry args={[.055,12,12]}/><meshStandardMaterial color="#8ab9af" emissive="#6b9c91" emissiveIntensity={.3}/>
    </mesh>
    <Grid position={[0,-.035,0]} args={[9,8]} cellSize={.5} cellThickness={.35} sectionSize={2} sectionThickness={.7} fadeDistance={12} infiniteGrid />
  </group>;
}

export default function ClinicalRoomStage({ onSelect }: {onSelect:(target:string)=>void}) {
  return <div className="clinical-room-canvas">
    <Canvas shadows camera={{position:[7,6.2,8.5],fov:42}} dpr={[1,1.5]}>
      <color attach="background" args={["#eaf0f1"]}/>
      <ambientLight intensity={1.35}/>
      <directionalLight position={[4,8,5]} intensity={2.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <directionalLight position={[-5,4,-3]} intensity={.65}/>
      <ClinicScene onSelect={onSelect}/>
      <OrbitControls makeDefault target={[0,1,0]} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI/2.04} />
    </Canvas>
    <div className="clinical-room-compass"><span/> معاينة غرفة تفاعلية ثلاثية الأبعاد</div>
  </div>;
}
