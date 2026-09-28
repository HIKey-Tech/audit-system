'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, Clock, Gauge, Lock, PlugZap, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { HeadlineMetrics, SeverityPills, StatTile } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { systemAuditApi, type AnalysisType } from '@/lib/api/system-audit';
import { ANALYSIS_META } from '@/lib/system-audit';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/utils/format';
import { riskScoreTone } from '@/lib/utils/status';

// Uploaded analyses whose latest result describes the current posture.
const POSTURE_TYPES: AnalysisType[] = ['backup_log', 'incident_log', 'vulnerability_scan', 'change_log', 'configuration', 'data_integrity'];

export default function ContinuousMonitoringPage(): JSX.Element {
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('sysaudit:read');
  const canAdmin = hasPermission('sysaudit:admin');

  const dashboard = useQuery({
    queryKey: ['system-audit', 'monitoring'],
    queryFn: () => systemAuditApi.monitoringDashboard(),
    enabled: canRead,
  });

  const runNow = useMutation({
    mutationFn: () => systemAuditApi.runMonitoringNow(),
    onSuccess: (result) => {
      const issues = result.ran.reduce((n, r) => n + r.exceptions, 0);
      toast.success(`${result.ran.length} check(s) ran — ${issues} exception(s). ${result.skipped.length} skipped.`);
      result.failed.forEach((f) => toast.error(`${f.check}: ${f.error}`));
      qc.invalidateQueries({ queryKey: ['system-audit'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Monitoring run failed'),
  });

  const crumbs = [{ label: 'System audit', href: '/system-audit' }, { label: 'Continuous monitoring' }];
  if (!canRead) {
    return (
      <div>
        <PageHeader title="Continuous monitoring" breadcrumbs={crumbs} />
        <Card><EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to continuous monitoring" /></Card>
      </div>
    );
  }
  if (dashboard.isError) {
    return (
      <div>
        <PageHeader title="Continuous monitoring" breadcrumbs={crumbs} />
        <Card><ErrorState onRetry={() => dashboard.refetch()} /></Card>
      </div>
    );
  }
  if (!dashboard.data) {
    return (
      <div>
        <PageHeader title="Continuous monitoring" breadcrumbs={crumbs} />
        <Card><Skeleton className="mb-3 h-4 w-1/3" /><Skeleton className="h-24 w-full" /></Card>
      </div>
    );
  }

  const d = dashboard.data;
  const openTotal = d.openExceptions.critical + d.openExceptions.high + d.openExceptions.medium + d.openExceptions.low;
  const maxTrend = Math.max(1, ...d.exceptionTrend.map((t) => t.criticalHigh + t.mediumLow));

  return (
    <div>
      <PageHeader
        title="Continuous monitoring"
        subtitle={`Automated, read-only checks run daily at 06:30${d.config.enabled ? '' : ' (currently switched off)'}. Serious new exceptions notify system-audit administrators.`}
        breadcrumbs={crumbs}
        actions={canAdmin ? (
          <Button leftIcon={<RefreshCw className="h-4 w-4" />} isLoading={runNow.isPending} onClick={() => runNow.mutate()}>Run checks now</Button>
        ) : null}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open exceptions (latest checks)" value={formatNumber(openTotal)} tone={d.openExceptions.critical + d.openExceptions.high > 0 ? 'bad' : openTotal > 0 ? 'warn' : 'good'} hint={<SeverityPills counts={d.openExceptions} />} />
        <StatTile label="Failed sign-ins (7 days)" value={d.security ? formatNumber(d.security.loginFailed) : '—'} tone={(d.security?.loginFailed ?? 0) > 0 ? 'warn' : 'neutral'} hint={d.security ? `${d.security.accessDenied} access denied` : 'Needs log access'} />
        <StatTile label="System exceptions (7 days)" value={d.systemExceptions ? formatNumber(d.systemExceptions.total) : '—'} tone={(d.systemExceptions?.total ?? 0) > 0 ? 'warn' : 'neutral'} hint={<Link href="/system-audit/events?tab=exceptions" className="text-primary hover:underline">View exceptions</Link>} />
        <StatTile label="Emerging risks (90 days)" value={formatNumber(d.emergingRisks.length)} tone={d.emergingRisks.length > 0 ? 'warn' : 'neutral'} hint="New or rising risk scores" />
      </div>

      <Card padded className="mb-4">
        <CardHeader title="Automated checks" subtitle="Each check re-runs a read-only analysis on live data" />
        <div className="divide-y divide-border">
          {d.checks.map((c) => {
            const Icon = ANALYSIS_META[c.analysisType].icon;
            return (
              <div key={c.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">{c.label}</p>
                    <p className="text-xs text-text-secondary">{c.description}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-[420px] sm:justify-end">
                  {!c.connected ? (
                    <Badge tone="gray" size="xs"><PlugZap className="mr-1 inline h-3 w-3" />{c.connectionNote ?? 'Not connected'}</Badge>
                  ) : !c.enabled ? (
                    <Badge tone="gray" size="xs">Switched off</Badge>
                  ) : c.lastRun ? (
                    <>
                      <SeverityPills counts={c.lastRun.severityCounts} />
                      <Link href={`/system-audit/analytics/${c.lastRun.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        {c.lastRun.reference} <ArrowUpRight className="h-3 w-3" />
                      </Link>
                      <span className="flex items-center gap-1 text-xs text-text-muted"><Clock className="h-3 w-3" />{formatRelative(c.lastRun.createdAt)}</span>
                    </>
                  ) : (
                    <Badge tone="amber" size="xs">Not run yet</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padded className="lg:col-span-2">
          <CardHeader title="New exceptions — last 30 days" subtitle="Across every analysis and check" />
          <div className="flex h-36 items-end gap-[3px]">
            {d.exceptionTrend.map((t) => {
              const total = t.criticalHigh + t.mediumLow;
              return (
                <div key={t.date} className="flex h-full flex-1 flex-col justify-end" title={`${t.date}: ${t.criticalHigh} critical/high, ${t.mediumLow} medium/low`}>
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(total / maxTrend) * 100}%`, minHeight: total ? 2 : 0 }}>
                    <div className="bg-red-500" style={{ height: total ? `${(t.criticalHigh / total) * 100}%` : 0 }} />
                    <div className="bg-amber-400" style={{ height: total ? `${(t.mediumLow / total) * 100}%` : 0 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-text-muted">
            <span>{d.exceptionTrend[0]?.date}</span>
            <span className="flex gap-3">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" />Critical / high</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" />Medium / low</span>
            </span>
            <span>{d.exceptionTrend[d.exceptionTrend.length - 1]?.date}</span>
          </div>
        </Card>

        <Card padded>
          <CardHeader title="Emerging IT risks" subtitle="New or rising in the last 90 days" action={<Link href="/risk" className="text-xs font-medium text-primary hover:underline">Risk register</Link>} />
          {d.emergingRisks.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-text-secondary"><CheckCircle2 className="h-4 w-4 text-emerald-600" />No new or rising risks.</p>
          ) : (
            <ul className="space-y-2">
              {d.emergingRisks.map((r) => {
                const tone = riskScoreTone(r.currentScore);
                return (
                  <li key={r.riskId}>
                    <Link href={`/risk/${r.riskId}`} className="flex items-start justify-between gap-2 rounded-md p-1.5 hover:bg-surface-alt">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">{r.title}</p>
                        <p className="text-xs text-text-secondary">{r.categoryName ?? 'Uncategorised'} · {r.trend === 'new' ? 'new' : `up from ${r.previousScore}`}</p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold ${tone.bg} ${tone.text}`}>
                        {r.trend === 'rising' && <TrendingUp className="h-3 w-3" />}{r.currentScore}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card padded>
        <CardHeader title="Latest control posture" subtitle="Most recent analysis of each kind — upload a new export to refresh" action={<Link href="/system-audit/analytics" className="text-xs font-medium text-primary hover:underline">All analyses</Link>} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {POSTURE_TYPES.map((type) => {
            const run = d.latestByType[type];
            const meta = ANALYSIS_META[type];
            const Icon = meta.icon;
            return (
              <div key={type} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-text-primary"><Icon className="h-4 w-4 text-text-muted" />{meta.label}</p>
                  {run ? (
                    <Link href={`/system-audit/analytics/${run.id}`} className="text-xs text-primary hover:underline">{run.systemName} · {formatDateTime(run.createdAt)}</Link>
                  ) : (
                    <Link href={`/system-audit/analytics?type=${type}`} className="text-xs text-text-muted hover:text-primary">Not analysed yet</Link>
                  )}
                </div>
                {run ? <HeadlineMetrics type={type} summary={run.summary} compact /> : <Gauge className="h-5 w-5 text-text-muted" />}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
