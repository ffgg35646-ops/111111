"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Search, UserRound, ArrowUpLeft, Users } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";
import "../community.css";

type Member = {
  userId: string; name: string; role: string; headline: string; specialty: string;
  organization: string; location: string; bio: string; credentials: string; interests: string[];
};
const roles: Record<string, string> = {
  admin: "مدير النظام", platform_manager: "مدير المنصة", supervisor: "مشرف مهني", trainer: "مدرب",
  trainee: "متدرب", consultant: "مستشار", accountant: "محاسب", support: "الدعم",
  content_manager: "مسؤول محتوى", quality_manager: "مسؤول جودة",
};
export default function CommunityMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(value = query) {
    const response = await fetch("/api/community/profile?directory=1&q=" + encodeURIComponent(value), { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر تحميل دليل الممارسين.");
    setMembers(Array.isArray(data.members) ? data.members : []);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/community/profile?directory=1", { cache: "no-store" }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "تعذر تحميل الدليل.");
      if (active) setMembers(data.members || []);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل الدليل."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try { await load(query); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر البحث."); }
    finally { setLoading(false); }
  }
  return (
    <PlatformLayout title="دليل الممارسين" description="تعرّف على أعضاء المجتمع المهني في اتزان وتخصصاتهم ومجالات اهتمامهم.">
      <div className="community-profile-page-top"><a href="/community"><ArrowUpLeft size={14}/> العودة للمجتمع</a><a href="/community/profile">استكمال ملفي المهني</a></div>
      <form className="community-search community-member-search" onSubmit={search}><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم المهني..." /><button type="submit">بحث</button></form>
      {error && <p className="community-alert error" role="alert">{error}</p>}
      {loading ? <div className="portal-empty">جارٍ تحميل دليل الممارسين...</div> : members.length === 0 ? <div className="portal-empty"><Users size={18}/> لا توجد ملفات مهنية ظاهرة في الدليل بعد.</div> : (
        <div className="community-members-grid">
          {members.map((member) => <article className="community-member-card" key={member.userId}>
            <div className="community-member-avatar"><UserRound size={22}/></div>
            <h3>{member.name}</h3>
            <span className="community-member-role">{roles[member.role] || "عضو اتزان"}</span>
            <p className="community-member-headline">{member.headline || member.specialty || "لم يضف نبذة مهنية بعد"}</p>
            <div className="community-member-facts">
              {member.specialty && <span>{member.specialty}</span>}
              {member.organization && <span>{member.organization}</span>}
              {member.location && <span>{member.location}</span>}
            </div>
            <a href={"/community/profile?userId=" + encodeURIComponent(member.userId)} className="community-outline-link">عرض الملف المهني <ArrowUpLeft size={13}/></a>
          </article>)}
        </div>
      )}
    </PlatformLayout>
  );
}
