'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Inbox } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';

const ENTITY_LABEL: Record<string, string> = {
  audit_plan: 'Plan',
  audit_working_paper: 'Working Paper',
  audit_report: 'Report',
};

export const MyWorkPanel = (): JSX.Element => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'my-work'],
    queryFn: () => dashboardApi.getMyWork(),
  });

  return (
    <Card>
      <CardHeader title="My Work" subtitle="Active items assigned to you" />
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <Skeleton className="h-3 w-28" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ) : isError ? (
        <ErrorState compact onRetry={() => refetch()} />
      ) : (
        <div className="space-y-5">
          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Active Engagements
            </h4>
            {data!.myActiveEngagements.length === 0 ? (
              <p className="text-xs text-text-muted">None assigned to you.</p>
            ) : (
              <ul className="space-y-2">
                {data!.myActiveEngagements.slice(0, 5).map((eng) => (
                  <li key={eng.id}>
                    <Link
                      href={`/audit/engagements/${eng.id}`}
                      className="flex items-start justify-between gap-2 rounded-md border border-border bg-white px-2.5 py-2 transition-colors hover:bg-surface-alt"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-text-primary">{eng.title}</p>
                        <p className="text-[10px] text-text-muted">{eng.referenceNumber}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={eng.status} size="xs" />
                        <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                          <CalendarClock className="h-3 w-3" />
                          {formatDate(eng.slaDeadline)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Pending Approvals
            </h4>
            {data!.myPendingApprovals.length === 0 ? (
              <EmptyState
                compact
                icon={<Inbox className="h-4 w-4" />}
                title="Inbox is empty"
              />
            ) : (
              <ul className="space-y-2">
                {data!.myPendingApprovals.slice(0, 5).map((step) => (
                  <li
                    key={step.stepId}
                    className="flex items-start justify-between gap-2 rounded-md border border-border bg-white px-2.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-text-primary">
                        {ENTITY_LABEL[step.entityType] ?? humanizeStatus(step.entityType)}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Level {step.currentLevel} · {formatDate(step.createdAt)}
                      </p>
                    </div>
                    <Link
                      href="/workflow"
                      className="text-[10px] font-medium text-primary hover:underline"
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Card>
  );
};
