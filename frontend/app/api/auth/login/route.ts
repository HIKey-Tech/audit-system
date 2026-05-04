import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  USER_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  userCookieOptions,
} from '@/lib/utils/auth-cookies';

interface BackendAuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
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
  };
}

interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

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
    | BackendResponse<BackendAuthData>
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

  const { accessToken, refreshToken, expiresIn, user } = backendJson.data;

  const profile = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    department: user.department,
    jobTitle: user.jobTitle,
    roles: user.roles.map((r) => r.name),
    permissions: user.permissions,
  };

  const res = NextResponse.json({ success: true, message: 'Login successful', data: { user } });
  res.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions(expiresIn || 60 * 60));
  res.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(profile)), userCookieOptions());
  return res;
}
