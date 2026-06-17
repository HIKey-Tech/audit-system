'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, AlertTriangle } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { findingsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import type { AuditFinding } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

export default function FindingsListPage(): JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  const query = useQuery({
    queryKey: ['findings', { search, severity, status, category }],
    queryFn: () =>
      findingsApi.list({
        pageSize: 100,
        search: search || undefined,
        severity: severity || undefined,
        status: status || undefined,
        category: category || undefined,
      }),
  });

  const columns: Column<AuditFinding>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (f) => (
        <span className="font-medium text-text-primary line-clamp-1">{f.title}</span>
      ),
    },
    {
      key: 'engagement',
      header: 'Engagement',
      render: (f) => (
        <Link
          href={`/audit/engagements/${f.engagementId}`}
          className="font-mono text-xs text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {f.engagementReference}
        </Link>
      ),
      width: '140px',
    },
    {
      key: 'category',
      header: 'Category',
      render: (f) => <Badge tone="gray">{humanizeStatus(f.category)}</Badge>,
      width: '160px',
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (f) => <StatusBadge status={f.severity} />,
      width: '120px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (f) => <StatusBadge status={f.status} />,
      width: '140px',
    },
    {
      key: 'auditee',
      header: 'Auditee',
      render: (f) => <span className="text-text-secondary">{f.auditeeName}</span>,
      width: '180px',
    },
    {
      key: 'due',
      header: 'Due Date',
      render: (f) => {
        const overdue = new Date(f.dueDate) < new Date() && !['verified', 'pending_closure', 'closed'].includes(f.status);
        return (
          <span className={cn('text-xs', overdue ? 'font-medium text-danger' : 'text-text-secondary')}>
            {formatDate(f.dueDate)}
          </span>
        );
      },
      width: '130px',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Findings"
        subtitle="Issues raised across all engagements."
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            placeholder="Search findings…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="informational">Informational</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="management_response_received">Response received</option>
            <option value="in_remediation">In remediation</option>
            <option value="verified">Verified</option>
            <option value="closed">Closed</option>
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="it">IT</option>
            <option value="financial">Financial</option>
            <option value="compliance">Compliance</option>
            <option value="systems">Systems</option>
            <option value="operational">Operational</option>
          </Select>
        </div>
      </Card>

      <Table<AuditFinding>
        columns={columns}
        data={query.data?.items ?? []}
        rowKey={(f) => f.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(f) => router.push(`/audit/findings/${f.id}`)}
        emptyState={
          <EmptyState
            icon={<AlertTriangle className="h-4 w-4" />}
            title="No findings"
            description="Findings raised across engagements will appear here."
          />
        }
      />
    </div>
  );
}
