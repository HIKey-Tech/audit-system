'use client';

import { createContext, useContext, ReactNode } from 'react';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  department: string | null;
  jobTitle: string | null;
  roles: string[];
  permissions: string[];
}

const Ctx = createContext<SessionUser | null>(null);

export const AuthProvider = ({
  user,
  children,
}: {
  user: SessionUser | null;
  children: ReactNode;
}): JSX.Element => <Ctx.Provider value={user}>{children}</Ctx.Provider>;

export const useSession = (): SessionUser => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useSession must be used within AuthProvider');
  }
  return ctx;
};

export const useOptionalSession = (): SessionUser | null => useContext(Ctx);

export const hasPermission = (
  user: SessionUser | null,
  permission: string,
): boolean => {
  if (!user) return false;
  if (user.roles.includes('super_admin')) return true;
  return user.permissions.includes(permission);
};

export const hasRole = (user: SessionUser | null, role: string): boolean => {
  if (!user) return false;
  return user.roles.includes(role);
};

export const hasAnyRole = (user: SessionUser | null, roles: string[]): boolean => {
  if (!user) return false;
  return roles.some((r) => user.roles.includes(r));
};
