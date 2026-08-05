'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatNumber, formatPercent } from '@/lib/utils/format';
import { ragForRate, ragForCount } from '@/lib/utils/status';
import { useInView } from '@/lib/hooks/useInView';
import { cn } from '@/lib/utils/cn';

// A KPI tile with an optional linear gauge (for rates) or a RAG dot (for counts).
interface MetricTileProps {
  label: string;
  value: string;
  hint?: string;
  gauge?: { value: number; bar: string; track: string };
  dot?: string;
  dotTitle?: string;
}

const MetricTile = ({ label, value, hint, gauge, dot, dotTitle }: MetricTileProps): JSX.Element => (
  <div className="rounded-lg border border-border bg-surface-alt p-3">
    <div className="flex items-center gap-1.5">
      {dot && <span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} title={dotTitle} aria-hidden />}
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
    </div>
    <p className="mt-1.5 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
    {gauge && (
      <div className={cn('mt-2 h-1.5 w-full overflow-hidden rounded-full', gauge.track)}>
        <div
          className={cn('h-full rounded-full', gauge.bar)}
          style={{ width: `${Math.min(100, Math.max(0, gauge.value))}%` }}
        />
      </div>
    )}
    {hint && <p className="mt-1.5 text-[11px] text-text-muted">{hint}</p>}
  </div>
);

const days = (value: number | null): string =>
  value === null ? '—' : `${formatNumber(Math.round(value))}d`;

export const ProgrammeHealth = (): JSX.Element => {
  // Defer the heavy ~20-query analytics aggregation until this card nears the
  // viewport, so it never blocks the initial dashboard paint.
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: '300px' });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: () => dashboardApi.getAnalytics(),
    enabled: inView,
  });

  return (
    <div ref={ref}>
    <Card>
      <CardHeader title="Programme Health" subtitle="Coverage, cycle time & follow-up performance" />
      {isError ? (
        <ErrorState compact onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        (() => {
          const a = data;
          const coverageRag = ragForRate(a.riskCoverage.highRiskCoverageRate);
          const followUpRate =
            a.followUp.total === 0 ? 0 : Math.round((a.followUp.verified / a.followUp.total) * 1000) / 10;
          const followUpRag = ragForRate(followUpRate, 80, 60);
          const overdueRag = ragForCount(a.followUp.overdueFindings);

          return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MetricTile
                label="High-Risk Coverage"
                value={formatPercent(a.riskCoverage.highRiskCoverageRate)}
                gauge={{ value: a.riskCoverage.highRiskCoverageRate, bar: coverageRag.bar, track: coverageRag.track }}
                hint={`${formatNumber(a.riskCoverage.highRiskAuditedThisYear)}/${formatNumber(a.riskCoverage.highRiskUniverseItems)} audited`}
              />
              <MetricTile
                label="Follow-up Verified"
                value={formatPercent(followUpRate)}
                gauge={{ value: followUpRate, bar: followUpRag.bar, track: followUpRag.track }}
                hint={`${formatNumber(a.followUp.verified)}/${formatNumber(a.followUp.total)} actions`}
              />
              <MetricTile
                label="Avg Cycle Time"
                value={days(a.lifecycle.averageCycleDays)}
                hint="plan → close"
              />
              <MetricTile
                label="Avg Review Issue"
                value={days(a.reporting.averageDaysToIssue)}
                hint="draft → issued"
              />
              <MetricTile
                label="WP Awaiting Review"
                value={formatNumber(a.workingPapers.submittedAwaitingReview)}
                hint={`of ${formatNumber(a.workingPapers.total)} papers`}
              />
              <MetricTile
                label="Overdue Follow-ups"
                value={formatNumber(a.followUp.overdueFindings)}
                dot={overdueRag.dot}
                dotTitle={overdueRag.label}
                hint="past due date"
              />
            </div>
          );
        })()
      )}
    </Card>
    </div>
  );
};
