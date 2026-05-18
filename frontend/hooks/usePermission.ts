'use client';

import { useSession, hasPermission } from '@/components/providers/AuthProvider';

/** Returns true if the current user has the given permission slug (super_admin bypasses). */
export const usePermission = (slug: string): boolean => {
  const session = useSession();
  return hasPermission(session, slug);
};

/** Returns true if the current user has ALL of the listed permission slugs. */
export const usePermissions = (slugs: string[]): boolean => {
  const session = useSession();
  return slugs.every((s) => hasPermission(session, s));
};

/** Returns true if the current user has ANY of the listed permission slugs. */
export const useAnyPermission = (slugs: string[]): boolean => {
  const session = useSession();
  return slugs.some((s) => hasPermission(session, s));
};
