'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Globe } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { universeApi } from '@/lib/api/audit';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { humanizeStatus, riskScoreLabel, riskScoreTone } from '@/lib/utils/status';
import type { AuditUniverseEntity } from '@/lib/types/domain';
import { UniverseFormSlideOver } from '@/components/audit/universe/UniverseFormSlideOver';

export default function UniverseListPage(): JSX.Element {
  const router = useRouter();
  const { canManageAuditProgramme: canWrite } = usePermissions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);

  const query = useQuery({
    queryKey: ['universe', { page, search, category, status }],
    queryFn: () =>
      universeApi.list({
        page,
        pageSize: 20,
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
      }),
  });

  const columns: Column<AuditUniverseEntity>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{e.name}</p>
          {e.description && (
            <p className="truncate text-[11px] text-text-secondary">{e.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (e) => <Badge tone="gray">{humanizeStatus(e.category)}</Badge>,
      width: '140px',
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (e) => <span className="text-text-secondary">{e.ownerName}</span>,
      width: '180px',
    },
    {
      key: 'risk',
      header: 'Risk Score',
      render: (e) => {
        const t = riskScoreTone(e.riskScore);
        return (
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
            {formatNumber(e.riskScore)} · {riskScoreLabel(e.riskScore)}
          </span>
        );
      },
      width: '170px',
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: (e) => <span className="capitalize text-text-secondary">{humanizeStatus(e.auditFrequency)}</span>,
      width: '120px',
    },
    {
      key: 'lastAudited',
      header: 'Last Audited',
      render: (e) => (
        <span className="text-text-secondary">
          {e.lastAuditedAt ? formatDate(e.lastAuditedAt) : 'Never'}
        </span>
      ),
      width: '130px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <StatusBadge status={e.status} />,
      width: '110px',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '90px',
      render: (e) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(ev) => {
            ev.stopPropagation();
            router.push(`/audit/universe/${e.id}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Universe"
        subtitle="Departments, systems, processes, assets and projects in the audit scope."
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setSlideOpen(true)}>
              New Entity
            </Button>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            placeholder="Search by name…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            <option value="department">Department</option>
            <option value="system">System</option>
            <option value="process">Process</option>
            <option value="asset">Asset</option>
            <option value="project">Project</option>
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Card>

      <Table<AuditUniverseEntity>
        columns={columns}
        data={query.data?.items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(row) => router.push(`/audit/universe/${row.id}`)}
        emptyState={
          <EmptyState
            icon={<Globe className="h-4 w-4" />}
            title="No auditable entities yet"
            description="Add your first entity to start defining the GBB audit universe."
            action={
              canWrite ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setSlideOpen(true)}>
                  New Entity
                </Button>
              ) : undefined
            }
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

      <UniverseFormSlideOver open={slideOpen} onClose={() => setSlideOpen(false)} />
    </div>
  );
}
