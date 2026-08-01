import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { sql, ROLE } from "./db";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
  type SessionUser,
} from "./session";

const BCRYPT_ROUNDS = 12;

/**
 * A dummy hash used to keep login timing constant when the email does not
 * exist. Without it, a fast "user not found" response leaks which emails
 * are registered.
 */
const DUMMY_HASH = "$2a$12$M6bJ0nyZUnq7tRLcYtG3XeCJXqzS9jHwCd5x6IiIe4G4bDbnZQZ8u";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
//  Admin bootstrap
//
//  The desktop app called SeedDefaultAdmin() and wrote
//  admin@servigo.com / Admin@123 straight into the database. Anyone who read
//  the repo owned the system.
//
//  SERVIGO 2.0 instead:
//    * reads the allowed admin emails from ADMIN_EMAILS (never in source)
//    * requires ADMIN_SETUP_TOKEN, compared in constant time
//    * lets the operator choose the password at /admin/setup
//    * records the claim in admin_bootstrap so the token cannot be replayed
//    * refuses to promote anyone whose email is not on the allowlist
// ---------------------------------------------------------------------------

export function adminEmailAllowlist(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistedAdminEmail(email: string): boolean {
  return adminEmailAllowlist().includes(email.trim().toLowerCase());
}

/** Constant-time string comparison, avoids leaking the token byte by byte. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  // Compare lengths without early return by folding into the result.
  let diff = ba.length ^ bb.length;
  const len = Math.max(ba.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function isValidSetupToken(candidate: string): boolean {
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected || expected.length < 16) return false;
  return timingSafeEqual(candidate, expected);
}

export async function adminBootstrapClaimed(): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (select 1 from admin_bootstrap where id = 1) as exists
  `;
  return rows[0]?.exists ?? false;
}

// ---------------------------------------------------------------------------
//  User creation / lookup
// ---------------------------------------------------------------------------

export type DbUser = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  cnic: string;
  password_hash: string;
  role_id: number;
  is_active: boolean;
  created_at: Date;
};

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const rows = await sql<DbUser[]>`
    select * from users where email = ${email.trim().toLowerCase()} limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Verifies credentials. Always runs a bcrypt comparison so that a missing
 * account costs the same wall-clock time as a wrong password.
 */
export async function authenticate(
  email: string,
  password: string
): Promise<{ ok: true; user: DbUser } | { ok: false; reason: string }> {
  const user = await findUserByEmail(email);
  const matches = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !matches) {
    return { ok: false, reason: "Invalid email or password." };
  }
  if (!user.is_active) {
    return { ok: false, reason: "This account has been deactivated." };
  }
  return { ok: true, user };
}

// ---------------------------------------------------------------------------
//  Session helpers for server components and route handlers
// ---------------------------------------------------------------------------

export async function startSession(user: DbUser): Promise<void> {
  const token = await createSessionToken({
    userId: user.user_id,
    fullName: user.full_name,
    email: user.email,
    roleId: user.role_id,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Throws-style guard for route handlers. Returns null when unauthorised. */
export async function requireRole(
  ...allowed: number[]
): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  if (allowed.length && !allowed.includes(session.roleId)) return null;

  // Re-check the live account state so a deactivated or demoted user
  // cannot keep acting on a still-valid cookie.
  const rows = await sql<{ is_active: boolean; role_id: number }[]>`
    select is_active, role_id from users where user_id = ${session.userId} limit 1
  `;
  const row = rows[0];
  if (!row || !row.is_active || row.role_id !== session.roleId) return null;

  return session;
}

export const requireAdmin = () => requireRole(ROLE.ADMIN);
export const requireCustomer = () => requireRole(ROLE.CUSTOMER);
export const requireProvider = () => requireRole(ROLE.PROVIDER);
