// Shared cookie names for the Next.js auth proxy.

export const ACCESS_COOKIE = 'iams_access';
export const REFRESH_COOKIE = 'iams_refresh';
export const USER_COOKIE = 'iams_user';
// Short-lived, httpOnly carriers for the two intermediate 2FA login states.
export const MFA_CHALLENGE_COOKIE = 'iams_mfa';
export const MFA_ENROLL_COOKIE = 'iams_enroll';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  path?: string;
  maxAge?: number;
}

export const accessCookieOptions = (maxAgeSeconds = 60 * 60): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: maxAgeSeconds,
});

export const refreshCookieOptions = (
  maxAgeSeconds = 60 * 60 * 24 * 7,
): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: maxAgeSeconds,
});

// Intermediate 2FA tokens: httpOnly, short maxAge (matches backend token TTLs).
export const mfaCookieOptions = (maxAgeSeconds: number): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: maxAgeSeconds,
});

// User cookie is *not* httpOnly so the client can read display info; never trust it for auth decisions.
export const userCookieOptions = (
  maxAgeSeconds = 60 * 60 * 24 * 7,
): CookieOptions => ({
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: maxAgeSeconds,
});

// ── User cookie encoding ──────────────────────────────────────
// The user profile is stored as base64url. Crucially this avoids percent-escapes:
// percent-encoding the JSON and letting Next's cookie serializer encode it a second
// time roughly doubled the size (e.g. 2.1 KB JSON -> 4.1 KB) and tipped high-permission
// users (super_admin) over the browser's ~4 KB per-cookie limit, so the cookie was
// silently dropped — causing a /dashboard <-> /login redirect loop. base64url uses only
// [A-Za-z0-9-_], which the serializer never escapes, keeping the value compact.

const toBase64Url = (input: string): string =>
  Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const fromBase64Url = (input: string): string => {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
};

/** Serialize the user profile for the iams_user cookie (compact, no percent-escapes). */
export const encodeUserCookie = (profile: unknown): string =>
  toBase64Url(JSON.stringify(profile));

/**
 * Parse the iams_user cookie. Tolerant of the current base64url format and the
 * legacy percent-encoded format(s) so existing sessions keep working after deploy.
 */
export const decodeUserCookie = <T = unknown>(raw: string): T | null => {
  const candidates: string[] = [];
  try {
    candidates.push(fromBase64Url(raw));
  } catch {
    /* not base64url */
  }
  candidates.push(raw);
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    /* not percent-encoded */
  }
  try {
    candidates.push(decodeURIComponent(decodeURIComponent(raw)));
  } catch {
    /* not double percent-encoded */
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* try next candidate */
    }
  }
  return null;
};

// ── Access-token claims ───────────────────────────────────────
// Roles and permissions live in the access JWT (the backend requires them there
// for authorization). Reading them from the JWT — rather than duplicating them in
// the iams_user cookie — keeps the user cookie small and bounded forever, no matter
// how many permissions a role accrues. We only decode the payload for read-only UI
// gating; the backend remains the security boundary, so no signature check is needed.

export interface AccessClaims {
  sub: string;
  email: string;
  displayName?: string | null;
  roles?: string[];
  permissions?: string[];
  isSuperAdmin?: boolean;
}

export const decodeAccessClaims = (token: string | undefined): AccessClaims | null => {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(fromBase64Url(payload)) as AccessClaims;
    return claims?.sub ? claims : null;
  } catch {
    return null;
  }
};
