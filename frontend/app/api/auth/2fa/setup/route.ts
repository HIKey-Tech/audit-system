import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import { MFA_ENROLL_COOKIE, ACCESS_COOKIE } from '@/lib/utils/auth-cookies';

interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Forced enrolment carries an enrol token; voluntary (grace-period) setup
  // uses the logged-in user's access token.
  const enrollToken =
    req.cookies.get(MFA_ENROLL_COOKIE)?.value ?? req.cookies.get(ACCESS_COOKIE)?.value;
  if (!enrollToken) {
    return NextResponse.json(
      { success: false, message: 'Your session has expired. Please sign in again.' },
      { status: 401 },
    );
  }

  let body: { method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(buildBackendUrl('/auth/2fa/setup'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${enrollToken}`,
      },
      body: JSON.stringify({ method: body.method }),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cannot reach authentication service' },
      { status: 502 },
    );
  }

  const json = (await backendRes.json().catch(() => null)) as BackendResponse<unknown> | null;

  if (!backendRes.ok || !json?.success) {
    return NextResponse.json(
      { success: false, message: json?.message || 'Could not start 2FA setup', errors: json?.errors },
      { status: backendRes.status || 400 },
    );
  }

  return NextResponse.json({ success: true, message: json.message, data: json.data });
}
