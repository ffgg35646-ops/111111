import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "clinical_supervisor_session";
const ISSUER = "clinical-learning-platform";
const AUDIENCE = "clinical-competency-profile";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function getSecret() {
  const value = process.env.SUPERVISION_TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SUPERVISION_TOKEN_SECRET must contain at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export async function issueSupervisorSession(supervisorId: string) {
  const token = await new SignJWT({ supervisorId, scope: "competency:read-write" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  return {
    name: COOKIE_NAME,
    value: token,
    maxAge: COOKIE_MAX_AGE,
  };
}

export async function readSupervisorSession(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.supervisorId === "string" ? payload.supervisorId : null;
  } catch {
    return null;
  }
}

export function supervisorCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}
