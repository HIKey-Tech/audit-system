import { NextRequest, NextResponse } from 'next/server';
import { USER_COOKIE, encodeUserCookie, userCookieOptions } from '@/lib/utils/auth-cookies';

interface DisplayProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  department: string | null;
  jobTitle: string | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: DisplayProfile;
  try {
    body = (await req.json()) as DisplayProfile;
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  if (!body.id || !body.email) {
    return NextResponse.json({ success: false, message: 'Invalid profile payload' }, { status: 400 });
  }

  const profile: DisplayProfile = {
    id: body.id,
    email: body.email,
    firstName: body.firstName ?? '',
    lastName: body.lastName ?? '',
    displayName: body.displayName ?? null,
    avatarUrl: body.avatarUrl ?? null,
    department: body.department ?? null,
    jobTitle: body.jobTitle ?? null,
  };

  const res = NextResponse.json({ success: true, message: 'Session profile updated' });
  res.cookies.set(USER_COOKIE, encodeUserCookie(profile), userCookieOptions());
  return res;
}
