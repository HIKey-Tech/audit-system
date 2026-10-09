'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Download, FileLock2, Fingerprint, Lock, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { ExceptionsPanel } from '@/components/system-audit/ExceptionsPanel';
import { AccessReviewPanel } from '@/components/system-audit/AccessReviewPanel';
import { HeadlineMetrics, SeverityPills, SourceBadge, SummaryTable, summaryLabel } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { systemAuditApi } from '@/lib/api/system-audit';
import { ANALYSIS_META } from '@/lib/system-audit';
import { formatDateTime } from '@/lib/utils/format';

export default function AnalysisRunPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('sysaudit:read');
  const canReview = hasPermission('sysaudit:review');
  const canAdmin = hasPermission('sysaudit:admin');
  const [tab, setTab] = useState<string | null>(null);
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [baselineOpen, setBaselineOpen] = useState(false);

  const run = useQuery({ queryKey: ['system-audit', 'run', id], queryFn: () => systemAuditApi.getRun(id), enabled: Boolean(id) && canRead });

  const signOff = useMutation({
    mutationFn: (note: string) => systemAuditApi.completeReview(id, note),
    onSuccess: () => {
      toast.success('Review signed off');
      setSignOffOpen(false);
      qc.invalidateQueries({ queryKey: ['system-audit'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not sign off'),
  });
  const baseline = useMutation({
    mutationFn: () => systemAuditApi.markBaseline(id),
    onSuccess: () => {
      toast.success('Approved as the configuration baseline for future comparisons');
      setBaselineOpen(false);
      qc.invalidateQueries({ queryKey: ['system-audit'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not set the baseline'),
  });

  const crumbs = [{ label: 'System audit', href: '/system-audit' }, { label: 'Data analytics', href: '/system-audit/analytics' }];

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Analysis" breadcrumbs={crumbs} />
        <Card><EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to system audit analytics" /></Card>
      </div>
    );
  }
  if (run.isError) {
    return (
      <div>
        <PageHeader title="Analysis" breadcrumbs={crumbs} />
        <Card><ErrorState message={run.error instanceof Error ? run.error.message : undefined} error={run.error} onRetry={() => run.refetch()} /></Card>
      </div>
    );
  }
  if (run.isLoading || !run.data) {
    return (
      <div>
        <PageHeader title="Loading…" breadcrumbs={crumbs} />
        <Card><Skeleton className="mb-3 h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></Card>
      </div>
    );
  }

  const r = run.data;
  const meta = ANALYSIS_META[r.analysisType];
  const Icon = meta.icon;
  const isAccess = r.analysisType === 'access_listing';
  const pendingAccounts = r.accessReview?.pending ?? 0;
  const readyToSignOff = r.openExceptions === 0 && pendingAccounts === 0;
  const tabs: TabItem[] = [
    ...(isAccess ? [{ key: 'accounts', label: 'Accounts', count: r.accessReview?.total ?? null }] : []),
    { key: 'exceptions', label: 'Exceptions', count: r.exceptionCount, countTone: r.openExceptions > 0 ? 'danger' as const : 'default' as const },
    { key: 'details', label: 'Summary & parameters' },
  ];
  const activeTab = tab ?? tabs[0].key;

  return (
    <div>
      <PageHeader
        title={r.title}
        subtitle={`${r.reference} · ${meta.label}`}
        breadcrumbs={[...crumbs, { label: r.reference }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {r.hasExtract && (
              <Button variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => systemAuditApi.downloadExtract(r.id).catch((e: Error) => toast.error(e.message))}>
                Original extract
              </Button>
            )}
            {r.analysisType === 'configuration' && canAdmin && !r.isBaseline && (
              <Button variant="secondary" size="sm" leftIcon={<BadgeCheck className="h-3.5 w-3.5" />} onClick={() => setBaselineOpen(true)}>
                Approve as baseline
              </Button>
            )}
            {canReview && r.reviewStatus === 'open' && (
              <Button size="sm" leftIcon={<FileLock2 className="h-3.5 w-3.5" />} disabled={!readyToSignOff} onClick={() => setSignOffOpen(true)}
                title={readyToSignOff ? undefined : 'Disposition every exception and decide every account first'}>
                Sign off review
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padded className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
            <SourceBadge source={r.source} />
            {r.reviewStatus === 'completed'
              ? <Badge tone="green" size="xs" withDot>Signed off</Badge>
              : <Badge tone="amber" size="xs" withDot>{r.openExceptions} open exception(s){isAccess ? `, ${pendingAccounts} account(s) pending` : ''}</Badge>}
            {r.isBaseline && <Badge tone="purple" size="xs">Approved baseline</Badge>}
            <SeverityPills counts={r.severityCounts} />
          </div>
          <HeadlineMetrics type={r.analysisType} summary={r.summary} />
          {r.ruleCounts.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Rules triggered</p>
              <div className="flex flex-wrap gap-1.5">
                {r.ruleCounts.map((rc) => <Badge key={rc.ruleCode} tone="gray" size="xs">{rc.label}: {rc.count}</Badge>)}
              </div>
            </div>
          )}
        </Card>

        <Card padded>
          <CardHeader title="Provenance" subtitle="What was analysed, and by whom" />
          <dl className="space-y-2 text-sm">
            <Prov label="System" value={r.systemName} />
            <Prov label="Records" value={r.recordCount.toLocaleString()} />
            {r.fileName && <Prov label="File" value={r.fileName} />}
            {r.contentSha256 && (
              <Prov label="SHA-256" value={<span className="flex items-start gap-1 break-all font-mono text-[11px]"><Fingerprint className="mt-0.5 h-3 w-3 shrink-0" />{r.contentSha256}</span>} />
            )}
            <Prov label="Run" value={`${r.createdBy?.name ?? 'Continuous monitoring'}, ${formatDateTime(r.createdAt)}`} />
            {r.engagement && <Prov label="Engagement" value={<Link className="text-primary hover:underline" href={`/audit/engagements/${r.engagement.id}`}>{r.engagement.referenceNumber} — {r.engagement.title}</Link>} />}
            {r.securityTest && <Prov label="Security test" value={<Link className="text-primary hover:underline" href={`/system-audit/security-tests/${r.securityTest.id}`}>{r.securityTest.reference} — {r.securityTest.title}</Link>} />}
            {r.baselineRunId && <Prov label="Compared with" value={<Link className="text-primary hover:underline" href={`/system-audit/analytics/${r.baselineRunId}`}>Approved baseline</Link>} />}
            {r.reviewedBy && <Prov label="Signed off" value={`${r.reviewedBy.name}, ${formatDateTime(r.reviewedAt)}`} />}
            {r.reviewNote && <Prov label="Sign-off note" value={r.reviewNote} />}
          </dl>
          {r.controls.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted"><ShieldCheck className="h-3 w-3" />Evidence for controls</p>
              <div className="flex flex-wrap gap-1">{r.controls.map((c) => <Badge key={c} tone="blue" size="xs">{c}</Badge>)}</div>
            </div>
          )}
        </Card>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setTab} className="mb-4" />

      {activeTab === 'accounts' && isAccess && <AccessReviewPanel run={r} canReview={canReview} />}
      {activeTab === 'exceptions' && (
        <ExceptionsPanel run={r} canReview={canReview} canRaiseFinding={canReview && hasPermission('finding:create')} />
      )}
      {activeTab === 'details' && (
        <div className="space-y-4">
          <Card padded>
            <CardHeader title="Full summary" />
            <SummaryTable summary={r.summary} />
          </Card>
          <Card padded>
            <CardHeader title="Parameters used" subtitle="Thresholds and rules this run applied — kept so the result can be reproduced" />
            <dl className="space-y-2">
              {Object.entries(r.parameters).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-3 border-b border-border/60 pb-2 text-sm">
                  <dt className="text-xs text-text-secondary">{summaryLabel(k)}</dt>
                  <dd className="col-span-2"><pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-text-primary">{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre></dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      <ReasonDialog
        open={signOffOpen}
        onClose={() => setSignOffOpen(false)}
        onConfirm={(note) => signOff.mutate(note)}
        title="Sign off this review"
        description="Every exception has a disposition. Signing off locks the review so its results can be relied on as evidence."
        reasonLabel="Sign-off note"
        confirmLabel="Sign off"
        minLength={1}
        isLoading={signOff.isPending}
      />
      <ConfirmDialog
        open={baselineOpen}
        title="Approve as configuration baseline?"
        description={`Future configuration reviews of ${r.systemName} will be compared with this snapshot to detect drift.`}
        confirmLabel="Approve baseline"
        variant="primary"
        isLoading={baseline.isPending}
        onConfirm={() => baseline.mutate()}
        onCancel={() => setBaselineOpen(false)}
      />
    </div>
  );
}

const Prov = ({ label, value }: { label: string; value: React.ReactNode }): JSX.Element => (
  <div className="grid grid-cols-3 gap-2">
    <dt className="text-xs text-text-secondary">{label}</dt>
    <dd className="col-span-2 text-text-primary">{value}</dd>
  </div>
);
