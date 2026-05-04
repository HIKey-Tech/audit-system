'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatNumber } from '@/lib/utils/format';

const ROWS: { key: keyof FindingBuckets; label: string; barColor: string }[] = [
  { key: 'critical', label: 'Critical', barColor: 'bg-red-500' },
  { key: 'high', label: 'High', barColor: 'bg-orange-500' },
  { key: 'medium', label: 'Medium', barColor: 'bg-yellow-500' },
  { key: 'low', label: 'Low', barColor: 'bg-emerald-500' },
  { key: 'informational', label: 'Informational', barColor: 'bg-slate-400' },
];

interface FindingBuckets {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
}

export const FindingsBySeverity = (): JSX.Element => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'findings'],
    queryFn: () => dashboardApi.getFindings(),
  });

  return (
    <Card>
      <CardHeader title="Findings by Severity" subtitle="Open findings only" />
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState compact onRetry={() => refetch()} />
      ) : (
        (() => {
          const sev = data!.bySeverity;
          const max = Math.max(1, sev.critical, sev.high, sev.medium, sev.low, sev.informational);
          return (
            <div className="space-y-3">
              {ROWS.map((row) => {
                const value = sev[row.key];
                const pct = (value / max) * 100;
                return (
                  <div key={row.key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-text-primary">{row.label}</span>
                      <span className="tabular-nums text-text-secondary">{formatNumber(value)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.barColor}`}
                        style={{ width: `${value === 0 ? 0 : Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}
    </Card>
  );
};
