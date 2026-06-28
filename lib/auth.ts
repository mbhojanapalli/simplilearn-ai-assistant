import crypto from "node:crypto";

/**
 * Lightweight admin auth for the document-upload console.
 *
 * The session cookie holds an HMAC keyed by ADMIN_PASSWORD, so it cannot be
 * forged without knowing the password. Real auth verification happens in the
 * admin API routes (Node runtime); middleware only does a presence check for
 * the redirect UX.
 */

export const ADMIN_COOKIE = "sl_admin_session";
const SESSION_MESSAGE = "simplilearn-admin-session-v1";

function adminSecret(): string {
  return process.env.ADMIN_PASSWORD ?? "";
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** Deterministic, unforgeable session token derived from the admin password. */
export function createSessionToken(): string {
  return crypto
    .createHmac("sha256", adminSecret())
    .update(SESSION_MESSAGE)
    .digest("hex");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyPassword(input: string): boolean {
  const expected = adminSecret();
  if (!expected) return false;
  return timingSafeEqualStr(input, expected);
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token || !adminSecret()) return false;
  return timingSafeEqualStr(token, createSessionToken());
}
