import { NextRequest, NextResponse } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";
import { requirePlatformRole } from "@/lib/platform-auth";
export const runtime = "nodejs";
const COMMUNITY_ROLES = ["admin","platform_manager","supervisor","trainer","trainee","consultant","accountant","support","content_manager","quality_manager"] as const;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
function safeUrl(value: unknown) {
  const raw = clean(value, 500);
  if (!raw) return "";
  try { const url = new URL(raw); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : ""; }
  catch { return ""; }
}
function publicProfile(user: Record<string, unknown>, profile: Record<string, unknown> | null, viewerId: string) {
  return {
    userId: String(user.userId || ""), name: String(user.name || "عضو اتزان"), role: String(user.role || "trainee"),
    headline: String(profile?.headline || ""), specialty: String(profile?.specialty || ""), organization: String(profile?.organization || ""),
    location: String(profile?.location || ""), bio: String(profile?.bio || ""), credentials: String(profile?.credentials || ""),
    website: String(profile?.website || ""), linkedin: String(profile?.linkedin || ""),
    interests: Array.isArray(profile?.interests) ? profile.interests.filter((item): item is string => typeof item === "string").slice(0, 10) : [],
    directoryVisible: profile?.directoryVisible !== false, updatedAt: profile?.updatedAt || null,
    isOwn: String(user.userId || "") === viewerId,
  };
}
export async function GET(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...COMMUNITY_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لعرض ملفات المجتمع المهني." }, { status: 401 });
  try {
    const db = await getClinicalDatabase();
    const profiles = db.collection("etzan_community_profiles");
    await profiles.createIndex({ userId: 1 }, { unique: true });
    if (request.nextUrl.searchParams.get("directory") === "1") {
      const query = clean(request.nextUrl.searchParams.get("q"), 80);
      const role = clean(request.nextUrl.searchParams.get("role"), 30);
      const accounts = await db.collection("platform_users").find({
        status: "active", ...(role ? { role } : {}),
        ...(query ? { name: { $regex: query.split("").map((character) => ".^$*+?()[]{}|".includes(character) || character === String.fromCharCode(92) ? String.fromCharCode(92) + character : character).join(""), $options: "i" } } : {}),
      }, { projection: { _id: 0, userId: 1, name: 1, role: 1 } }).sort({ name: 1 }).limit(100).toArray();
      const visible = await profiles.find({ userId: { $in: accounts.map((account) => account.userId) }, directoryVisible: { $ne: false } }).toArray();
      const byUser = new Map<string, Record<string, unknown>>(visible.map((profile) => [String(profile.userId), profile as Record<string, unknown>] as [string, Record<string, unknown>]));
      const members = accounts.filter((account) => String(account.userId) === actor.userId || byUser.has(String(account.userId)))
        .map((account) => publicProfile(account, byUser.get(String(account.userId)) || null, actor.userId));
      return NextResponse.json({ members }, { headers: { "Cache-Control": "no-store" } });
    }
    const targetId = clean(request.nextUrl.searchParams.get("userId"), 80) || actor.userId;
    const account = await db.collection("platform_users").findOne({ userId: targetId, status: "active" }, { projection: { _id: 0, userId: 1, name: 1, role: 1 } });
    if (!account) return NextResponse.json({ error: "ملف العضو غير متاح." }, { status: 404 });
    const profile = await profiles.findOne({ userId: targetId }, { projection: { _id: 0 } });
    if (targetId !== actor.userId && profile?.directoryVisible === false) return NextResponse.json({ error: "اختار العضو عدم إظهار ملفه في دليل المجتمع." }, { status: 404 });
    return NextResponse.json({ profile: publicProfile(account, profile, actor.userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("community profile GET", error);
    return NextResponse.json({ error: "تعذر تحميل الملف المهني." }, { status: 503 });
  }
}
export async function PATCH(request: NextRequest) {
  const actor = await requirePlatformRole(request, [...COMMUNITY_ROLES]);
  if (!actor) return NextResponse.json({ error: "سجل الدخول لتعديل ملفك المهني." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "بيانات الملف غير صالحة." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "أدخل بيانات الملف المهني." }, { status: 400 });
  const data = body as Record<string, unknown>;
  const interests = Array.isArray(data.interests) ? data.interests.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 50)).filter(Boolean).slice(0, 10) : [];
  const update = {
    headline: clean(data.headline, 120), specialty: clean(data.specialty, 100), organization: clean(data.organization, 120),
    location: clean(data.location, 80), bio: clean(data.bio, 1000), credentials: clean(data.credentials, 240),
    website: safeUrl(data.website), linkedin: safeUrl(data.linkedin), interests,
    directoryVisible: data.directoryVisible !== false, updatedAt: new Date(),
  };
  try {
    const db = await getClinicalDatabase();
    const profiles = db.collection("etzan_community_profiles");
    await profiles.createIndex({ userId: 1 }, { unique: true });
    await profiles.updateOne(
      { userId: actor.userId },
      { $set: { userId: actor.userId, ...update }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    await db.collection("platform_audit_logs").insertOne({ action: "community_profile_updated", actorUserId: actor.userId, createdAt: new Date() })
      .catch((error) => console.warn("community profile audit", error));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("community profile PATCH", error);
    return NextResponse.json({ error: "تعذر حفظ الملف المهني." }, { status: 503 });
  }
}
