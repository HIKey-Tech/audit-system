import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';

interface BackendResponse {
  success: boolean;
  message?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json(
      { success: false, message: 'Email is required' },
      { status: 400 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(buildBackendUrl('/auth/forgot-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email }),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cannot reach authentication service' },
      { status: 502 },
    );
  }

  const json = (await backendRes.json().catch(() => null)) as BackendResponse | null;

  // The backend deliberately returns a generic 200 to avoid user enumeration;
  // pass its message straight through.
  return NextResponse.json(
    {
      success: json?.success ?? backendRes.ok,
      message: json?.message ?? 'If an account exists, a reset link has been sent.',
    },
    { status: backendRes.status || 200 },
  );
}
