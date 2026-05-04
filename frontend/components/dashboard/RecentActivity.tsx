'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatRelative } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';

export const RecentActivity = (): JSX.Element => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => dashboardApi.getActivity(20),
  });

  return (
    <Card>
      <CardHeader title="Recent Activity" subtitle="Last 20 audit-trail events" />
      {isLoading ? (
        <ListSkeleton rows={8} />
      ) : isError ? (
        <ErrorState compact onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          compact
          icon={<Activity className="h-4 w-4" />}
          title="No recent activity"
          description="System actions appear here as they occur."
        />
      ) : (
        <ul className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
          {data.map((entry, idx) => (
            <li
              key={entry.id}
              className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-0"
            >
              <span className="mt-1 shrink-0">
                {entry.status === 'success' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-danger" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-text-primary">
                  <span className="font-medium">{humanizeStatus(entry.action)}</span>
                  {entry.entityType && (
                    <span className="text-text-secondary"> · {entry.entityType}</span>
                  )}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge tone="gray" size="xs">
                    {entry.module}
                  </Badge>
                  <span className="text-[10px] text-text-muted">
                    {formatRelative(entry.createdAt)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
