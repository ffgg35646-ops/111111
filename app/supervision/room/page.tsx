"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle, ShieldAlert } from "lucide-react";

type RoomConfig = {
  token:string; vrDeviceToken:string; serverUrl:string; roomName:string; role:"supervisor"|"trainee";
  supervisorName:string; traineeName:string; traineeCode:string; scenarioTitle:string; inviteUrl:string;
};

const LiveSupervisionRoom = dynamic(() => import("@/components/live-supervision-room"), {
  ssr:false,
  loading:()=><div className="room-loading"><LoaderCircle size={20}/> تجهيز واجهة الغرفة المشتركة...</div>,
});

export default function SupervisionRoomPage() {
  const [config,setConfig] = useState<RoomConfig|null>(null);
  const [error,setError] = useState("");

  useEffect(()=>{
    let frameId = 0;
    frameId = window.requestAnimationFrame(() => {
    try {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/,""));
      const params = new URLSearchParams(window.location.search);
      const inviteToken = hash.get("token");
      const inviteRoom = hash.get("room");
      const inviteServerUrl = hash.get("serverUrl");
      const inviteRole = hash.get("role");

      if(inviteToken && inviteRoom && inviteServerUrl && inviteRole === "trainee"){
        sessionStorage.setItem("clinical-room-token",inviteToken);
        sessionStorage.setItem("clinical-room-role","trainee");
        sessionStorage.setItem("clinical-livekit-url",inviteServerUrl);
        sessionStorage.setItem("clinical-room-name",inviteRoom);
        window.history.replaceState(null,"",window.location.pathname);
      }

      const token = sessionStorage.getItem("clinical-room-token");
      const serverUrl = sessionStorage.getItem("clinical-livekit-url");
      const roomName = params.get("room") || sessionStorage.getItem("clinical-room-name");
      const role = sessionStorage.getItem("clinical-room-role");
      if(!token || !serverUrl || !roomName || (role!=="supervisor" && role!=="trainee")){
        setError("رابط الغرفة غير صالح أو انتهت صلاحيته. اطلب رابط دعوة جديداً من المشرف الأكاديمي.");
        return;
      }

      setConfig({
        token,
        vrDeviceToken:sessionStorage.getItem("clinical-vr-device-token") || "",
        serverUrl, roomName, role,
        supervisorName:sessionStorage.getItem("clinical-supervisor-name") || "",
        traineeName:sessionStorage.getItem("clinical-trainee-name") || "",
        traineeCode:sessionStorage.getItem("clinical-trainee-code") || "",
        scenarioTitle:sessionStorage.getItem("clinical-scenario-title") || "جلسة إشراف سريري",
        inviteUrl:sessionStorage.getItem("clinical-trainee-invite") || "",
      });
    } catch {
      setError("تعذر قراءة بيانات الغرفة من المتصفح.");
    }
    });
    return () => window.cancelAnimationFrame(frameId);
  },[]);

  return <main className="room-page" dir="rtl">
    <header className="room-page-header"><Link href="/"><ArrowRight size={16}/> العودة للوحة التحكم</Link><span>غرفة الإشراف السريري</span></header>
    {config ? <LiveSupervisionRoom {...config} liveKitToken={config.token}/> :
      <section className="room-message">{error ? <><ShieldAlert size={25}/><strong>تعذر الانضمام إلى الغرفة</strong><p>{error}</p><Link href="/supervision">إنشاء غرفة أو بدء دعوة جديدة</Link></> : <><LoaderCircle size={23}/><strong>التحقق من رابط الغرفة...</strong></>}</section>}
    <style jsx>{`
      .room-page{min-height:100vh;background:#f2f5f6;color:#334a55}
      .room-page-header{height:56px;background:#fff;border-bottom:1px solid #e4ebee;display:flex;align-items:center;justify-content:space-between;padding:0 20px}
      .room-page-header a{display:flex;align-items:center;gap:7px;text-decoration:none;color:#607680;font-size:10px}
      .room-page-header span{color:#188379;font-size:10px;font-weight:700}
      .room-message,.room-loading{min-height:55vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;text-align:center;color:#21877e}
      .room-message strong{color:#394f5a;font-size:14px}.room-message p{max-width:400px;color:#84939a;font-size:10px;line-height:1.8;margin:0}
      .room-message a{color:#167f77;font-size:10px}.room-loading{min-height:70vh;font-size:11px}
    `}</style>
  </main>;
}
