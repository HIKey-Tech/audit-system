'use client';

import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, Building2, Briefcase, Clock, ShieldCheck } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { usersApi } from '@/lib/api/users';
import { formatDate } from '@/lib/utils/format';
import { initialsFromName } from '@/lib/utils/format';

interface Props {
  userId: string | null;
  onClose: () => void;
}

export const UserDetailSlideOver = ({ userId, onClose }: Props): JSX.Element => {
  const query = useQuery({
    queryKey: ['users', userId],
    queryFn: () => usersApi.get(userId!),
    enabled: Boolean(userId),
  });

  const user = query.data;

  return (
    <SlideOver open={Boolean(userId)} onClose={onClose} title="User Profile" width="md">
      {query.isLoading ? (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : !user ? null : (
        <div className="space-y-6">
          {/* Profile header */}
          <div className="flex items-center gap-4">
            <Avatar
              initials={initialsFromName(user.firstName, user.lastName, user.displayName)}
              size="lg"
              tone="navy"
            />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-text-primary">
                {user.displayName ?? `${user.firstName} ${user.lastName}`}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">{user.jobTitle ?? '—'}</p>
              <div className="mt-1.5">
                <StatusBadge status={user.isActive ? 'active' : 'inactive'} withDot />
              </div>
            </div>
          </div>

          {/* Contact details */}
          <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Contact &amp; Info
            </p>
            <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={user.email} />
            <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={user.phone} />
            <DetailRow
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Department"
              value={user.department}
            />
            <DetailRow
              icon={<Briefcase className="h-3.5 w-3.5" />}
              label="Job Title"
              value={user.jobTitle}
            />
            <DetailRow
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              label="Max Concurrent Engagements"
              value={user.maxConcurrentEngagements != null ? String(user.maxConcurrentEngagements) : 'System default'}
            />
            <DetailRow
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Last Login"
              value={user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
            />
          </div>

          {/* Roles */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Roles ({user.roles.length})
            </p>
            {user.roles.length === 0 ? (
              <p className="text-xs text-text-secondary">No roles assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <Badge key={r.id} tone="blue">
                    {r.name.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Permissions */}
          {user.permissions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-text-muted" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  Permissions ({user.permissions.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-3">
                {user.permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
};

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-text-muted shrink-0">{icon}</span>
      <span className="text-xs text-text-secondary w-20 shrink-0">{label}</span>
      <span className="text-xs text-text-primary font-medium truncate min-w-0">
        {value ?? '—'}
      </span>
    </div>
  );
}
