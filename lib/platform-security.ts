import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

type SecurityEvent = {
  action: string;
  actorUserId?: string;
  targetId?: string;
  request?: NextRequest;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function recordSecurityEvent(
  db: Awaited<ReturnType<typeof import("@/lib/mongodb").getClinicalDatabase>>,
  event: SecurityEvent,
) {
  try {
    const userAgent = event.request?.headers.get("user-agent")?.slice(0, 240) || undefined;
    await db.collection("platform_audit_logs").insertOne({
      eventId: randomUUID(),
      category: "security",
      action: event.action.slice(0, 80),
      actorUserId: event.actorUserId || null,
      targetId: event.targetId?.slice(0, 120) || null,
      route: event.request ? new URL(event.request.url).pathname.slice(0, 180) : undefined,
      userAgent,
      metadata: event.metadata || {},
      createdAt: new Date(),
    });
  } catch (error) {
    console.warn("Unable to persist security audit event", error);
  }
}

function mediaSecret() {
  const value = process.env.PLATFORM_MEDIA_SECRET || "";
  if (value.length < 32) throw new Error("PLATFORM_MEDIA_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}

export type ClassroomAccessAction = "join" | "recording";

export async function createClassroomAccessUrl(
  sessionId: string,
  userId: string,
  action: ClassroomAccessAction,
) {
  const token = await new SignJWT({ action, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("etzan-secure-classroom-media")
    .setAudience("etzan-classroom-access")
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(mediaSecret());
  return "/api/classrooms/sessions/" + encodeURIComponent(sessionId) + "/" + action + "?token=" + encodeURIComponent(token);
}

export async function verifyClassroomAccessToken(token: string) {
  const { payload } = await jwtVerify(token, mediaSecret(), {
    algorithms: ["HS256"],
    issuer: "etzan-secure-classroom-media",
    audience: "etzan-classroom-access",
  });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.sessionId !== "string" ||
    (payload.action !== "join" && payload.action !== "recording")
  ) return null;
  return {
    userId: payload.sub,
    sessionId: payload.sessionId,
    action: payload.action as ClassroomAccessAction,
  };
}


export async function createCourseVideoAccessUrl(courseId: string, userId: string) {
  const token = await new SignJWT({ action: "course_video", courseId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("etzan-secure-course-video")
    .setAudience("etzan-course-video")
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(mediaSecret());
  return "/api/learning/courses/" + encodeURIComponent(courseId) + "/video?token=" + encodeURIComponent(token);
}

export async function verifyCourseVideoAccessToken(token: string) {
  const { payload } = await jwtVerify(token, mediaSecret(), {
    algorithms: ["HS256"],
    issuer: "etzan-secure-course-video",
    audience: "etzan-course-video",
  });
  if (typeof payload.sub !== "string" || typeof payload.courseId !== "string" || payload.action !== "course_video") return null;
  return { userId: payload.sub, courseId: payload.courseId };
}

export function allowedCourseVideoUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 3000) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443") return false;
    const allowedHosts = (process.env.ETZAN_VIDEO_ALLOWED_HOSTS || "")
      .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
    return allowedHosts.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function trustedZoomUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !(
      host === "zoom.us" || host.endsWith(".zoom.us") ||
      host === "zoomgov.com" || host.endsWith(".zoomgov.com")
    )) return "";
    return url.toString();
  } catch {
    return "";
  }
}
