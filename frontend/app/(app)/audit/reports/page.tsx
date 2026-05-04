'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Table, type Column } from '@/components/ui/Table';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { reportsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import type { AuditReport } from '@/lib/types/domain';

const TABS: TabItem[] = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'issued', label: 'Issued' },
];

export default function ReportsListPage(): JSX.Element {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const query = useQuery({
    queryKey: ['reports', { page, status }],
    queryFn: () =>
      reportsApi.list({
        page,
        pageSize: 20,
        status: status || undefined,
      }),
  });

  const columns: Column<AuditReport>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (r) => <span className="font-medium text-text-primary">{r.title}</span>,
    },
    {
      key: 'engagement',
      header: 'Engagement',
      render: (r) => (
        <span className="font-mono text-xs text-primary">{r.engagementId.slice(0, 8)}…</span>
      ),
      width: '140px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
      width: '120px',
    },
    {
      key: 'version',
      header: 'Version',
      render: (r) => <Badge tone="gray">v{r.version}</Badge>,
      width: '90px',
    },
    {
      key: 'issued',
      header: 'Issued',
      render: (r) => (
        <span className="text-text-secondary text-xs">
          {r.issuedAt ? formatDate(r.issuedAt) : '—'}
        </span>
      ),
      width: '130px',
    },
  ];

  return (
    <div>
      <PageHeader title="Audit Reports" subtitle="Reports issued from engagements." />

      <Card padded className="mb-4">
        <Tabs
          tabs={TABS}
          active={status}
          onChange={(k) => {
            setStatus(k);
            setPage(1);
          }}
        />
      </Card>

      <Table<AuditReport>
        columns={columns}
        data={query.data?.items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(r) => router.push(`/audit/engagements/${r.engagementId}`)}
        emptyState={
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No reports yet"
            description="Reports appear here once engagements move to the reporting phase."
          />
        }
        pagination={
          query.data
            ? {
                page: query.data.meta.page,
                pageSize: query.data.meta.pageSize,
                total: query.data.meta.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />
    </div>
  );
}
