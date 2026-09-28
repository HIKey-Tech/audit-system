'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileSearch, Lock, Plus, Search } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { NewAnalysisSlideOver } from '@/components/system-audit/NewAnalysisSlideOver';
import { SeverityPills, SourceBadge } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { useSearchInput } from '@/lib/hooks/useSearchInput';
import { systemAuditApi, type AnalysisRun, type AnalysisType } from '@/lib/api/system-audit';
import { ANALYSIS_META } from '@/lib/system-audit';
import { formatDateTime } from '@/lib/utils/format';

export default function SystemAuditAnalyticsPage(): JSX.Element {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('sysaudit:read');
  const canRun = hasPermission('sysaudit:run');
  const [open, setOpen] = useState(false);

  const { values, set } = useQueryFilters({ page: '1', type: '', source: '', review: '', search: '' });
  const page = Math.max(1, Number(values.page) || 1);
  const [searchInput, setSearchInput] = useSearchInput(
    values.search,
    useCallback((next: string) => set({ search: next, page: '1' }), [set]),
  );

  const filters = {
    page,
    pageSize: 20,
    analysisType: (values.type || undefined) as AnalysisType | undefined,
    source: (values.source || undefined) as AnalysisRun['source'] | undefined,
    reviewStatus: (values.review || undefined) as 'open' | 'completed' | undefined,
    search: values.search || undefined,
  };
  const runs = useQuery({
    queryKey: ['system-audit', 'runs', filters],
    queryFn: () => systemAuditApi.listRuns(filters),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Data analytics" />
        <Card><EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to system audit analytics" /></Card>
      </div>
    );
  }

  const columns: Column<AnalysisRun>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (r) => <span className="whitespace-nowrap font-mono text-xs text-primary">{r.reference}</span>,
      width: '130px',
    },
    {
      key: 'title',
      header: 'Analysis',
      render: (r) => {
        const Icon = ANALYSIS_META[r.analysisType].icon;
        return (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-text-primary">
              <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="line-clamp-2">{r.title}</span>
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {r.systemName}
              {r.engagement && <> · {r.engagement.referenceNumber}</>}
              {r.trigger === 'scheduled' && <> · continuous monitoring</>}
            </p>
          </div>
        );
      },
    },
    { key: 'source', header: 'Source', render: (r) => <SourceBadge source={r.source} />, width: '140px' },
    { key: 'records', header: 'Records', render: (r) => <span className="tabular-nums">{r.recordCount.toLocaleString()}</span>, width: '90px', align: 'right' },
    { key: 'exceptions', header: 'Exceptions', render: (r) => <SeverityPills counts={r.severityCounts} />, width: '220px' },
    {
      key: 'review',
      header: 'Review',
      render: (r) =>
        r.reviewStatus === 'completed' ? (
          <Badge tone="green" size="xs" withDot>Signed off</Badge>
        ) : r.openExceptions > 0 ? (
          <Badge tone="amber" size="xs" withDot>{r.openExceptions} open</Badge>
        ) : (
          <Badge tone="blue" size="xs" withDot>Ready to sign off</Badge>
        ),
      width: '140px',
    },
    { key: 'created', header: 'Run', render: (r) => <span className="text-xs text-text-secondary">{formatDateTime(r.createdAt)}</span>, width: '150px' },
  ];

  return (
    <div>
      <PageHeader
        title="Data analytics"
        subtitle="Computer-assisted audit tests over system exports and live read-only data."
        breadcrumbs={[{ label: 'System audit', href: '/system-audit' }, { label: 'Data analytics' }]}
        actions={canRun ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>New analysis</Button> : null}
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Search title, system, or reference"
            aria-label="Search analyses"
            leftIcon={<Search className="h-4 w-4" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Select value={values.type} aria-label="Analysis type" onChange={(e) => set({ type: e.target.value, page: '1' })}>
            <option value="">All analyses</option>
            {(Object.keys(ANALYSIS_META) as AnalysisType[]).map((t) => (
              <option key={t} value={t}>{ANALYSIS_META[t].label}</option>
            ))}
          </Select>
          <Select value={values.source} aria-label="Source" onChange={(e) => set({ source: e.target.value, page: '1' })}>
            <option value="">All sources</option>
            <option value="upload">Uploaded exports</option>
            <option value="iams">IAMS (live)</option>
            <option value="entra_id">Entra ID (live)</option>
            <option value="imoc">IMOC (live)</option>
          </Select>
          <Select value={values.review} aria-label="Review status" onChange={(e) => set({ review: e.target.value, page: '1' })}>
            <option value="">Any review status</option>
            <option value="open">Under review</option>
            <option value="completed">Signed off</option>
          </Select>
        </div>
      </Card>

      <Table<AnalysisRun>
        columns={columns}
        data={runs.data?.items}
        rowKey={(r) => r.id}
        isLoading={runs.isLoading}
        isError={runs.isError}
        onRetry={() => runs.refetch()}
        onRowClick={(r) => router.push(`/system-audit/analytics/${r.id}`)}
        emptyState={
          <EmptyState
            icon={<FileSearch className="h-4 w-4" />}
            title="No analyses yet"
            description="Upload a system export — a user listing, change log, backup report, incident log, configuration, or scan — to test it automatically."
            action={canRun ? <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>New analysis</Button> : undefined}
          />
        }
        pagination={
          runs.data
            ? { page: runs.data.meta.page, pageSize: runs.data.meta.pageSize, total: runs.data.meta.total, onPageChange: (p) => set({ page: String(p) }) }
            : undefined
        }
      />

      <NewAnalysisSlideOver
        open={open}
        onClose={() => setOpen(false)}
        initialType={(values.type || undefined) as AnalysisType | undefined}
      />
    </div>
  );
}
