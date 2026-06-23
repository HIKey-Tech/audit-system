'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, AlertTriangle, ShieldAlert, Inbox } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatNumber, formatPercent } from '@/lib/utils/format';
import { ragForRate, ragForCount } from '@/lib/utils/status';
import { cn } from '@/lib/utils/cn';

interface RagStyle {
  level: 'green' | 'amber' | 'red';
  label: string;
  dot: string;
  text: string;
  bar: string;
  track: string;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  /** Traffic-light status driving the dot, progress fill, and chip. */
  rag: RagStyle;
  /** Optional gauge under the value. `target` renders a target marker. */
  progress?: { value: number; label?: string; target?: number };
}

const StatCard = ({ label, value, icon, hint, href, rag, progress }: StatCardProps): JSX.Element => {
  const inner = (
    <Card className={cn('h-full', href && 'transition-shadow hover:shadow-card-hover cursor-pointer')}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', rag.dot)}
              title={rag.label}
              aria-hidden
            />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              {label}
            </p>
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-text-primary tabular-nums">
            {formatNumber(value)}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/5 text-primary">
          {icon}
        </div>
      </div>

      {hint && <div className="mt-3 text-xs text-text-secondary">{hint}</div>}

      {progress && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-text-muted">
            <span>{progress.label ?? 'Completion'}</span>
            <span className={rag.text}>{formatPercent(progress.value)}</span>
          </div>
          <div className={cn('relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full', rag.track)}>
            <div
              className={cn('h-full rounded-full', rag.bar)}
              style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
            />
            {progress.target !== undefined && (
              <span
                className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-text-muted/60"
                style={{ left: `${Math.min(100, Math.max(0, progress.target))}%` }}
                title={`Target ${progress.target}%`}
                aria-hidden
              />
            )}
          </div>
        </div>
      )}
    </Card>
  );

  return href ? (
    <Link href={href} className="block focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
      {inner}
    </Link>
  ) : (
    inner
  );
};

export const StatCards = (): JSX.Element => {
  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.getSummary(),
  });

  const findings = useQuery({
    queryKey: ['dashboard', 'findings'],
    queryFn: () => dashboardApi.getFindings(),
  });

  const risks = useQuery({
    queryKey: ['dashboard', 'risks'],
    queryFn: () => dashboardApi.getRisks(),
  });

  const inbox = useQuery({
    queryKey: ['dashboard', 'approval-inbox'],
    queryFn: () => dashboardApi.getApprovalInbox(),
  });

  if (summary.isLoading || findings.isLoading || risks.isLoading || inbox.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const refetchAll = () => {
    summary.refetch();
    findings.refetch();
    risks.refetch();
    inbox.refetch();
  };

  if (summary.isError || findings.isError || risks.isError || inbox.isError) {
    return (
      <Card>
        <ErrorState
          compact
          title="Could not load dashboard summary"
          message="Try again or contact an administrator if this persists."
          onRetry={refetchAll}
        />
      </Card>
    );
  }

  const s = summary.data!;
  const f = findings.data!;
  const r = risks.data!;
  const i = inbox.data!;

  // RAG status per KPI — standard audit-committee thresholds.
  const completionRag = ragForRate(s.completionRate); // ≥85 green, 70–85 amber
  const overdueRag = ragForCount(f.overdue); // 0 green, 1–3 amber, >3 red
  const criticalRag = ragForCount(r.byScoreBand.critical); // critical risks
  const approvalsRag = ragForCount(i.oldestPendingDays, 7); // aging approvals (days)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Engagements"
        value={s.totalEngagementsThisYear}
        icon={<Briefcase className="h-4 w-4" />}
        rag={completionRag}
        hint={<span>this year • {formatNumber(s.approvedPlans)} approved plans</span>}
        progress={{ value: s.completionRate, label: 'Completion', target: 85 }}
      />
      <StatCard
        label="Open Findings"
        value={f.totalOpen}
        icon={<AlertTriangle className="h-4 w-4" />}
        rag={overdueRag}
        hint={<span className={cn('font-medium', overdueRag.text)}>{formatNumber(f.overdue)} overdue</span>}
      />
      <StatCard
        label="Total Risks"
        value={r.totalRisks}
        icon={<ShieldAlert className="h-4 w-4" />}
        rag={criticalRag}
        hint={<span className={cn('font-medium', criticalRag.text)}>{formatNumber(r.byScoreBand.critical)} critical</span>}
      />
      <StatCard
        label="Pending Approvals"
        value={i.pendingCount}
        icon={<Inbox className="h-4 w-4" />}
        rag={approvalsRag}
        hint={
          i.pendingCount > 0 ? (
            <span className={cn('font-medium', approvalsRag.text)}>Oldest waiting {formatNumber(i.oldestPendingDays)} days</span>
          ) : (
            <span className="text-text-secondary">Inbox is clear</span>
          )
        }
        href="/workflow/approvals"
      />
    </div>
  );
};
