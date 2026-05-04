'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertOctagon } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatNumber, formatRelative } from '@/lib/utils/format';

const LEVEL_TONES = [
  '',
  'bg-yellow-50 text-yellow-700 ring-yellow-200',
  'bg-orange-50 text-orange-700 ring-orange-200',
  'bg-red-50 text-red-700 ring-red-200',
  'bg-violet-50 text-violet-700 ring-violet-200',
];

export const EscalationsCard = (): JSX.Element => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'escalations'],
    queryFn: () => dashboardApi.getEscalations(),
  });

  return (
    <Card>
      <CardHeader title="Escalations" subtitle="Active across all entities" />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : isError ? (
        <ErrorState compact onRetry={() => refetch()} />
      ) : data!.totalActive === 0 ? (
        <EmptyState
          compact
          icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          title="No active escalations"
          description="All audits are on track."
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-surface-alt p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Total active
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-text-primary">
              {formatNumber(data!.totalActive)}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((lvl) => {
              const key = `level${lvl}` as 'level1' | 'level2' | 'level3' | 'level4';
              const value = data!.byLevel[key] ?? 0;
              return (
                <div
                  key={lvl}
                  className={`rounded-md ring-1 px-2 py-2 text-center ${LEVEL_TONES[lvl]}`}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-widest opacity-80">
                    L{lvl}
                  </p>
                  <p className="text-base font-semibold tabular-nums">{value}</p>
                </div>
              );
            })}
          </div>
          {data!.recentEscalations.length > 0 && (
            <ul className="space-y-2 pt-1">
              {data!.recentEscalations.slice(0, 3).map((esc) => (
                <li
                  key={esc.id}
                  className="flex items-start gap-2 text-xs"
                >
                  <AlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-text-primary">{esc.reason}</p>
                    <p className="text-[10px] text-text-muted">
                      L{esc.escalationLevel} · {esc.notifiedUserName} · {formatRelative(esc.notifiedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};
