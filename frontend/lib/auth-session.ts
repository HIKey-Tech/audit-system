// Server-only helper: write the authenticated session cookies from a backend
// auth payload. Shared by the login / 2FA-verify / 2FA-enroll route handlers.
import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  USER_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  userCookieOptions,
  encodeUserCookie,
} from './utils/auth-cookies';

export interface BackendAuthUser {
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
}

export interface BackendAuthData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: BackendAuthUser;
}

export const setAuthCookies = (res: NextResponse, data: BackendAuthData): void => {
  const { user } = data;
  const profile = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    department: user.department,
    jobTitle: user.jobTitle,
  };
  res.cookies.set(ACCESS_COOKIE, data.accessToken, accessCookieOptions(data.expiresIn || 60 * 60));
  res.cookies.set(REFRESH_COOKIE, data.refreshToken, refreshCookieOptions());
  res.cookies.set(USER_COOKIE, encodeUserCookie(profile), userCookieOptions());
};
