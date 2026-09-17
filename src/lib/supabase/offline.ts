import type { UserRole } from "@/lib/data/types";

/**
 * Degraded-mode helpers.
 *
 * `getFarmSnapshot()` falls back to a bundled snapshot when Supabase can't be
 * reached, but auth sits in front of it: if `auth.getUser()` fails because the
 * network is down, the presenter gets bounced to a login page that also can't
 * reach Supabase, and the snapshot is never used. These helpers let the proxy
 * and the dashboard tell "this person is not signed in" apart from "we can't
 * currently check", and keep serving the cached demo in the second case.
 */

/** Cookie the login page writes so a degraded render knows which view to show. */
export const LAST_ROLE_COOKIE = "fis-last-role";

const ROLES: UserRole[] = ["farmer", "agronomist", "bank_officer"];

export function parseRole(value: string | undefined): UserRole {
  return ROLES.includes(value as UserRole) ? (value as UserRole) : "farmer";
}

/**
 * True when the failure looks like "couldn't reach the auth server" rather than
 * "this token is invalid". A rejected credential comes back 401/403; a network
 * failure surfaces as AuthRetryableFetchError with status 0, undefined or 5xx.
 */
export function isAuthUnreachable(error: unknown): boolean {
  if (!error) return false;
  const status = (error as { status?: number }).status;
  if (status === undefined || status === 0) return true;
  return status >= 500;
}

/** Whether the browser is carrying a Supabase session at all. */
export function hasSessionCookie(cookies: { name: string }[]): boolean {
  return cookies.some((c) => /^sb-.*-auth-token/.test(c.name));
}
