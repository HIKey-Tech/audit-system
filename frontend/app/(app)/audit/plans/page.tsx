'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, ClipboardList } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { plansApi } from '@/lib/api/audit';
import { formatDate, formatNumber } from '@/lib/utils/format';
import { PlanFormSlideOver } from '@/components/audit/plans/PlanFormSlideOver';
import { AUDIT_DOMAINS, auditTypeLabel } from '@/lib/audit-domains';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import type { AuditPlan } from '@/lib/types/domain';

const STATUS_TABS: TabItem[] = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function PlansListPage(): JSX.Element {
  const router = useRouter();
  const { canManageAuditProgramme: canWrite } = usePermissions();
  const currentYear = new Date().getFullYear();

  const [page, setPage] = useState(1);
  const [year, setYear] = useState<number | ''>('');
  const [status, setStatus] = useState('');
  const [auditType, setAuditType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [open, setOpen] = useState(false);

  // Typing stays local; only the settled term reaches the API.
  const search = useDebouncedValue(searchInput, 300);

  const query = useQuery({
    queryKey: ['plans', { page, year, status, auditType, search }],
    queryFn: () =>
      plansApi.list({
        page,
        pageSize: 20,
        year: year || undefined,
        status: status || undefined,
        auditType: auditType || undefined,
        search: search || undefined,
      }),
  });

  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = currentYear + 1; y >= currentYear - 5; y--) out.push(y);
    return out;
  }, [currentYear]);

  const columns: Column<AuditPlan>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (p) => <span className="font-medium text-text-primary">{p.title}</span>,
    },
    {
      key: 'auditType',
      header: 'Type',
      render: (p) => <Badge tone="gray">{auditTypeLabel(p.auditType, 'short')}</Badge>,
      width: '130px',
    },
    {
      key: 'year',
      header: 'Year',
      render: (p) => <span className="font-mono text-xs">{p.year}</span>,
      width: '90px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
      width: '120px',
    },
    {
      key: 'items',
      header: 'Plans',
      render: (p) => <span className="tabular-nums">{formatNumber(p.itemsCount)}</span>,
      width: '90px',
      align: 'right',
    },
    {
      key: 'approvedBy',
      header: 'Approved by',
      render: (p) => <span className="text-text-secondary">{p.approvedByName ?? '—'}</span>,
      width: '180px',
    },
    {
      key: 'created',
      header: 'Created',
      render: (p) => <span className="text-text-secondary text-xs">{formatDate(p.createdAt)}</span>,
      width: '130px',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Programme"
        subtitle="The annual programme holds the plans that drive engagement scheduling and approval routing."
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              New Programme
            </Button>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1 sm:flex-none sm:w-64">
            <Input
              type="search"
              placeholder="Search programmes…"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-48">
            <Select
              value={auditType}
              onChange={(e) => {
                setAuditType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All audit types</option>
              {AUDIT_DOMAINS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Select
              value={String(year)}
              onChange={(e) => {
                setYear(e.target.value ? Number(e.target.value) : '');
                setPage(1);
              }}
            >
              <option value="">All years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1 min-w-[280px]">
            <Tabs
              tabs={STATUS_TABS}
              active={status}
              onChange={(k) => {
                setStatus(k);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      <Table<AuditPlan>
        columns={columns}
        data={query.data?.items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(r) => router.push(`/audit/plans/${r.id}`)}
        emptyState={
          <EmptyState
            icon={<ClipboardList className="h-4 w-4" />}
            title="No programmes yet"
            description="Create your first audit programme to begin scheduling engagements."
            action={
              canWrite ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
                  New Programme
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

      <PlanFormSlideOver open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
