'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, AlertTriangle } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { findingsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermission } from '@/hooks/usePermission';
import type { AuditEngagementDetail } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';
import { NewFindingSlideOver } from './NewFindingSlideOver';

export const FindingsTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const canWrite = usePermission('finding:create');

  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'findings'],
    queryFn: () => findingsApi.listByEngagement(engagement.id),
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Findings</h2>
          <p className="text-xs text-text-secondary">Issues raised against this engagement.</p>
        </div>
        {canWrite && (
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
            New finding
          </Button>
        )}
      </div>

      <Card padded={false}>
        {list.isLoading ? (
          <div className="p-5 space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-4 w-4" />}
            title="No findings yet"
            description="Document control deficiencies, risks and recommendations as you progress."
            action={
              canWrite ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
                  New finding
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.data.map((f) => {
              const overdue =
                new Date(f.dueDate) < new Date() && !['verified', 'pending_closure', 'closed'].includes(f.status);
              return (
                <li key={f.id}>
                  <Link
                    href={`/audit/findings/${f.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-alt/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{f.title}</p>
                      <p className="text-[11px] text-text-muted">
                        {f.auditeeName}
                        {f.controlReference && (
                          <span className="ml-2 rounded bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                            from {f.controlReference}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge tone="gray">{humanizeStatus(f.category)}</Badge>
                    <StatusBadge status={f.severity} />
                    <StatusBadge status={f.status} />
                    <span
                      className={cn(
                        'text-xs',
                        overdue ? 'text-danger font-medium' : 'text-text-secondary',
                      )}
                    >
                      Due {formatDate(f.dueDate)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <NewFindingSlideOver engagement={engagement} open={open} onClose={() => setOpen(false)} />
    </div>
  );
};
