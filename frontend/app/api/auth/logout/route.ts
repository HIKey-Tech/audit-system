import { NextRequest, NextResponse } from 'next/server';
import { buildBackendUrl } from '@/lib/backend';
import { ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE } from '@/lib/utils/auth-cookies';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;

  if (accessToken && refreshToken) {
    await fetch(buildBackendUrl('/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ success: true, message: 'Logged out' });
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  res.cookies.delete(USER_COOKIE);
  return res;
}
