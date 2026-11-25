"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, BookOpen, Plus, RefreshCw, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { PlatformLayout } from "@/components/platform-layout";

type Track = {
  id: string; title: string; summary: string; category: string; accent: string;
  skills: string[]; outcomes: string[]; units: string[]; practice: string;
  iconName: string; status: string; isCustom: boolean; isManaged: boolean; sortOrder: number;
};
type Draft = {
  title: string; summary: string; category: string; practice: string;
  outcomes: string; units: string; iconName: string; status: "active" | "inactive"; sortOrder: string;
};
const blankDraft = (): Draft => ({
  title: "", summary: "", category: "تخصص مهني", practice: "",
  outcomes: "", units: "", iconName: "graduation-cap", status: "active", sortOrder: "100",
});
const toDraft = (track: Track): Draft => ({
  title: track.title, summary: track.summary, category: track.category || "تخصص مهني",
  practice: track.practice || "", outcomes: (track.outcomes || []).join("\n"),
  units: (track.units || []).join("\n"), iconName: track.iconName || "graduation-cap",
  status: track.status === "active" ? "active" : "inactive", sortOrder: String(track.sortOrder || 100),
});
const lines = (value: string) => value.split("\n").map((item) => item.trim()).filter(Boolean);

export default function SpecialistTracksAdminPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (preferredId?: string) => {
    try {
      const response = await fetch("/api/platform/admin/specialist-tracks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحميل المسارات المهنية.");
      const rows: Track[] = Array.isArray(data.tracks) ? data.tracks : [];
      setTracks(rows);
      const next = preferredId || selectedId;
      const chosen = rows.find((item) => item.id === next) || rows[0];
      if ((!creating || Boolean(preferredId)) && chosen) {
        setSelectedId(chosen.id);
        setDraft(toDraft(chosen));
      }
      if (!rows.length) {
        setSelectedId("");
        setDraft(blankDraft());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل المسارات المهنية.");
    } finally {
      setLoading(false);
    }
  }, [creating, selectedId]);

  useEffect(() => { void load(); }, [load]);

  function refresh() {
    setLoading(true);
    setError("");
    void load();
  }

  function choose(track: Track) {
    setCreating(false);
    setSelectedId(track.id);
    setDraft(toDraft(track));
    setError("");
    setNotice("");
  }

  function startCreate() {
    setCreating(true);
    setSelectedId("");
    setDraft(blankDraft());
    setError("");
    setNotice("");
  }

  function patch<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        ...(creating ? {} : { id: selectedId }),
        title: draft.title,
        summary: draft.summary,
        category: draft.category,
        practice: draft.practice,
        outcomes: lines(draft.outcomes),
        units: lines(draft.units),
        skills: lines(draft.outcomes),
        iconName: draft.iconName,
        status: draft.status,
        sortOrder: Number(draft.sortOrder),
      };
      const response = await fetch("/api/platform/admin/specialist-tracks", {
        method: creating ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر حفظ المسار.");
      setNotice(creating ? "تمت إضافة المسار المهني." : "تم حفظ تعديلات المسار.");
      setCreating(false);
      await load(data.id || selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ المسار.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(track: Track) {
    setBusy(track.id);
    setError("");
    setNotice("");
    try {
      const status = track.status === "active" ? "inactive" : "active";
      const response = await fetch("/api/platform/admin/specialist-tracks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: track.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تحديث حالة المسار.");
      setNotice(status === "active" ? "تم تفعيل المسار." : "تم إيقاف المسار مؤقتاً.");
      await load(track.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث المسار.");
    } finally {
      setBusy("");
    }
  }

  async function archiveTrack(track: Track) {
    setBusy(track.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/platform/admin/specialist-tracks?id=" + encodeURIComponent(track.id), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر أرشفة المسار.");
      setNotice("تمت أرشفة المسار. لم يتم حذف بيانات الكورسات المرتبطة به.");
      await load();
      setSelectedId("");
      setDraft(blankDraft());
      setCreating(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر أرشفة المسار.");
    } finally {
      setBusy("");
    }
  }

  const selected = useMemo(() => tracks.find((item) => item.id === selectedId) || null, [tracks, selectedId]);

  return <PlatformLayout title="إدارة المسارات المهنية" description="أضف تخصصات مهنية جديدة، وعدّل المحتوى ونواتج التعلم، وتحكم في ظهور المسارات للمتدربين وربط الكورسات بها.">
    <div className="portal-callout">المسارات الأساسية محفوظة كجزء من المنصة. يمكنك تعديلها أو إيقافها مؤقتاً، وإضافة مسارات جديدة دون حذف الكورسات أو سجلات التدريب المرتبطة.</div>
    {error && <p role="alert" style={{ color: "#a33", fontSize: 12 }}>{error}</p>}
    {notice && <p role="status" style={{ color: "#237a68", fontSize: 12 }}>{notice}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,270px),1fr))", gap: 14, alignItems: "start" }}>
      <section className="portal-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>المسارات ({tracks.length})</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="portal-button secondary" onClick={refresh} disabled={loading}><RefreshCw size={14}/> تحديث</button>
            <button type="button" className="portal-button" onClick={startCreate}><Plus size={14}/> جديد</button>
          </div>
        </div>
        <div style={{ display: "grid", gap: 7, marginTop: 13 }}>
          {loading ? <div className="portal-empty">جارٍ تحميل المسارات...</div> : tracks.map((track) => <button type="button" key={track.id} onClick={() => choose(track)} className={"portal-track-option" + (selectedId === track.id && !creating ? " active" : "")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 11, textAlign: "right", border: "1px solid #e2e9eb", borderRadius: 9, background: selectedId === track.id && !creating ? "#eef7f4" : "#fff", color: "#526b72", cursor: "pointer" }}>
            <span><strong style={{ display: "block", fontSize: 11 }}>{track.title}</strong><small style={{ color: "#89999e", fontSize: 9 }}>{track.isCustom ? "مسار مضاف" : "مسار أساسي"} · {track.status === "inactive" ? "متوقف" : track.status === "archived" ? "مؤرشف" : "نشط"}</small></span>
            <BookOpen size={16}/>
          </button>)}
        </div>
      </section>

      <form className="portal-card" onSubmit={save} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{creating ? "إضافة مسار مهني جديد" : selected?.title || "تفاصيل المسار"}</h2>
          {!creating && selected && <button type="button" className="portal-button secondary" onClick={() => void toggleStatus(selected)} disabled={busy === selected.id}>{selected.status !== "active" ? <ToggleRight size={15}/> : <ToggleLeft size={15}/>} {selected.status !== "active" ? "تفعيل" : "إيقاف مؤقت"}</button>}
        </div>
        {!creating && !selected && !loading && <p className="portal-empty">اختر مساراً من القائمة أو أضف مساراً جديداً.</p>}
        <label style={{ display: "grid", gap: 5, fontSize: 10 }}>اسم المسار<input required maxLength={180} value={draft.title} onChange={(e) => patch("title", e.target.value)} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 10 }}>التصنيف المهني<input maxLength={100} value={draft.category} onChange={(e) => patch("category", e.target.value)} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 10 }}>الوصف<textarea required rows={3} maxLength={3000} value={draft.summary} onChange={(e) => patch("summary", e.target.value)} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 5, fontSize: 10 }}>الأيقونة<select value={draft.iconName} onChange={(e) => patch("iconName", e.target.value)}>{[["graduation-cap","تعليم"],["users","عمل جماعي"],["brain","علم النفس"],["heart-handshake","الإرشاد"],["workflow","مسار العمل"],["activity","النمو"],["microscope","القياس"],["stethoscope","إكلينيكي"],["book-open","المعرفة"]].map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label style={{ display: "grid", gap: 5, fontSize: 10 }}>ترتيب الظهور<input type="number" min="1" max="9999" value={draft.sortOrder} onChange={(e) => patch("sortOrder", e.target.value)} /></label>
          <label style={{ display: "grid", gap: 5, fontSize: 10 }}>الحالة<select value={draft.status} onChange={(e) => patch("status", e.target.value as "active" | "inactive")}><option value="active">نشط</option><option value="inactive">متوقف مؤقتاً</option></select></label>
        </div>
        <label style={{ display: "grid", gap: 5, fontSize: 10 }}>المهارات المستهدفة (كل مهارة في سطر)<textarea required rows={5} value={draft.outcomes} onChange={(e) => patch("outcomes", e.target.value)} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 10 }}>الخطة التعليمية (كل وحدة في سطر)<textarea required rows={5} value={draft.units} onChange={(e) => patch("units", e.target.value)} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 10 }}>التطبيق العملي<textarea rows={3} maxLength={1200} value={draft.practice} onChange={(e) => patch("practice", e.target.value)} placeholder="مثال: نشاط تطبيقي على حالة افتراضية..." /></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" className="portal-button" disabled={saving || loading || (!creating && !selected)}><Save size={15}/>{saving ? "جارٍ الحفظ..." : "حفظ المسار"}</button>
          {selected?.isCustom && selected.status !== "archived" && !creating && <button type="button" className="portal-button secondary" disabled={busy === selected.id} onClick={() => void archiveTrack(selected)}><Archive size={14}/> أرشفة</button>}
        </div>
      </form>
    </div>
  </PlatformLayout>;
}
