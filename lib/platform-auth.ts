import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

export const PLATFORM_SESSION_COOKIE = "clinical_platform_session";
export const PLATFORM_ROLES = ["admin", "supervisor", "trainer", "trainee", "consultant"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export type PlatformSession = {
  userId: string;
  email: string;
  name: string;
  role: PlatformRole;
  mustChangePassword?: boolean;
};

const ISSUER = "clinical-learning-platform";
const AUDIENCE = "platform-user-session";
const SESSION_SECONDS = 60 * 60 * 8;

function sessionSecret() {
  const value = process.env.PLATFORM_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("PLATFORM_SESSION_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export function createPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");
  return "scrypt$" + salt + "$" + hash;
}

export function parsePasswordHash(encoded: string) {
  const parts = encoded.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt" || !/^[0-9a-f]{32}$/i.test(parts[1]) || !/^[0-9a-f]{128}$/i.test(parts[2])) {
    return null;
  }
  return { salt: parts[1], hash: parts[2] };
}

export function verifyStoredPassword(password: string, salt: string, hash: string) {
  if (!password || !/^[0-9a-f]{32}$/i.test(salt) || !/^[0-9a-f]{128}$/i.test(hash)) return false;
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = scryptSync(password, Buffer.from(salt, "hex"), expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function verifyPasswordHash(password: string, encoded: string) {
  const parsed = parsePasswordHash(encoded);
  return parsed ? verifyStoredPassword(password, parsed.salt, parsed.hash) : false;
}

export async function issuePlatformSession(user: PlatformSession) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword === true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_SECONDS)
    .sign(sessionSecret());
}

export async function readPlatformSession(request: NextRequest): Promise<PlatformSession | null> {
  const token = request.cookies.get(PLATFORM_SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const role = payload.role;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof role !== "string" ||
      !PLATFORM_ROLES.includes(role as PlatformRole)
    ) return null;
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: role as PlatformRole,
      mustChangePassword: payload.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}

export async function requirePlatformRole(request: NextRequest, roles: PlatformRole[]) {
  const session = await readPlatformSession(request);
  return session && !session.mustChangePassword && roles.includes(session.role) ? session : null;
}

export function platformSessionCookieOptions(isProduction = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}

export function clearedPlatformSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
