import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from '@/lib/utils/auth-cookies';

interface BackendTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ success: false, message: 'No refresh token' }, { status: 401 });
  }

  const backendRes = await fetch(buildBackendUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => null);

  if (!backendRes || !backendRes.ok) {
    const res = NextResponse.json({ success: false, message: 'Refresh failed' }, { status: 401 });
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  const json = (await backendRes.json().catch(() => null)) as
    | { success: boolean; data?: BackendTokenPair }
    | null;

  if (!json?.success || !json.data) {
    return NextResponse.json({ success: false, message: 'Refresh failed' }, { status: 401 });
  }

  const { accessToken, refreshToken: newRefresh, expiresIn } = json.data;
  const res = NextResponse.json({ success: true, message: 'Refreshed' });
  res.cookies.set(ACCESS_COOKIE, accessToken, accessCookieOptions(expiresIn || 60 * 60));
  res.cookies.set(REFRESH_COOKIE, newRefresh, refreshCookieOptions());
  return res;
}
