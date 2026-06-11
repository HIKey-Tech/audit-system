import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import { MFA_ENROLL_COOKIE, ACCESS_COOKIE } from '@/lib/utils/auth-cookies';
import { setAuthCookies, BackendAuthData } from '@/lib/auth-session';

interface EnrollData {
  backupCodes: string[];
  auth: BackendAuthData;
}

interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const enrollToken =
    req.cookies.get(MFA_ENROLL_COOKIE)?.value ?? req.cookies.get(ACCESS_COOKIE)?.value;
  if (!enrollToken) {
    return NextResponse.json(
      { success: false, message: 'Your session has expired. Please sign in again.' },
      { status: 401 },
    );
  }

  let body: { method?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(buildBackendUrl('/auth/2fa/enroll'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${enrollToken}`,
      },
      body: JSON.stringify({ method: body.method, code: body.code }),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cannot reach authentication service' },
      { status: 502 },
    );
  }

  const json = (await backendRes.json().catch(() => null)) as BackendResponse<EnrollData> | null;

  if (!backendRes.ok || !json?.success || !json.data) {
    return NextResponse.json(
      { success: false, message: json?.message || 'Could not verify code', errors: json?.errors },
      { status: backendRes.status || 400 },
    );
  }

  // Enrolment succeeded: promote to a full session, drop the enrol cookie,
  // and return the one-time backup codes to display.
  const res = NextResponse.json({
    success: true,
    message: json.message,
    data: { backupCodes: json.data.backupCodes },
  });
  setAuthCookies(res, json.data.auth);
  res.cookies.delete(MFA_ENROLL_COOKIE);
  return res;
}
