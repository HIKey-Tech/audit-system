import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import { MFA_CHALLENGE_COOKIE } from '@/lib/utils/auth-cookies';

interface BackendResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Resend the login email OTP. Forwards the httpOnly MFA challenge token to the
 * backend, which enforces the cooldown + cap. The challenge cookie is preserved
 * (the challenge is still in progress); a 429 is passed straight through.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const challengeToken = req.cookies.get(MFA_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) {
    return NextResponse.json(
      { success: false, message: 'Your verification session has expired. Please sign in again.' },
      { status: 401 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(buildBackendUrl('/auth/2fa/resend'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${challengeToken}` },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cannot reach authentication service' },
      { status: 502 },
    );
  }

  const json = (await backendRes.json().catch(() => null)) as
    | BackendResponse<{ cooldownSeconds: number }>
    | null;

  if (!backendRes.ok || !json?.success) {
    return NextResponse.json(
      { success: false, message: json?.message || 'Could not resend the code' },
      { status: backendRes.status || 400 },
    );
  }

  return NextResponse.json({
    success: true,
    message: json.message ?? 'A new code has been sent',
    data: json.data ?? { cooldownSeconds: 30 },
  });
}
