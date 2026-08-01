import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * Stateless sessions signed with HS256 and stored in an httpOnly cookie.
 *
 * This replaces Helpers/SessionManager.cs, which held the current user in a
 * static field. A static field is fine for one desktop process but useless on
 * serverless, so the identity now travels with the request and is verified
 * cryptographically on every call. Nothing trusts client-supplied roles.
 */

export const SESSION_COOKIE = "servigo_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export type SessionUser = {
  userId: string;
  fullName: string;
  email: string;
  roleId: number;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Generate one with: openssl rand -base64 48"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.userId)
    .setIssuedAt()
    .setIssuer("servigo")
    .setAudience("servigo-web")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "servigo",
      audience: "servigo-web",
    });
    return toSessionUser(payload);
  } catch {
    return null;
  }
}

function toSessionUser(payload: JWTPayload): SessionUser | null {
  const { sub, fullName, email, roleId } = payload as JWTPayload & {
    fullName?: unknown;
    email?: unknown;
    roleId?: unknown;
  };
  if (
    typeof sub !== "string" ||
    typeof fullName !== "string" ||
    typeof email !== "string" ||
    typeof roleId !== "number"
  ) {
    return null;
  }
  return { userId: sub, fullName, email, roleId };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
