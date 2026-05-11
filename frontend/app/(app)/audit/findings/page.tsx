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
import { findingsApi, engagementsApi } from '@/lib/api/audit';
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
  const [engagementId, setEngagementId] = useState('');

  /* Fetch engagements for the selector */
  const engagements = useQuery({
    queryKey: ['engagements', 'all'],
    queryFn: () => engagementsApi.list({ pageSize: 100 }),
  });

  /* Fix 2: findingsApi.list now requires an engagementId */
  const query = useQuery({
    queryKey: ['findings', { engagementId, search, severity, status, category }],
    queryFn: () =>
      findingsApi.list(engagementId, {
        search: search || undefined,
        severity: severity || undefined,
        status: status || undefined,
        category: category || undefined,
      }),
    enabled: Boolean(engagementId),
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
        const overdue = new Date(f.dueDate) < new Date() && !['verified', 'closed'].includes(f.status);
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <Select value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
            <option value="">Select engagement…</option>
            {engagements.data?.items.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.referenceNumber} — {eng.title}
              </option>
            ))}
          </Select>
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
            <option value="control_deficiency">Control deficiency</option>
            <option value="compliance_breach">Compliance breach</option>
            <option value="operational_risk">Operational risk</option>
            <option value="security_risk">Security risk</option>
            <option value="financial_misstatement">Financial misstatement</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </Card>

      {!engagementId ? (
        <Card padded>
          <EmptyState
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Select an engagement"
            description="Choose an engagement above to view its findings."
          />
        </Card>
      ) : (
        <Table<AuditFinding>
          columns={columns}
          data={query.data ?? []}
          rowKey={(f) => f.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
          onRowClick={(f) => router.push(`/audit/findings/${f.id}`)}
          emptyState={
            <EmptyState
              icon={<AlertTriangle className="h-4 w-4" />}
              title="No findings"
              description="Findings raised against this engagement will appear here."
            />
          }
        />
      )}
    </div>
  );
}

