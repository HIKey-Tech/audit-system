import { cookies } from 'next/headers';
import { USER_COOKIE } from '@/lib/utils/auth-cookies';
import type { SessionUser } from '@/components/providers/AuthProvider';

export const readSessionUserFromCookies = (): SessionUser | null => {
  const store = cookies();
  const raw = store.get(USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as SessionUser;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
};
