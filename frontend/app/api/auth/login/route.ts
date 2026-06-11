import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  USER_COOKIE,
  MFA_CHALLENGE_COOKIE,
  MFA_ENROLL_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  userCookieOptions,
  mfaCookieOptions,
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
  roles: Array<{ id: string; name: string }>;
  permissions: string[];
}

// Discriminated union returned by POST /auth/login.
type BackendLoginData =
  | {
      status: 'OK';
      mfaSetupRequired?: boolean;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: string;
      user: BackendUser;
    }
  | { status: 'MFA_REQUIRED'; method: 'totp' | 'email'; challengeToken: string }
  | { status: 'MFA_ENROLLMENT_REQUIRED'; enrollmentToken: string };

interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

// maxAge values mirror the backend token TTLs (challenge 5m, enrol 15m).
const MFA_CHALLENGE_MAX_AGE = 5 * 60;
const MFA_ENROLL_MAX_AGE = 15 * 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json(
      { success: false, message: 'Email and password are required' },
      { status: 400 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(buildBackendUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: 'Cannot reach authentication service' },
      { status: 502 },
    );
  }

  const backendJson = (await backendRes.json().catch(() => null)) as
    | BackendResponse<BackendLoginData>
    | null;

  if (!backendRes.ok || !backendJson?.success || !backendJson.data) {
    return NextResponse.json(
      {
        success: false,
        message: backendJson?.message || 'Invalid credentials',
        errors: backendJson?.errors,
      },
      { status: backendRes.status || 401 },
    );
  }

  const data = backendJson.data;

  // ── Intermediate 2FA states: stash the short-lived token in an httpOnly
  // cookie and tell the client where to go. No auth cookies are set yet. ──
  if (data.status === 'MFA_REQUIRED') {
    const res = NextResponse.json({
      success: true,
      message: backendJson.message,
      data: { status: data.status, method: data.method },
    });
    res.cookies.set(
      MFA_CHALLENGE_COOKIE,
      data.challengeToken,
      mfaCookieOptions(MFA_CHALLENGE_MAX_AGE),
    );
    return res;
  }

  if (data.status === 'MFA_ENROLLMENT_REQUIRED') {
    const res = NextResponse.json({
      success: true,
      message: backendJson.message,
      data: { status: data.status },
    });
    res.cookies.set(
      MFA_ENROLL_COOKIE,
      data.enrollmentToken,
      mfaCookieOptions(MFA_ENROLL_MAX_AGE),
    );
    return res;
  }

  // ── Fully authenticated ──
  const { accessToken, refreshToken, expiresIn, user } = data;

  // Display-only profile. Roles/permissions are NOT stored here — they are read
  // from the access JWT at request time (see lib/session.ts). This keeps the
  // iams_user cookie small and bounded regardless of how many permissions exist,
  // preventing the >4KB cookie-drop that caused the /dashboard <-> /login loop.
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

  const res = NextResponse.json({
    success: true,
    message: 'Login successful',
    data: { status: 'OK', user, mfaSetupRequired: data.mfaSetupRequired ?? false },
  });
  res.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions(expiresIn || 60 * 60));
  res.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.cookies.set(USER_COOKIE, encodeUserCookie(profile), userCookieOptions());
  return res;
}
