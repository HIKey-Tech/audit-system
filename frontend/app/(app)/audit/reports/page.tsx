'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Table, type Column } from '@/components/ui/Table';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { reportsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import type { AuditReport } from '@/lib/types/domain';

export default function ReportsListPage(): JSX.Element {
  const router = useRouter();

  const query = useQuery({
    queryKey: ['reports', 'all'],
    queryFn: () => reportsApi.list({ pageSize: 100 }),
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
        <span className="font-mono text-xs text-primary">
          {r.engagementReference ?? `${r.engagementId.slice(0, 8)}...`}
        </span>
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
      render: (r) => <Badge tone="gray">v{r.version ?? r.versionNumber ?? 1}</Badge>,
      width: '90px',
    },
    {
      key: 'issued',
      header: 'Issued',
      render: (r) => (
        <span className="text-text-secondary text-xs">
          {r.issuedAt ? formatDate(r.issuedAt) : '-'}
        </span>
      ),
      width: '130px',
    },
  ];

  return (
    <div>
      <PageHeader title="Audit Reports" subtitle="Reports generated and issued from engagements." />

      <Table<AuditReport>
        columns={columns}
        data={query.data?.items ?? []}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(r) => router.push(`/audit/engagements/${r.engagementId}`)}
        emptyState={
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No reports yet"
            description="Generated audit reports will appear here."
          />
        }
      />
    </div>
  );
}
