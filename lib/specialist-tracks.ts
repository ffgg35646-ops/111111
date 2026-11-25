import { learningTracks } from "@/lib/platform-catalog";

type StoredTrack = Record<string, unknown>;
export type NormalizedSpecialistTrack = {
  id: string;
  title: string;
  summary: string;
  category: string;
  accent: string;
  skills: string[];
  outcomes: string[];
  units: string[];
  practice: string;
  iconName: string;
  status: string;
  isCustom: boolean;
  isManaged: boolean;
  sortOrder: number;
};

const clean = (value: unknown, fallback: string, max = 5000) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;

const cleanList = (value: unknown, fallback: string[], maxItems = 20) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, 180)).filter(Boolean).slice(0, maxItems)
    : fallback;

export function buildSpecialistTracks(records: StoredTrack[], includeInactive = false): NormalizedSpecialistTrack[] {
  const defaults = new Map(learningTracks.map((track) => [track.id, track]));
  const stored = new Map(records.map((record) => [String(record.id || ""), record]));
  const builtIn: NormalizedSpecialistTrack[] = [];

  learningTracks.forEach((track, index) => {
    const record = stored.get(track.id);
    const status = record?.status === "inactive" || record?.status === "archived" ? String(record.status) : "active";
    if (!includeInactive && status !== "active") return;
    const skills = cleanList(record?.skills, track.skills);
    builtIn.push({
      id: track.id,
      title: clean(record?.title, track.title, 180),
      summary: clean(record?.summary, track.summary, 3000),
      category: clean(record?.category, "الممارسة المهنية", 100),
      accent: clean(record?.accent, track.accent, 30),
      skills,
      outcomes: cleanList(record?.outcomes, skills),
      units: cleanList(record?.units, skills),
      practice: clean(record?.practice, "طبّق المهارات المستهدفة على حالة تدريبية افتراضية، ثم راجع النتائج مع مشرف مؤهل.", 1200),
      iconName: clean(record?.iconName, "graduation-cap", 40),
      status,
      isCustom: false,
      isManaged: Boolean(record),
      sortOrder: Number.isFinite(Number(record?.sortOrder)) ? Number(record?.sortOrder) : index + 1,
    });
  });

  const custom: NormalizedSpecialistTrack[] = records
    .filter((record) => {
      const id = String(record.id || "");
      const status = String(record.status || "active");
      return id && !defaults.has(id) && (includeInactive || status === "active");
    })
    .map((record, index) => {
      const skills = cleanList(record.skills, []);
      return {
        id: String(record.id),
        title: clean(record.title, "مسار مهني جديد", 180),
        summary: clean(record.summary, "", 3000),
        category: clean(record.category, "تخصص مهني", 100),
        accent: clean(record.accent, "teal", 30),
        skills,
        outcomes: cleanList(record.outcomes, skills),
        units: cleanList(record.units, skills),
        practice: clean(record.practice, "طبّق المهارات المستهدفة على حالة تدريبية افتراضية، ثم راجع النتائج مع مشرف مؤهل.", 1200),
        iconName: clean(record.iconName, "graduation-cap", 40),
        status: String(record.status || "active"),
        isCustom: true,
        isManaged: true,
        sortOrder: Number.isFinite(Number(record.sortOrder)) ? Number(record.sortOrder) : learningTracks.length + index + 1,
      };
    });

  return [...builtIn, ...custom].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ar"));
}
