import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  USER_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  userCookieOptions,
  encodeUserCookie,
} from '@/lib/utils/auth-cookies';

interface BackendUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  department: string | null;
  jobTitle: string | null;
}

interface SsoAuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: BackendUser;
}

interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const baseUrl = (): string => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

/**
 * Microsoft (Entra) redirects the browser here after authentication. We forward
 * the code + state to the backend (which holds the PKCE verifier) to exchange
 * for tokens, then store them in httpOnly cookies — same model as local login —
 * and land the user on the dashboard.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const idpError = url.searchParams.get('error');

  if (idpError) {
    return NextResponse.redirect(new URL('/login?error=sso_denied', baseUrl()));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=sso_invalid', baseUrl()));
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(
      buildBackendUrl('/auth/callback', new URLSearchParams({ code, state })),
      { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
    );
  } catch {
    return NextResponse.redirect(new URL('/login?error=sso_unreachable', baseUrl()));
  }

  const json = (await backendRes.json().catch(() => null)) as
    | BackendResponse<SsoAuthData>
    | null;

  if (!backendRes.ok || !json?.success || !json.data) {
    return NextResponse.redirect(new URL('/login?error=sso_failed', baseUrl()));
  }

  const { accessToken, refreshToken, expiresIn, user } = json.data;
  const profile = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    department: user.department,
    jobTitle: user.jobTitle,
  };

  const res = NextResponse.redirect(new URL('/dashboard', baseUrl()));
  res.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions(expiresIn || 60 * 60));
  res.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.cookies.set(USER_COOKIE, encodeUserCookie(profile), userCookieOptions());
  return res;
}
