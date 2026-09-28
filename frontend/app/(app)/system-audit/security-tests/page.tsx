'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bug, Lock, Plus } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { SecurityTestFormSlideOver } from '@/components/system-audit/SecurityTestFormSlideOver';
import { SeverityPills } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { systemAuditApi, type SecurityTest, type SecurityTestStatus, type SecurityTestType } from '@/lib/api/system-audit';
import { SECURITY_TEST_STATUS_LABELS, SECURITY_TEST_TYPE_LABELS } from '@/lib/system-audit';
import { formatDate } from '@/lib/utils/format';

export default function SecurityTestsPage(): JSX.Element {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('sectest:read');
  const canManage = hasPermission('sectest:manage');
  const [open, setOpen] = useState(false);
  const { values, set } = useQueryFilters({ page: '1', status: '', type: '' });
  const page = Math.max(1, Number(values.page) || 1);

  const tests = useQuery({
    queryKey: ['system-audit', 'security-tests', values],
    queryFn: () =>
      systemAuditApi.listSecurityTests({
        page,
        pageSize: 20,
        status: (values.status || undefined) as SecurityTestStatus | undefined,
        testType: (values.type || undefined) as SecurityTestType | undefined,
      }),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Security testing" />
        <Card><EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to security testing" /></Card>
      </div>
    );
  }

  const columns: Column<SecurityTest>[] = [
    { key: 'ref', header: 'Reference', render: (t) => <span className="whitespace-nowrap font-mono text-xs text-primary">{t.reference}</span>, width: '130px' },
    {
      key: 'title',
      header: 'Test',
      render: (t) => (
        <div>
          <p className="font-medium text-text-primary">{t.title}</p>
          <p className="text-xs text-text-secondary">{SECURITY_TEST_TYPE_LABELS[t.testType]} · {t.provider}{t.providerType === 'external' ? ' (external)' : ''}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (t) => <Badge status={t.status} size="xs" withDot>{SECURITY_TEST_STATUS_LABELS[t.status]}</Badge>, width: '140px' },
    { key: 'window', header: 'Window', render: (t) => <span className="text-xs text-text-secondary">{formatDate(t.plannedStart)} – {formatDate(t.plannedEnd)}</span>, width: '190px' },
    { key: 'auth', header: 'Authorised by', render: (t) => <span className="text-xs text-text-secondary">{t.authorisedBy?.name ?? '—'}</span>, width: '150px' },
    {
      key: 'results',
      header: 'Results',
      render: (t) => (t.results.latestScan ? <SeverityPills counts={t.results.latestScan} /> : <span className="text-xs text-text-muted">No results yet</span>),
      width: '220px',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Security testing"
        subtitle="Coordinate vulnerability assessments and penetration tests — scope, written authorisation, report, and remediation."
        breadcrumbs={[{ label: 'System audit', href: '/system-audit' }, { label: 'Security testing' }]}
        actions={canManage ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Plan test</Button> : null}
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select value={values.status} aria-label="Status" onChange={(e) => set({ status: e.target.value, page: '1' })}>
            <option value="">All statuses</option>
            {Object.entries(SECURITY_TEST_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={values.type} aria-label="Test type" onChange={(e) => set({ type: e.target.value, page: '1' })}>
            <option value="">All test types</option>
            {Object.entries(SECURITY_TEST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
      </Card>

      <Table<SecurityTest>
        columns={columns}
        data={tests.data?.items}
        rowKey={(t) => t.id}
        isLoading={tests.isLoading}
        isError={tests.isError}
        onRetry={() => tests.refetch()}
        onRowClick={(t) => router.push(`/system-audit/security-tests/${t.id}`)}
        emptyState={
          <EmptyState
            icon={<Bug className="h-4 w-4" />}
            title="No security tests planned"
            description="Plan a vulnerability assessment or penetration test, get it authorised, then import the results."
            action={canManage ? <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>Plan test</Button> : undefined}
          />
        }
        pagination={tests.data ? { page: tests.data.meta.page, pageSize: tests.data.meta.pageSize, total: tests.data.meta.total, onPageChange: (p) => set({ page: String(p) }) } : undefined}
      />

      <SecurityTestFormSlideOver open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
