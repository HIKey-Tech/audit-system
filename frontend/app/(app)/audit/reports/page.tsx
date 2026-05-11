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
import { Select } from '@/components/ui/Input';
import { reportsApi, engagementsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import type { AuditReport } from '@/lib/types/domain';

export default function ReportsListPage(): JSX.Element {
  const router = useRouter();
  const [engagementId, setEngagementId] = useState('');

  /* Fetch engagements for the selector */
  const engagements = useQuery({
    queryKey: ['engagements', 'all'],
    queryFn: () => engagementsApi.list({ pageSize: 100 }),
  });

  /* Fix 5/6: no GET /audit/reports — use GET /audit/engagements/:id/report */
  const query = useQuery({
    queryKey: ['reports', { engagementId }],
    queryFn: () => reportsApi.getByEngagement(engagementId),
    enabled: Boolean(engagementId),
  });

  const report = query.data;
  const reports: AuditReport[] = report ? [report] : [];

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
        <Select value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
          <option value="">Select engagement…</option>
          {engagements.data?.items.map((eng) => (
            <option key={eng.id} value={eng.id}>
              {eng.referenceNumber} — {eng.title}
            </option>
          ))}
        </Select>
      </Card>

      {!engagementId ? (
        <Card padded>
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="Select an engagement"
            description="Choose an engagement above to view its report."
          />
        </Card>
      ) : (
        <Table<AuditReport>
          columns={columns}
          data={reports}
          rowKey={(r) => r.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
          onRowClick={(r) => router.push(`/audit/engagements/${r.engagementId}`)}
          emptyState={
            <EmptyState
              icon={<FileText className="h-4 w-4" />}
              title="No report yet"
              description="This engagement does not have a report yet."
            />
          }
        />
      )}
    </div>
  );
}
