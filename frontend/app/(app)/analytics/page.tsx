'use client';

import type React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Briefcase,
  CheckCircle2,
  Clock,
  FileSearch,
  FileText,
  ShieldCheck,
  Inbox,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { dashboardApi } from '@/lib/api/dashboard';
import { formatDateTime, formatNumber } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermissions, type AnalyticsScope } from '@/lib/hooks/usePermissions';

const statusOrder = ['planned', 'in_progress', 'under_review', 'reported', 'closed'];

// Auto-refresh cadence. Kept at 60s (and paused for hidden tabs by react-query's
// default refetchIntervalInBackground=false) so the heavy analytics aggregation
// endpoint is not hammered when many users leave the page open.
const ANALYTICS_REFRESH_MS = 60_000;

export default function AnalyticsPage(): JSX.Element {
  const { analyticsScope } = usePermissions();
  const query = useQuery({
    queryKey: ['dashboard', 'analytics'],
    queryFn: dashboardApi.getAnalytics,
    refetchInterval: ANALYTICS_REFRESH_MS,
    staleTime: ANALYTICS_REFRESH_MS - 5_000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" subtitle="Audit lifecycle, findings, reporting, follow-up, and risk coverage." />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
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
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle={analyticsScope.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ScopeBadge scope={analyticsScope} />
            <LiveIndicator
              generatedAt={data.generatedAt}
              isRefreshing={query.isFetching}
            />
          </div>
        }
      />

      <section className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Activity className="h-5 w-5" />}
            label="Average Cycle"
            value={formatDays(data.lifecycle.averageCycleDays)}
            detail={`${formatNumber(data.lifecycle.overdueEngagements)} overdue engagements`}
            gradient="from-primary/10 to-accent/5"
            borderGlow="group-hover:border-primary/30"
          />
          <MetricCard
            icon={<Clock className="h-5 w-5" />}
            label="Fieldwork Duration"
            value={formatDays(data.lifecycle.averageFieldworkDays)}
            detail={`${formatNumber(data.lifecycle.dueSoon)} engagements due soon`}
            gradient="from-accent/10 to-emerald-500/5"
            borderGlow="group-hover:border-accent/30"
          />
          <MetricCard
            icon={<FileText className="h-5 w-5" />}
            label="Report Issue Time"
            value={formatDays(data.reporting.averageDaysToIssue)}
            detail={`${formatNumber(data.reporting.total)} reports generated`}
            gradient="from-emerald-500/10 to-teal-500/5"
            borderGlow="group-hover:border-emerald-500/30"
          />
          <RadialProgressCard
            title="High-Risk Coverage"
            percent={data.riskCoverage.highRiskCoverageRate}
            subtitle={`${formatNumber(data.riskCoverage.highRiskAuditedThisYear)} of ${formatNumber(data.riskCoverage.highRiskUniverseItems)} items`}
            detail="High-risk audit universe items covered this year"
          />
        </div>

        {/* Lifecycle Pipeline & Backlog */}
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="shadow-card border-border bg-surface-elevated">
            <CardHeader
              title={
                <span className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Engagements by Lifecycle Stage
                </span>
              }
              subtitle="How many engagements currently sit at each stage of the audit lifecycle."
            />
            <div className="mt-2">
              <LifecycleBarChart data={data.lifecycle.byStatus} />
            </div>
          </Card>

          <Card className="shadow-card border-border bg-surface-elevated flex flex-col justify-between">
            <div>
              <CardHeader
                title={
                  <span className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                    <Inbox className="h-5 w-5 text-indigo-500" />
                    Review Backlog
                  </span>
                }
                subtitle="Tasks awaiting oversight or action."
              />
              <div className="space-y-4 mt-4 px-2">
                <BacklogRow
                  label="Working papers awaiting review"
                  value={data.workingPapers.submittedAwaitingReview}
                  tone="blue"
                  iconBg="bg-blue-50"
                  iconText="text-blue-500"
                />
                <BacklogRow
                  label="Open findings to address"
                  value={data.findings.totalOpen}
                  tone="amber"
                  iconBg="bg-amber-50"
                  iconText="text-amber-500"
                />
                <BacklogRow
                  label="Overdue findings needing attention"
                  value={data.findings.overdue}
                  tone="red"
                  iconBg="bg-rose-50"
                  iconText="text-rose-500"
                />
                <BacklogRow
                  label="Pending follow-ups in queue"
                  value={data.followUp.pending}
                  tone="purple"
                  iconBg="bg-purple-50"
                  iconText="text-purple-500"
                />
              </div>
            </div>
            <div className="mt-6 px-2 pb-4 pt-3 border-t border-border text-2xs text-text-secondary text-center font-medium">
              Actions are scoped dynamically based on user assignment permissions.
            </div>
          </Card>
        </div>

        {/* Breakdowns */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-card border-border bg-surface-elevated">
            <CardHeader
              title={
                <span className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Findings by Severity
                </span>
              }
            />
            <DonutChart data={data.findings.bySeverity} />
          </Card>

          <Card className="shadow-card border-border bg-surface-elevated">
            <CardHeader
              title={
                <span className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Working Papers
                </span>
              }
            />
            <DonutChart data={data.workingPapers.byStatus} />
          </Card>

          <Card className="shadow-card border-border bg-surface-elevated">
            <CardHeader
              title={
                <span className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Reports Status
                </span>
              }
            />
            <DonutChart data={data.reporting.byStatus} />
          </Card>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

const SCOPE_META: Record<
  AnalyticsScope['key'],
  { tone: 'green' | 'blue' | 'amber'; icon: React.ReactNode }
> = {
  org: { tone: 'green', icon: <Building2 className="h-3.5 w-3.5" /> },
  engagements: { tone: 'blue', icon: <Briefcase className="h-3.5 w-3.5" /> },
  findings: { tone: 'amber', icon: <FileSearch className="h-3.5 w-3.5" /> },
};

const ScopeBadge = ({ scope }: { scope: AnalyticsScope }): JSX.Element => {
  const meta = SCOPE_META[scope.key];
  return (
    <Tooltip content={scope.description}>
      <span className="inline-flex cursor-help">
        <Badge tone={meta.tone} size="sm" className="gap-1.5 font-semibold">
          {meta.icon}
          {scope.label}
        </Badge>
      </span>
    </Tooltip>
  );
};

const LiveIndicator = ({
  generatedAt,
  isRefreshing,
}: {
  generatedAt: string;
  isRefreshing: boolean;
}): JSX.Element => (
  <Tooltip content={`Auto-refreshes every minute. Last updated ${formatDateTime(generatedAt)}.`}>
    <span className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-2xs font-semibold text-text-secondary">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span
          className={`absolute inline-flex h-full w-full rounded-full bg-emerald-500 ${
            isRefreshing ? 'animate-ping opacity-75' : 'opacity-0'
          }`}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {isRefreshing ? 'Updating…' : 'Live'}
    </span>
  </Tooltip>
);

const MetricCard = ({
  icon,
  label,
  value,
  detail,
  gradient,
  borderGlow,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  gradient: string;
  borderGlow: string;
}): JSX.Element => (
  <Card className={`group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] border border-border ${borderGlow} bg-surface-elevated shadow-card`}>
    <div className={`absolute top-0 right-0 h-24 w-24 bg-gradient-to-br ${gradient} rounded-bl-full pointer-events-none transition-all duration-500 group-hover:scale-110`} />
    <div className="flex items-center justify-between">
      <span className="rounded-xl bg-primary/10 p-2.5 text-primary shadow-sm ring-1 ring-primary/5 transition-transform duration-300 group-hover:rotate-6">{icon}</span>
      <Badge tone="gray" className="font-semibold text-2xs tracking-wide uppercase px-2 py-0.5">KPI</Badge>
    </div>
    <p className="mt-4 text-2xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
    <p className="mt-1 text-2xl font-bold text-text-primary tracking-tight">{value}</p>
    <div className="mt-3 pt-2.5 border-t border-border text-3xs text-text-secondary font-medium">
      {detail}
    </div>
  </Card>
);

const RadialProgressCard = ({
  title,
  percent,
  subtitle,
  detail,
}: {
  title: string;
  percent: number;
  subtitle: string;
  detail: string;
}): JSX.Element => {
  const radius = 32;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] border border-border hover:border-emerald-500/30 bg-surface-elevated shadow-card">
      <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none transition-all duration-500 group-hover:scale-110" />
      <div className="flex items-start justify-between">
        <div>
          <span className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 shadow-sm ring-1 ring-emerald-500/5 inline-block mb-3">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h4 className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{title}</h4>
          <p className="mt-0.5 text-2xl font-bold text-text-primary tracking-tight">{percent.toFixed(1)}%</p>
          <p className="mt-1 text-2xs text-text-secondary font-medium">{subtitle}</p>
        </div>
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="fill-none stroke-border"
              strokeWidth={strokeWidth}
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="fill-none stroke-emerald-500 transition-all duration-1000 ease-out"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-600">
            {percent.toFixed(0)}%
          </div>
        </div>
      </div>
      <div className="mt-3 pt-2.5 border-t border-border text-3xs text-text-secondary font-medium">
        {detail}
      </div>
    </Card>
  );
};

const BacklogRow = ({
  label,
  value,
  tone,
  iconBg,
  iconText,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'amber' | 'red' | 'purple';
  iconBg: string;
  iconText: string;
}): JSX.Element => (
  <div className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-surface-hover transition-all duration-200 shadow-sm">
    <div className="flex items-center gap-3">
      <span className={`h-8 w-8 rounded-lg ${iconBg} ${iconText} flex items-center justify-center font-bold text-xs ring-1 ring-black/5`}>
        {value}
      </span>
      <span className="text-xs text-text-secondary font-medium">{label}</span>
    </div>
    <Badge tone={tone} className="font-semibold px-2.5 py-0.5 rounded-full text-2xs">
      {formatNumber(value)}
    </Badge>
  </div>
);

const DonutChart = ({ data }: { data: Record<string, number> }): JSX.Element => {
  const entries = Object.entries(data).filter(([, val]) => val > 0);
  const total = entries.reduce((sum, [, val]) => sum + val, 0);

  if (total === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-text-secondary italic">
        No records found.
      </div>
    );
  }

  let accumulatedPercent = 0;
  const radius = 38;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;

  // Harmonized styling Map
  const colorMap: Record<string, { stroke: string; text: string; bg: string }> = {
    // Severity
    critical: { stroke: 'stroke-red-500', text: 'text-red-600', bg: 'bg-red-500' },
    high: { stroke: 'stroke-orange-500', text: 'text-orange-600', bg: 'bg-orange-500' },
    medium: { stroke: 'stroke-amber-400', text: 'text-amber-600', bg: 'bg-amber-400' },
    low: { stroke: 'stroke-blue-500', text: 'text-blue-600', bg: 'bg-blue-500' },
    informational: { stroke: 'stroke-slate-400', text: 'text-slate-600', bg: 'bg-slate-400' },
    // Working papers
    draft: { stroke: 'stroke-slate-400', text: 'text-slate-600', bg: 'bg-slate-400' },
    submitted: { stroke: 'stroke-indigo-500', text: 'text-indigo-600', bg: 'bg-indigo-500' },
    approved: { stroke: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-500' },
    rejected: { stroke: 'stroke-rose-500', text: 'text-rose-600', bg: 'bg-rose-500' },
    // Reports
    draft_report: { stroke: 'stroke-slate-400', text: 'text-slate-600', bg: 'bg-slate-400' },
    under_review: { stroke: 'stroke-amber-500', text: 'text-amber-600', bg: 'bg-amber-500' },
    approved_report: { stroke: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-500' },
    issued: { stroke: 'stroke-teal-500', text: 'text-teal-600', bg: 'bg-teal-500' },
  };

  const getColors = (key: string, index: number) => {
    const normKey = key.toLowerCase().replace(/\s+/g, '_');
    if (colorMap[normKey]) return colorMap[normKey];

    const cycle = [
      { stroke: 'stroke-blue-500', text: 'text-blue-500', bg: 'bg-blue-500' },
      { stroke: 'stroke-indigo-500', text: 'text-indigo-500', bg: 'bg-indigo-500' },
      { stroke: 'stroke-violet-500', text: 'text-violet-500', bg: 'bg-violet-500' },
      { stroke: 'stroke-teal-500', text: 'text-teal-500', bg: 'bg-teal-500' },
    ];
    return cycle[index % cycle.length];
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 h-full">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="fill-none stroke-border"
            strokeWidth={strokeWidth}
          />
          {entries.map(([key, val], idx) => {
            const percent = val / total;
            const strokeDashoffset = circumference - percent * circumference;
            const rotationOffset = accumulatedPercent * 360;
            accumulatedPercent += percent;

            const styles = getColors(key, idx);

            return (
              <circle
                key={key}
                cx="50"
                cy="50"
                r={radius}
                className={`fill-none transition-all duration-300 hover:stroke-[11px] cursor-pointer ${styles.stroke}`}
                strokeWidth={strokeWidth}
                strokeDasharray={`${percent * circumference} ${circumference}`}
                strokeDashoffset={0}
                style={{
                  transformOrigin: 'center',
                  transform: `rotate(${rotationOffset}deg)`,
                }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold text-text-primary tracking-tight">{total}</span>
          <span className="text-3xs text-text-secondary uppercase tracking-widest font-semibold scale-90">Total</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full max-h-48 overflow-y-auto pr-1">
        {entries.map(([key, val], idx) => {
          const percent = (val / total) * 100;
          const styles = getColors(key, idx);
          return (
            <div key={key} className="flex items-center justify-between text-xs py-0.5 border-b border-dashed border-border last:border-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${styles.bg}`} />
                <span className="font-semibold text-text-primary capitalize">{key.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span className="text-text-primary font-bold">{val}</span>
                <span className="text-3xs text-text-muted">({percent.toFixed(0)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Distinct colour per lifecycle stage — a vertical bar chart for comparing
// category counts (the data is categorical, not a time series, so a line/area
// chart misrepresented it).
const LIFECYCLE_BAR_COLORS: Record<string, string> = {
  planned: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  under_review: 'bg-amber-500',
  reported: 'bg-violet-500',
  closed: 'bg-emerald-500',
};

const LifecycleBarChart = ({ data }: { data: Record<string, number> }): JSX.Element => {
  const bars = statusOrder.map((status) => ({
    status,
    label: humanizeStatus(status),
    value: data[status] ?? 0,
  }));
  const maxVal = Math.max(...bars.map((bar) => bar.value), 1);
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-surface-alt text-sm italic text-text-secondary">
        No engagements found.
      </div>
    );
  }

  const CHART_H = 200; // px — total bar area
  const BAR_AREA = CHART_H - 28; // reserve room for the value label above each bar
  const ariaLabel = `Engagements by lifecycle stage. ${bars
    .map((bar) => `${bar.label}: ${bar.value}`)
    .join(', ')}.`;

  return (
    <div className="rounded-xl border border-border bg-surface-alt p-4">
      <div role="img" aria-label={ariaLabel}>
        <div className="flex items-end gap-3 sm:gap-5" style={{ height: CHART_H }}>
          {bars.map((bar) => {
            const barHeight = bar.value > 0
              ? Math.max(Math.round((bar.value / maxVal) * BAR_AREA), 6)
              : 0;
            return (
              <div key={bar.status} className="flex flex-1 flex-col items-center justify-end">
                <span className="mb-1 text-sm font-bold text-text-primary">{bar.value}</span>
                <div
                  title={`${bar.label}: ${bar.value}`}
                  style={{ height: barHeight }}
                  className={`mx-auto w-full max-w-[72px] rounded-t-md ${LIFECYCLE_BAR_COLORS[bar.status] ?? 'bg-primary'} shadow-sm transition-[height] duration-700 ease-out motion-reduce:transition-none`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-3 border-t border-border pt-2 sm:gap-5">
          {bars.map((bar) => (
            <span
              key={bar.status}
              className="flex-1 text-center text-3xs font-semibold uppercase tracking-wide text-text-muted"
            >
              {bar.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const formatDays = (value: number | null): string =>
  value === null ? 'No data' : `${formatNumber(value)} days`;
