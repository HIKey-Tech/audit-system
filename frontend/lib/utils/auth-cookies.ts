// Shared cookie names for the Next.js auth proxy.

export const ACCESS_COOKIE = 'iams_access';
export const REFRESH_COOKIE = 'iams_refresh';
export const USER_COOKIE = 'iams_user';

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
