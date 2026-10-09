'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, Database, KeyRound, Lock, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { NewAnalysisSlideOver } from '@/components/system-audit/NewAnalysisSlideOver';
import { SeverityPills, SourceBadge } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { systemAuditApi, type AnalysisRun, type LiveSource } from '@/lib/api/system-audit';
import { formatDateTime } from '@/lib/utils/format';

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);

export default function AccessReviewsPage(): JSX.Element {
  const router = useRouter();
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('sysaudit:read');
  const canRun = hasPermission('sysaudit:run');
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);

  const runs = useQuery({
    queryKey: ['system-audit', 'runs', 'access', page],
    queryFn: () => systemAuditApi.listRuns({ analysisType: 'access_listing', page, pageSize: 20 }),
    enabled: canRead,
  });

  const live = useMutation({
    mutationFn: (source: LiveSource) => systemAuditApi.runLive({ analysisType: 'access_listing', source }),
    onSuccess: (run) => {
      toast.success(`${run.reference}: ${run.recordCount} accounts reviewed, ${run.exceptionCount} exception(s)`);
      qc.invalidateQueries({ queryKey: ['system-audit'] });
      router.push(`/system-audit/analytics/${run.id}?from=access-reviews`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'The access review could not run'),
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Access reviews" />
        <Card><EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to access reviews" /></Card>
      </div>
    );
  }

  const columns: Column<AnalysisRun>[] = [
    { key: 'ref', header: 'Reference', render: (r) => <span className="whitespace-nowrap font-mono text-xs text-primary">{r.reference}</span>, width: '130px' },
    {
      key: 'system',
      header: 'System',
      render: (r) => (
        <div>
          <p className="font-medium text-text-primary">{r.systemName}</p>
          <p className="text-xs text-text-secondary">{r.engagement ? r.engagement.referenceNumber : 'Organisation-wide'}{r.trigger === 'scheduled' ? ' · continuous monitoring' : ''}</p>
        </div>
      ),
    },
    { key: 'source', header: 'Source', render: (r) => <SourceBadge source={r.source} />, width: '140px' },
    { key: 'accounts', header: 'Accounts', render: (r) => <span className="tabular-nums">{num(r.summary.totalAccounts)}</span>, width: '90px', align: 'right' },
    {
      key: 'key',
      header: 'Key issues',
      render: (r) => (
        <div className="flex flex-wrap gap-1 text-xs">
          {num(r.summary.sodConflicts) > 0 && <Badge tone="red" size="xs">{num(r.summary.sodConflicts)} SoD</Badge>}
          {num(r.summary.terminatedWithAccess) > 0 && <Badge tone="red" size="xs">{num(r.summary.terminatedWithAccess)} leavers</Badge>}
          {num(r.summary.dormantAccounts) > 0 && <Badge tone="orange" size="xs">{num(r.summary.dormantAccounts)} dormant</Badge>}
          {num(r.summary.withoutMfa) > 0 && <Badge tone="yellow" size="xs">{num(r.summary.withoutMfa)} no MFA</Badge>}
          {r.exceptionCount === 0 && <span className="text-text-muted">None</span>}
        </div>
      ),
      width: '240px',
    },
    { key: 'sev', header: 'Exceptions', render: (r) => <SeverityPills counts={r.severityCounts} />, width: '200px' },
    {
      key: 'review',
      header: 'Review',
      render: (r) => (r.reviewStatus === 'completed' ? <Badge tone="green" size="xs" withDot>Signed off</Badge> : <Badge tone="amber" size="xs" withDot>In review</Badge>),
      width: '110px',
    },
    { key: 'when', header: 'Run', render: (r) => <span className="text-xs text-text-secondary">{formatDateTime(r.createdAt)}</span>, width: '150px' },
  ];

  return (
    <div>
      <PageHeader
        title="Access reviews"
        subtitle="Verify who has access to each system, and that no one holds conflicting duties — without changing anything in the system."
        breadcrumbs={[{ label: 'System audit', href: '/system-audit' }, { label: 'Access reviews' }]}
      />

      {canRun && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <StartCard
            icon={<Database className="h-5 w-5" />}
            title="IAMS accounts"
            body="Every IAMS user's roles and permissions: conflicting duties, privileged and dormant accounts, sign-in without MFA."
            action={<Button size="sm" isLoading={live.isPending && live.variables === 'iams'} onClick={() => live.mutate('iams')}>Run now</Button>}
          />
          <StartCard
            icon={<Cloud className="h-5 w-5" />}
            title="Entra ID (Active Directory)"
            body="Directory accounts and group memberships, cross-checked against the IAMS staff record. Needs directory sync enabled."
            action={<Button size="sm" variant="secondary" isLoading={live.isPending && live.variables === 'entra_id'} onClick={() => live.mutate('entra_id')}>Run now</Button>}
          />
          <StartCard
            icon={<Upload className="h-5 w-5" />}
            title="Any other system"
            body="Upload a user / role listing exported from Dynafin, a database, firewall, or application. Leavers are found against the staff record."
            action={<Button size="sm" variant="secondary" onClick={() => setUploadOpen(true)}>Upload listing</Button>}
          />
        </div>
      )}

      <Table<AnalysisRun>
        columns={columns}
        data={runs.data?.items}
        rowKey={(r) => r.id}
        isLoading={runs.isLoading}
        isError={runs.isError}
        onRetry={() => runs.refetch()}
        onRowClick={(r) => router.push(`/system-audit/analytics/${r.id}?from=access-reviews`)}
        emptyState={<EmptyState icon={<KeyRound className="h-4 w-4" />} title="No access reviews yet" description="Start one above." />}
        pagination={runs.data ? { page: runs.data.meta.page, pageSize: runs.data.meta.pageSize, total: runs.data.meta.total, onPageChange: setPage } : undefined}
      />

      <NewAnalysisSlideOver open={uploadOpen} onClose={() => setUploadOpen(false)} initialType="access_listing" lockType />
    </div>
  );
}

const StartCard = ({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }): JSX.Element => (
  <Card padded className="flex flex-col">
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <p className="font-semibold text-text-primary">{title}</p>
    </div>
    <p className="mt-2 flex-1 text-sm text-text-secondary">{body}</p>
    <div className="mt-3">{action}</div>
  </Card>
);
