'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, AlertTriangle, ShieldAlert, Inbox } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatNumber, formatPercent } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  progress?: { value: number; label?: string };
}

const StatCard = ({ label, value, icon, hint, href, progress }: StatCardProps): JSX.Element => {
  const inner = (
    <Card className={cn('h-full', href && 'transition-shadow hover:shadow-card-hover cursor-pointer')}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            {label}
          </p>
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
            <span>{formatPercent(progress.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
            />
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

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Engagements"
        value={s.totalEngagementsThisYear}
        icon={<Briefcase className="h-4 w-4" />}
        hint={<span>this year • {formatNumber(s.approvedPlans)} approved plans</span>}
        progress={{ value: s.completionRate, label: 'Completion' }}
      />
      <StatCard
        label="Open Findings"
        value={f.totalOpen}
        icon={<AlertTriangle className="h-4 w-4" />}
        hint={
          <span className={cn('font-medium', f.overdue > 0 ? 'text-danger' : 'text-text-secondary')}>
            {formatNumber(f.overdue)} overdue
          </span>
        }
      />
      <StatCard
        label="Active Risks"
        value={r.totalRisks}
        icon={<ShieldAlert className="h-4 w-4" />}
        hint={
          <span className={cn('font-medium', r.byScoreBand.critical > 0 ? 'text-danger' : 'text-text-secondary')}>
            {formatNumber(r.byScoreBand.critical)} critical
          </span>
        }
      />
      <StatCard
        label="Pending Approvals"
        value={i.pendingCount}
        icon={<Inbox className="h-4 w-4" />}
        hint={
          i.pendingCount > 0 ? (
            <span className="text-text-secondary">Oldest waiting {formatNumber(i.oldestPendingDays)} days</span>
          ) : (
            <span className="text-text-secondary">Inbox is clear</span>
          )
        }
        href="/workflow/approvals"
      />
    </div>
  );
};
