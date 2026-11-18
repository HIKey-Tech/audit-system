'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { ruleForPath } from '@/lib/route-access';

/**
 * Stops a page from opening, and from making requests that can only fail, when the person's role does not include
 * it, for example when they type the address. Says so plainly instead of showing a page full of access errors.
 */
export const RouteAccessGuard = ({ children }: { children: React.ReactNode }): JSX.Element => {
  const pathname = usePathname() ?? '';
  const { hasPermission } = usePermissions();
  const rule = ruleForPath(pathname);
  if (rule && !rule.anyOf.some((p) => hasPermission(p))) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-8 w-8" />}
        title={`You don't have access to ${rule.label}`}
        description="This area is not part of your role. If you think it should be, ask the Head of Internal Audit."
      />
    );
  }
  return <>{children}</>;
};
