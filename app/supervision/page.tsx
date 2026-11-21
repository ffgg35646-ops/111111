"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./supervision.css";
import { ArrowRight, DoorOpen, ShieldCheck, Users, Video } from "lucide-react";

export default function SupervisionPage() {
  const router = useRouter();
  const [supervisorName,setSupervisorName] = useState("");
  const [traineeName,setTraineeName] = useState("");
  const [traineeCode,setTraineeCode] = useState("");
  const [scenarioTitle,setScenarioTitle] = useState("");
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  const createRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/supervision/rooms", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        credentials:"same-origin",
        body:JSON.stringify({supervisorName,traineeName,traineeCode,scenarioTitle}),
      });
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || "تعذر إنشاء الغرفة.");
      const inviteUrl = new URL("/supervision/room",window.location.origin);
      inviteUrl.hash = new URLSearchParams({
        room:result.roomName,
        token:result.traineeInviteToken,
        serverUrl:result.serverUrl,
        role:"trainee",
      }).toString();

      sessionStorage.setItem("clinical-room-token",result.supervisorToken);
      sessionStorage.setItem("clinical-vr-device-token",result.vrDeviceToken);
      sessionStorage.setItem("clinical-room-role","supervisor");
      sessionStorage.setItem("clinical-livekit-url",result.serverUrl);
      sessionStorage.setItem("clinical-room-name",result.roomName);
      sessionStorage.setItem("clinical-trainee-code",result.traineeCode);
      sessionStorage.setItem("clinical-trainee-name",result.traineeName);
      sessionStorage.setItem("clinical-supervisor-name",result.supervisorName);
      sessionStorage.setItem("clinical-scenario-title",result.scenarioTitle);
      sessionStorage.setItem("clinical-trainee-invite",inviteUrl.toString());
      router.push(`/supervision/room?room=${encodeURIComponent(result.roomName)}`);
    } catch(cause) {
      setError(cause instanceof Error ? cause.message : "تعذر إنشاء الغرفة.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="supervision-launch" dir="rtl">
    <header className="supervision-launch-top">
      <Link href="/" className="supervision-back"><ArrowRight size={17}/> العودة إلى لوحة التحكم</Link>
      <span><ShieldCheck size={16}/> جلسة بإذن المشرف والمتدرب</span>
    </header>
    <section className="supervision-launch-content">
      <div className="supervision-intro">
        <div className="supervision-symbol"><Users size={23}/></div>
        <div className="supervision-eyebrow">MULTI-USER CLINICAL SUPERVISION</div>
        <h1>إنشاء غرفة إشراف سريري مشتركة</h1>
        <p>ينضم المشرف الأكاديمي والمتدرب إلى نفس الغرفة بالصوت والصورة، مع قناة توجيه فورية وتسجيل مؤشرات VR وتقييم الكفاءات بعد الجلسة.</p>
      </div>
      <div className="supervision-launch-grid">
        <form className="supervision-create-card" onSubmit={createRoom}>
          <div className="launch-card-head"><Video size={18}/><div><strong>بيانات الجلسة</strong><small>مشاركان بشريان مع اتصال بيانات مستقل لمحرك VR</small></div></div>
          <label>اسم المشرف الأكاديمي<input required maxLength={80} value={supervisorName} onChange={event=>setSupervisorName(event.target.value)} placeholder="اسم المشرف"/></label>
          <label>اسم المتدرب<input required maxLength={80} value={traineeName} onChange={event=>setTraineeName(event.target.value)} placeholder="اسم المتدرب"/></label>
          <label>رمز ملف المتدرب<input required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]{3,40}" value={traineeCode} onChange={event=>setTraineeCode(event.target.value.toUpperCase())} placeholder="مثال: TRN-2048"/></label>
          <label>عنوان السيناريو<input required maxLength={160} value={scenarioTitle} onChange={event=>setScenarioTitle(event.target.value)} placeholder="مثال: أخذ التاريخ المرضي والتواصل مع الأسرة"/></label>
          {error&&<p className="supervision-launch-error" role="alert">{error}</p>}
          <button className="create-supervision-button" type="submit" disabled={loading}>{loading?"جارٍ إنشاء الغرفة...":<><DoorOpen size={17}/> إنشاء الغرفة وبدء الجلسة</>}</button>
          <small className="launch-note">رابط المتدرب يُنشأ تلقائياً وينتهي بعد ساعتين. أرسله للشخص المقصود فقط.</small>
        </form>
        <aside className="supervision-setup-card">
          <h2>ماذا يحدث داخل الغرفة؟</h2>
          <div className="setup-step"><span>01</span><div><strong>اتصال حي بالصوت والصورة</strong><p>يدخل الطرفان إلى نفس الغرفة مع التحكم بالميكروفون والكاميرا ومشاركة الشاشة.</p></div></div>
          <div className="setup-step"><span>02</span><div><strong>توجيه أكاديمي لحظي</strong><p>يرسل المشرف الملاحظات مباشرة أثناء تنفيذ الحالة، ويستطيع المتدرب الرد عليها.</p></div></div>
          <div className="setup-step"><span>03</span><div><strong>استقبال بيانات VR</strong><p>تستقبل الغرفة أحداث التموضع والنظر والأداء التي يرسلها محرك VR المتصل.</p></div></div>
          <div className="setup-step"><span>04</span><div><strong>تقرير الكفاءات المهنية</strong><p>يسجل المشرف درجات المحاور ويحفظ التقرير في ملف المتدرب لعرض سجل التقييمات.</p></div></div>
          <Link href="/competencies" className="view-competencies-link">فتح ملف الكفاءات المهنية <ArrowRight size={15}/></Link>
          <p className="setup-security-note"><ShieldCheck size={15}/> لا يبدأ تشغيل الكاميرا أو الميكروفون إلا بعد موافقة المستخدم من المتصفح. لا تُسجل الجلسة تلقائياً.</p>
        </aside>
      </div>
    </section>
  </main>;
}
