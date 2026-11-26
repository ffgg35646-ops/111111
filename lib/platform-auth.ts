import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { getClinicalDatabase } from "@/lib/mongodb";

export const PLATFORM_SESSION_COOKIE = "clinical_platform_session";
export const PLATFORM_DEVICE_COOKIE = "etzan_platform_device";
export const PLATFORM_ROLES = ["admin", "platform_manager", "sub_admin", "supervisor", "trainer", "trainee", "consultant", "accountant", "support", "content_manager", "quality_manager"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export type PlatformSession = {
  userId: string;
  email: string;
  name: string;
  role: PlatformRole;
  mustChangePassword?: boolean;
  sessionId?: string;
  deviceId?: string;
  deviceAgentHash?: string;
  permissions?: string[];
};

const ISSUER = "clinical-learning-platform";
const AUDIENCE = "platform-user-session";
const SESSION_SECONDS = 60 * 60 * 8;
const DEVICE_SECONDS = 60 * 60 * 24 * 180;

export function platformDeviceAgentHash(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.slice(0, 240) || "unknown";
  return createHash("sha256").update(userAgent).digest("hex");
}

function sessionSecret() {
  const value = process.env.PLATFORM_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("PLATFORM_SESSION_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}

export function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");
  return "scrypt$" + salt + "$" + hash;
}

export function parsePasswordHash(encoded: string) {
  const parts = encoded.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !/^[0-9a-f]{32}$/i.test(parts[1]) || !/^[0-9a-f]{128}$/i.test(parts[2])) return null;
  return { salt: parts[1], hash: parts[2] };
}

export function verifyStoredPassword(password: string, salt: string, hash: string) {
  if (!password || !/^[0-9a-f]{32}$/i.test(salt) || !/^[0-9a-f]{128}$/i.test(hash)) return false;
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, Buffer.from(salt, "hex"), expected.length);
    return timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function verifyPasswordHash(password: string, encoded: string) {
  const parsed = parsePasswordHash(encoded);
  return parsed ? verifyStoredPassword(password, parsed.salt, parsed.hash) : false;
}

export async function issuePlatformSession(user: PlatformSession) {
  if (!user.sessionId || !user.deviceId || !user.deviceAgentHash) throw new Error("A registered device-bound session is required.");
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword === true,
    deviceId: user.deviceId,
    deviceAgentHash: user.deviceAgentHash,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(user.userId)
    .setJti(user.sessionId)
    .setIssuedAt()
    .setExpirationTime(SESSION_SECONDS)
    .sign(sessionSecret());
}

export async function readPlatformSession(request: NextRequest): Promise<PlatformSession | null> {
  const token = request.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
    const role = payload.role;
    if (
      typeof payload.sub !== "string" || typeof payload.jti !== "string" ||
      typeof payload.deviceId !== "string" || typeof payload.deviceAgentHash !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(payload.jti) || !/^[0-9a-f-]{36}$/i.test(payload.deviceId) ||
      !/^[0-9a-f]{64}$/i.test(payload.deviceAgentHash) ||
      typeof payload.email !== "string" || typeof payload.name !== "string" ||
      typeof role !== "string" || !PLATFORM_ROLES.includes(role as PlatformRole)
    ) return null;
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: role as PlatformRole,
      mustChangePassword: payload.mustChangePassword === true,
      sessionId: payload.jti,
      deviceId: payload.deviceId,
      deviceAgentHash: payload.deviceAgentHash,
    };
  } catch { return null; }
}

export async function isPlatformSessionActive(session: PlatformSession) {
  if (!session.sessionId || !session.deviceId) return false;
  try {
    const db = await getClinicalDatabase();
    const record = await db.collection("platform_sessions").findOne({
      sessionId: session.sessionId,
      userId: session.userId,
      deviceId: session.deviceId,
      deviceAgentHash: session.deviceAgentHash,
      status: "active",
      expiresAt: { $gt: new Date() },
    }, { projection: { _id: 1 } });
    return Boolean(record);
  } catch (error) {
    console.error("Unable to verify active platform session", error);
    return false;
  }
}

export async function requirePlatformRole(request: NextRequest, roles: PlatformRole[]) {
  const session = await readPlatformSession(request);
  if (!session || session.mustChangePassword || !session.sessionId || !session.deviceId) return null;

  try {
    const db = await getClinicalDatabase();
    const now = new Date();
    const sessionRecord = await db.collection("platform_sessions").findOne({
      sessionId: session.sessionId,
      userId: session.userId,
      deviceId: session.deviceId,
      deviceAgentHash: session.deviceAgentHash,
      status: "active",
      expiresAt: { $gt: now },
    }, { projection: { _id: 1, lastSeenAt: 1 } });
    if (!sessionRecord) return null;

    const seenAt = sessionRecord.lastSeenAt instanceof Date ? sessionRecord.lastSeenAt.getTime() : 0;
    if (now.getTime() - seenAt > 5 * 60 * 1000) {
      await db.collection("platform_sessions").updateOne(
        { sessionId: session.sessionId, status: "active" },
        { $set: { lastSeenAt: now } },
      );
    }

    const account = await db.collection("platform_users").findOne(
      { userId: session.userId, email: session.email },
      { projection: { _id: 0, userId: 1, email: 1, name: 1, role: 1, status: 1, mustChangePassword: 1, permissions: 1 } },
    );
    if (!account || account.status !== "active" || account.mustChangePassword === true) return null;
    if (typeof account.role !== "string" || !PLATFORM_ROLES.includes(account.role as PlatformRole)) return null;
    const currentRole = account.role as PlatformRole;
    if (!roles.includes(currentRole)) return null;

    return {
      userId: session.userId,
      email: session.email,
      name: typeof account.name === "string" ? account.name : session.name,
      role: currentRole,
      mustChangePassword: false,
      sessionId: session.sessionId,
      deviceId: session.deviceId,
      deviceAgentHash: session.deviceAgentHash,
      permissions: Array.isArray(account.permissions) ? account.permissions.filter((item): item is string => typeof item === "string") : [],
    } satisfies PlatformSession;
  } catch (error) {
    console.error("Unable to verify current platform account status", error);
    return null;
  }
}

export function platformSessionCookieOptions(isProduction = process.env.NODE_ENV === "production") {
  return { httpOnly: true, secure: isProduction, sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS };
}

export function platformDeviceCookieOptions(isProduction = process.env.NODE_ENV === "production") {
  return { httpOnly: true, secure: isProduction, sameSite: "lax" as const, path: "/", maxAge: DEVICE_SECONDS };
}

export function clearedPlatformSessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 0, expires: new Date(0) };
}


export const SITE_PAGE_PERMISSIONS = ["site_home", "site_about", "site_privacy", "site_owner", "specialist_tracks"] as const;
export type SitePagePermission = (typeof SITE_PAGE_PERMISSIONS)[number];

export async function requirePlatformPermission(request: NextRequest, permission: SitePagePermission) {
  const session = await readPlatformSession(request);
  if (!session || session.mustChangePassword || !session.sessionId || !session.deviceId) return null;
  try {
    const db = await getClinicalDatabase();
    const now = new Date();
    const sessionRecord = await db.collection("platform_sessions").findOne({
      sessionId: session.sessionId, userId: session.userId, deviceId: session.deviceId,
      deviceAgentHash: session.deviceAgentHash,
      status: "active", expiresAt: { $gt: now },
    }, { projection: { _id: 1 } });
    if (!sessionRecord) return null;
    const account = await db.collection("platform_users").findOne(
      { userId: session.userId, email: session.email, status: "active", mustChangePassword: { $ne: true } },
      { projection: { _id: 0, userId: 1, email: 1, name: 1, role: 1, permissions: 1 } },
    );
    if (!account || typeof account.role !== "string") return null;
    const allowed = account.role === "admin" || account.role === "platform_manager" ||
      (account.role === "sub_admin" && Array.isArray(account.permissions) && account.permissions.includes(permission));
    if (!allowed) return null;
    return {
      userId: session.userId, email: session.email, name: String(account.name || session.name),
      role: account.role as PlatformRole, permissions: Array.isArray(account.permissions) ? account.permissions.filter((item): item is string => typeof item === "string") : [],
      sessionId: session.sessionId, deviceId: session.deviceId, deviceAgentHash: session.deviceAgentHash, mustChangePassword: false,
    };
  } catch (error) {
    console.error("Unable to verify site content permission", error);
    return null;
  }
}
