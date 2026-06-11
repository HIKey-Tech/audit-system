import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';

interface BackendResponse {
  success: boolean;
  message?: string;
  errors?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { token?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  if (!body.token || !body.newPassword) {
    return NextResponse.json(
      { success: false, message: 'Token and new password are required' },
      { status: 400 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(buildBackendUrl('/auth/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: body.token, newPassword: body.newPassword }),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cannot reach authentication service' },
      { status: 502 },
    );
  }

  const json = (await backendRes.json().catch(() => null)) as BackendResponse | null;

  if (!backendRes.ok || !json?.success) {
    return NextResponse.json(
      {
        success: false,
        message: json?.message || 'Could not reset password',
        errors: json?.errors,
      },
      { status: backendRes.status || 400 },
    );
  }

  return NextResponse.json({ success: true, message: json.message || 'Password reset successfully' });
}
