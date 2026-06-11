import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import { MFA_CHALLENGE_COOKIE } from '@/lib/utils/auth-cookies';
import { setAuthCookies, BackendAuthData } from '@/lib/auth-session';

interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const challengeToken = req.cookies.get(MFA_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) {
    return NextResponse.json(
      { success: false, message: 'Your verification session has expired. Please sign in again.' },
      { status: 401 },
    );
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  if (!body.code) {
    return NextResponse.json({ success: false, message: 'A code is required' }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(buildBackendUrl('/auth/2fa/verify'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${challengeToken}`,
      },
      body: JSON.stringify({ code: body.code }),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cannot reach authentication service' },
      { status: 502 },
    );
  }

  const json = (await backendRes.json().catch(() => null)) as BackendResponse<BackendAuthData> | null;

  if (!backendRes.ok || !json?.success || !json.data) {
    return NextResponse.json(
      { success: false, message: json?.message || 'Invalid verification code', errors: json?.errors },
      { status: backendRes.status || 401 },
    );
  }

  const res = NextResponse.json({
    success: true,
    message: 'Login successful',
    data: { user: json.data.user },
  });
  setAuthCookies(res, json.data);
  res.cookies.delete(MFA_CHALLENGE_COOKIE);
  return res;
}
