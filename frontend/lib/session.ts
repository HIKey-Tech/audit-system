import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE,
  USER_COOKIE,
  decodeAccessClaims,
  decodeUserCookie,
} from '@/lib/utils/auth-cookies';
import type { SessionUser } from '@/components/providers/AuthProvider';

type DisplayProfile = Pick<
  SessionUser,
  'id' | 'email' | 'firstName' | 'lastName' | 'displayName' | 'avatarUrl' | 'department' | 'jobTitle'
>;

/**
 * Build the session from two cookies:
 *  - iams_access (JWT) — the source of truth for roles + permissions
 *  - iams_user — small, bounded display fields (name, avatar, department…)
 *
 * Identity falls back to the JWT claims if the display cookie is absent, so a
 * session works from the access token alone.
 */
export const readSessionUserFromCookies = (): SessionUser | null => {
  const store = cookies();
  const claims = decodeAccessClaims(store.get(ACCESS_COOKIE)?.value);
  const rawUser = store.get(USER_COOKIE)?.value;
  const display = rawUser ? decodeUserCookie<DisplayProfile>(rawUser) : null;

  const id = display?.id ?? claims?.sub;
  const email = display?.email ?? claims?.email;
  if (!id || !email) return null;

  return {
    id,
    email,
    firstName: display?.firstName ?? '',
    lastName: display?.lastName ?? '',
    displayName: display?.displayName ?? claims?.displayName ?? null,
    avatarUrl: display?.avatarUrl ?? null,
    department: display?.department ?? null,
    jobTitle: display?.jobTitle ?? null,
    roles: claims?.roles ?? [],
    permissions: claims?.permissions ?? [],
  };
};
