'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { useSearchInput } from '@/lib/hooks/useSearchInput';
import { formatDate } from '@/lib/utils/format';
import type { AuditFinding } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';
import { auditTypeLabel } from '@/lib/audit-domains';

export default function FindingsListPage(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Deep-link scope: e.g. the audit-universe "open findings" count links here
  // with ?universeId=… so the register opens pre-filtered to that entity.
  const universeId = searchParams?.get('universeId') ?? undefined;

  const { values, set } = useQueryFilters({
    page: '1',
    search: '',
    severity: '',
    status: '',
    category: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const page = Math.max(1, Number(values.page) || 1);

  const [searchInput, setSearchInput] = useSearchInput(
    values.search,
    useCallback((next: string) => set({ search: next, page: '1' }), [set]),
  );

  const queryFilters = {
    page,
    pageSize: 20,
    search: values.search || undefined,
    severity: values.severity || undefined,
    status: values.status || undefined,
    category: values.category || undefined,
    sortBy: values.sortBy,
    sortOrder: values.sortOrder as 'asc' | 'desc',
    universeId,
  };

  const query = useQuery({
    queryKey: ['findings', queryFilters],
    queryFn: () => findingsApi.list(queryFilters),
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
      render: (f) => <Badge tone="gray">{auditTypeLabel(f.category, 'short')}</Badge>,
      width: '160px',
    },
    {
      // Keys of sortable columns are the backend sort field names.
      key: 'severity',
      header: 'Severity',
      sortable: true,
      render: (f) => <StatusBadge status={f.severity} />,
      width: '120px',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
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
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
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
            aria-label="Search findings"
            leftIcon={<Search className="h-4 w-4" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Select
            value={values.severity}
            aria-label="Filter by severity"
            onChange={(e) => set({ severity: e.target.value, page: '1' })}
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="informational">Informational</option>
          </Select>
          <Select
            value={values.status}
            aria-label="Filter by status"
            onChange={(e) => set({ status: e.target.value, page: '1' })}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="management_response_received">Response received</option>
            <option value="in_remediation">In remediation</option>
            <option value="verified">Verified</option>
            <option value="closed">Closed</option>
          </Select>
          <Select
            value={values.category}
            aria-label="Filter by category"
            onChange={(e) => set({ category: e.target.value, page: '1' })}
          >
            <option value="">All categories</option>
            <option value="it">System/IT</option>
            <option value="financial">Financial</option>
            <option value="compliance">Compliance</option>
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
        sortBy={values.sortBy}
        sortOrder={values.sortOrder as 'asc' | 'desc'}
        onSortChange={(key, order) => set({ sortBy: key, sortOrder: order, page: '1' })}
        emptyState={
          <EmptyState
            icon={<AlertTriangle className="h-4 w-4" />}
            title="No findings"
            description="Findings raised across engagements will appear here."
          />
        }
        pagination={
          query.data
            ? {
                page: query.data.meta.page,
                pageSize: query.data.meta.pageSize,
                total: query.data.meta.total,
                onPageChange: (p) => set({ page: String(p) }),
              }
            : undefined
        }
      />
    </div>
  );
}
