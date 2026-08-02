'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Briefcase, AlertTriangle, Activity } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { useSearchInput } from '@/lib/hooks/useSearchInput';
import { engagementsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { StartAuditWizard } from '@/components/audit/engagements/StartAuditWizard';
import { AUDIT_DOMAIN_MAP, isAuditDomain } from '@/lib/audit-domains';
import type { AuditEngagement } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

export default function AuditDomainPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ domain: string }>();
  const { canManageAuditProgramme: canWrite } = usePermissions();

  const [open, setOpen] = useState(false);

  // All hooks run before the notFound() bail-out so hook order stays stable.
  const { values, set } = useQueryFilters({
    page: '1',
    search: '',
    status: '',
    priority: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const page = Math.max(1, Number(values.page) || 1);

  const [searchInput, setSearchInput] = useSearchInput(
    values.search,
    useCallback((next: string) => set({ search: next, page: '1' }), [set]),
  );

  const domainKey = String(params?.domain ?? '');
  if (!isAuditDomain(domainKey)) notFound();
  const meta = AUDIT_DOMAIN_MAP[domainKey];
  const Icon = meta.icon;

  // Every query in this workspace is locked to the module's audit type.
  const queryFilters = {
    page,
    pageSize: 20,
    auditType: meta.key,
    search: values.search || undefined,
    status: values.status || undefined,
    priority: values.priority || undefined,
    sortBy: values.sortBy,
    sortOrder: values.sortOrder as 'asc' | 'desc',
  };

  const query = useQuery({
    queryKey: ['engagements', queryFilters],
    queryFn: () => engagementsApi.list(queryFilters),
  });

  const totalQuery = useQuery({
    queryKey: ['engagements', 'domain-total', meta.key],
    queryFn: () => engagementsApi.list({ pageSize: 1, auditType: meta.key }),
  });
  const activeQuery = useQuery({
    queryKey: ['engagements', 'domain-active', meta.key],
    queryFn: () => engagementsApi.list({ pageSize: 1, auditType: meta.key, status: 'in_progress' }),
  });
  const overdueQuery = useQuery({
    queryKey: ['engagements', 'domain-overdue', meta.key],
    queryFn: () => engagementsApi.list({ pageSize: 1, auditType: meta.key, overdue: true }),
  });

  const columns: Column<AuditEngagement>[] = [
    {
      // Keys of sortable columns are the backend sort field names.
      key: 'reference_number',
      header: 'Reference',
      sortable: true,
      render: (e) => <span className="font-mono text-xs text-primary">{e.referenceNumber}</span>,
      width: '140px',
    },
    {
      key: 'title',
      header: 'Title',
      render: (e) => <span className="font-medium text-text-primary line-clamp-1">{e.title}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <StatusBadge status={e.status} />,
      width: '130px',
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (e) => <StatusBadge status={e.priority} />,
      width: '110px',
    },
    {
      key: 'lead',
      header: 'Lead',
      render: (e) => <span className="text-text-secondary">{e.leadAuditorName}</span>,
      width: '170px',
    },
    {
      key: 'sla_deadline',
      header: 'SLA Deadline',
      sortable: true,
      render: (e) => {
        const overdue = new Date(e.slaDeadline) < new Date() && !['reported', 'closed'].includes(e.status);
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs',
              overdue ? 'text-danger font-medium' : 'text-text-secondary',
            )}
          >
            {overdue && <AlertTriangle className="h-3 w-3" />}
            {formatDate(e.slaDeadline)}
          </span>
        );
      },
      width: '160px',
    },
  ];

  const stats = [
    { label: 'Engagements', value: totalQuery.data?.meta.total ?? 0, icon: Briefcase, tone: 'text-primary' },
    { label: 'In progress', value: activeQuery.data?.meta.total ?? 0, icon: Activity, tone: 'text-primary' },
    { label: 'Overdue', value: overdueQuery.data?.meta.total ?? 0, icon: AlertTriangle, tone: 'text-danger' },
  ];

  return (
    <div>
      <PageHeader
        title={meta.label}
        subtitle={meta.focus}
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Start {meta.short} audit
            </Button>
          ) : null
        }
      />

      {/* Module banner — names the dedicated domain and its control framework. */}
      <Card padded className="mb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-text-secondary">{meta.description}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Control framework: <span className="text-primary">{meta.framework}</span>
            </p>
            {/* This module is the engagements register scoped to one audit type —
                say so, so the two screens don't read as unrelated. */}
            <p className="mt-2 text-xs text-text-secondary">
              Showing {meta.short} engagements only.{' '}
              <Link href="/audit/engagements" className="font-medium text-primary hover:underline">
                View all engagements
              </Link>
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const StatIcon = s.icon;
          return (
            <Card key={s.label} padded className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{s.label}</p>
                <p className={cn('mt-1 text-2xl font-bold', s.tone)}>{s.value}</p>
              </div>
              <StatIcon className={cn('h-5 w-5', s.tone)} />
            </Card>
          );
        })}
      </div>

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            placeholder="Search…"
            aria-label={`Search ${meta.label.toLowerCase()}s`}
            leftIcon={<Search className="h-4 w-4" />}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Select
            value={values.status}
            aria-label="Filter by status"
            onChange={(e) => set({ status: e.target.value, page: '1' })}
          >
            <option value="">All statuses</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="under_review">Under review</option>
            <option value="reported">Reported</option>
            <option value="closed">Closed</option>
          </Select>
          <Select
            value={values.priority}
            aria-label="Filter by priority"
            onChange={(e) => set({ priority: e.target.value, page: '1' })}
          >
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </div>
      </Card>

      <Table<AuditEngagement>
        columns={columns}
        data={query.data?.items}
        rowKey={(r) => r.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={(r) => router.push(`/audit/engagements/${r.id}`)}
        sortBy={values.sortBy}
        sortOrder={values.sortOrder as 'asc' | 'desc'}
        onSortChange={(key, order) => set({ sortBy: key, sortOrder: order, page: '1' })}
        emptyState={
          <EmptyState
            icon={<Icon className="h-4 w-4" />}
            title={`No ${meta.short} audits yet`}
            description={`Start a ${meta.label.toLowerCase()} to populate this module.`}
            action={
              canWrite ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
                  Start {meta.short} audit
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
                onPageChange: (p) => set({ page: String(p) }),
              }
            : undefined
        }
      />

      <StartAuditWizard
        open={open}
        onClose={() => setOpen(false)}
        initialMode="ad_hoc"
        initialAuditType={meta.key}
      />
    </div>
  );
}
