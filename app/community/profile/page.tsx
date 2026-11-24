"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ExternalLink, Save, ShieldCheck, UserRound } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import "../community.css";

type Profile = {
  userId: string; name: string; role: string; headline: string; specialty: string; organization: string;
  location: string; bio: string; credentials: string; website: string; linkedin: string;
  interests: string[]; directoryVisible: boolean; isOwn: boolean;
};
const emptyProfile: Profile = {
  userId: "", name: "", role: "", headline: "", specialty: "", organization: "", location: "",
  bio: "", credentials: "", website: "", linkedin: "", interests: [], directoryVisible: true, isOwn: true,
};
const roleNames: Record<string, string> = {
  admin: "مدير النظام", platform_manager: "مدير المنصة", supervisor: "مشرف مهني", trainer: "مدرب",
  trainee: "متدرب", consultant: "مستشار", accountant: "محاسب", support: "الدعم",
  content_manager: "مسؤول محتوى", quality_manager: "مسؤول جودة",
};

function CommunityProfileContent() {
  const search = useSearchParams();
  const targetId = search.get("userId") || "";
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [interestsText, setInterestsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const url = targetId ? "/api/community/profile?userId=" + encodeURIComponent(targetId) : "/api/community/profile";
    fetch(url, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل الملف المهني.");
      if (active && data.profile) {
        setProfile({ ...emptyProfile, ...data.profile });
        setInterestsText(Array.isArray(data.profile.interests) ? data.profile.interests.join(", ") : "");
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل الملف."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [targetId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/community/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, interests: interestsText.split(",").map((value) => value.trim()).filter(Boolean) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ الملف.");
      setNotice("تم حفظ ملفك المهني وتحديث ظهوره في دليل الممارسين.");
      setProfile((current) => ({ ...current, interests: interestsText.split(",").map((value) => value.trim()).filter(Boolean) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الحفظ."); }
    finally { setSaving(false); }
  }

  function update(field: keyof Profile, value: string | boolean) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <PlatformLayout title={profile.isOwn ? "ملفي المهني" : "الملف المهني للعضو"} description="بيانات تعريفية مهنية تساعد أعضاء اتزان على التعارف وتبادل الخبرات في إطار يحترم الخصوصية.">
      <div className="community-profile-page-top"><a href="/community"><ArrowRight size={14}/> العودة للمجتمع</a><a href="/community/members">دليل الممارسين</a></div>
      {loading ? <div className="portal-empty">جارٍ تحميل الملف...</div> : error && !profile.name ? <p className="community-alert error" role="alert">{error}</p> : (
        <section className="community-profile-sheet">
          <div className="community-profile-banner"><div className="community-profile-large-avatar"><UserRound size={31}/></div><div><span>ملف عضو اتزان</span><h2>{profile.name}</h2><p>{roleNames[profile.role] || "عضو المجتمع المهني"}</p></div></div>
          {profile.isOwn ? (
            <form className="community-profile-form" onSubmit={save}>
              <div className="community-profile-form-heading"><div><strong>بياناتك المهنية</strong><p>لا نطلب بيانات المستفيدين أو معلوماتهم الصحية.</p></div><ShieldCheck size={20}/></div>
              <label>المسمى المهني أو نبذة مختصرة<input maxLength={120} value={profile.headline} onChange={(event) => update("headline", event.target.value)} placeholder="مثال: أخصائي اجتماعي أول" /></label>
              <div className="community-profile-fields">
                <label>التخصص<input maxLength={100} value={profile.specialty} onChange={(event) => update("specialty", event.target.value)} placeholder="الخدمة الاجتماعية" /></label>
                <label>جهة العمل<input maxLength={120} value={profile.organization} onChange={(event) => update("organization", event.target.value)} placeholder="جهة العمل (اختياري)" /></label>
                <label>المدينة أو المنطقة<input maxLength={80} value={profile.location} onChange={(event) => update("location", event.target.value)} placeholder="المدينة" /></label>
                <label>المؤهلات والاعتمادات<input maxLength={240} value={profile.credentials} onChange={(event) => update("credentials", event.target.value)} placeholder="المؤهل أو الاعتماد المهني" /></label>
                <label>الموقع الإلكتروني<input type="url" value={profile.website} onChange={(event) => update("website", event.target.value)} placeholder="https://..." /></label>
                <label>LinkedIn<input type="url" value={profile.linkedin} onChange={(event) => update("linkedin", event.target.value)} placeholder="https://www.linkedin.com/in/..." /></label>
              </div>
              <label>نبذة مهنية<textarea rows={5} maxLength={1000} value={profile.bio} onChange={(event) => update("bio", event.target.value)} placeholder="اكتب نبذة عن اهتماماتك وخبرتك المهنية..." /></label>
              <label>مجالات الاهتمام<input value={interestsText} onChange={(event) => setInterestsText(event.target.value)} placeholder="مثال: الإرشاد الأسري، دراسة الحالة، التقييم (افصل بفاصلة)" /></label>
              <label className="community-visibility-toggle"><input type="checkbox" checked={profile.directoryVisible} onChange={(event) => update("directoryVisible", event.target.checked)} /><span><strong>إظهار ملفي في دليل الممارسين</strong><small>يمكنك إيقاف ظهور ملفك في الدليل في أي وقت.</small></span></label>
              {error && <p className="community-alert error" role="alert">{error}</p>}
              {notice && <p className="community-alert success" role="status">{notice}</p>}
              <button className="community-button" type="submit" disabled={saving}><Save size={15}/>{saving ? "جارٍ الحفظ..." : "حفظ الملف المهني"}</button>
            </form>
          ) : (
            <div className="community-profile-public">
              <h3>{profile.headline || roleNames[profile.role] || "ممارس مهني"}</h3>
              <div className="community-profile-facts">
                {profile.specialty && <span>التخصص: {profile.specialty}</span>}
                {profile.organization && <span>جهة العمل: {profile.organization}</span>}
                {profile.location && <span>الموقع: {profile.location}</span>}
                {profile.credentials && <span>المؤهلات: {profile.credentials}</span>}
              </div>
              {profile.bio && <p>{profile.bio}</p>}
              {profile.interests.length > 0 && <div className="community-interest-tags">{profile.interests.map((item) => <span key={item}>{item}</span>)}</div>}
              <div className="community-profile-links">
                {profile.website && <a href={profile.website} target="_blank" rel="noreferrer">الموقع الإلكتروني <ExternalLink size={13}/></a>}
                {profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn <ExternalLink size={13}/></a>}
              </div>
            </div>
          )}
        </section>
      )}
    </PlatformLayout>
  );
}

export default function CommunityProfilePage() {
  return (
    <Suspense fallback={<PlatformLayout title="ملفي المهني" description="بياناتك المهنية في مجتمع اتزان."><div className="portal-empty">جارٍ تجهيز الملف المهني...</div></PlatformLayout>}>
      <CommunityProfileContent />
    </Suspense>
  );
}
