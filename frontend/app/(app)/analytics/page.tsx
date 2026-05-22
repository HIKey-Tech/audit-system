'use client';

import type React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock, FileText, ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatDateTime, formatNumber, formatPercent } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';

const statusOrder = ['planned', 'in_progress', 'under_review', 'reported', 'closed'];

export default function AnalyticsPage(): JSX.Element {
  const query = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: dashboardApi.getAnalytics,
  });

  if (query.isLoading) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Audit lifecycle, findings, reporting, follow-up, and risk coverage." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Audit lifecycle, findings, reporting, follow-up, and risk coverage." />
        <ErrorState onRetry={() => query.refetch()} />
      </div>
    );
  }

  const data = query.data;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle={`Audit lifecycle intelligence generated ${formatDateTime(data.generatedAt)}.`}
      />

      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Average cycle"
            value={formatDays(data.lifecycle.averageCycleDays)}
            detail={`${formatNumber(data.lifecycle.overdueEngagements)} overdue engagements`}
          />
          <MetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Fieldwork duration"
            value={formatDays(data.lifecycle.averageFieldworkDays)}
            detail={`${formatNumber(data.lifecycle.dueSoon)} engagements due soon`}
          />
          <MetricCard
            icon={<FileText className="h-4 w-4" />}
            label="Report issue time"
            value={formatDays(data.reporting.averageDaysToIssue)}
            detail={`${formatNumber(data.reporting.total)} reports generated`}
          />
          <MetricCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="High-risk coverage"
            value={formatPercent(data.riskCoverage.highRiskCoverageRate)}
            detail={`${formatNumber(data.riskCoverage.highRiskAuditedThisYear)} of ${formatNumber(data.riskCoverage.highRiskUniverseItems)} audited this year`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader
              title="Lifecycle Status"
              subtitle="Engagement movement from plan through closure."
            />
            <div className="space-y-4">
              {statusOrder.map((status) => (
                <HorizontalMetric
                  key={status}
                  label={humanizeStatus(status)}
                  value={data.lifecycle.byStatus[status as keyof typeof data.lifecycle.byStatus] ?? 0}
                  max={Math.max(...Object.values(data.lifecycle.byStatus), 1)}
                />
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Review Backlog" subtitle="Items waiting on audit review or management action." />
            <div className="space-y-3">
              <BacklogRow label="Working papers awaiting review" value={data.workingPapers.submittedAwaitingReview} tone="blue" />
              <BacklogRow label="Open findings" value={data.findings.totalOpen} tone="amber" />
              <BacklogRow label="Overdue findings" value={data.findings.overdue} tone="red" />
              <BacklogRow label="Pending follow-up" value={data.followUp.pending} tone="purple" />
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <BreakdownCard title="Findings by Severity" values={data.findings.bySeverity} icon={<AlertTriangle className="h-4 w-4" />} />
          <BreakdownCard title="Working Papers" values={data.workingPapers.byStatus} icon={<CheckCircle2 className="h-4 w-4" />} />
          <BreakdownCard title="Reports" values={data.reporting.byStatus} icon={<BarChart3 className="h-4 w-4" />} />
        </div>
      </section>
    </div>
  );
}

const MetricCard = ({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}): JSX.Element => (
  <Card>
    <div className="flex items-center justify-between">
      <span className="rounded-md bg-primary/10 p-2 text-primary">{icon}</span>
      <Badge tone="gray">KPI</Badge>
    </div>
    <p className="mt-4 text-xs font-medium uppercase tracking-wider text-text-secondary">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
    <p className="mt-2 text-xs text-text-secondary">{detail}</p>
  </Card>
);

const HorizontalMetric = ({ label, value, max }: { label: string; value: number; max: number }): JSX.Element => {
  const width = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">{label}</span>
        <span className="text-text-secondary">{formatNumber(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

const BacklogRow = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'amber' | 'red' | 'purple';
}): JSX.Element => (
  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
    <span className="text-sm text-text-secondary">{label}</span>
    <Badge tone={tone}>{formatNumber(value)}</Badge>
  </div>
);

const BreakdownCard = ({
  title,
  values,
  icon,
}: {
  title: string;
  values: Record<string, number>;
  icon: React.ReactNode;
}): JSX.Element => {
  const entries = Object.entries(values);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2">{icon}{title}</span>} />
      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-text-secondary">No data recorded yet.</p>
        ) : entries.map(([key, value]) => (
          <HorizontalMetric key={key} label={humanizeStatus(key)} value={value} max={max} />
        ))}
      </div>
    </Card>
  );
};

const formatDays = (value: number | null): string =>
  value === null ? 'No data' : `${formatNumber(value)} days`;
