'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Briefcase, AlertTriangle } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { useSearchInput } from '@/lib/hooks/useSearchInput';
import { engagementsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { StartAuditWizard } from '@/components/audit/engagements/StartAuditWizard';
import type { AuditEngagement } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

type TabKey = 'all' | 'mine' | 'overdue';

export default function EngagementsListPage(): JSX.Element {
  const router = useRouter();
  const { canManageAuditProgramme: canWrite, user } = usePermissions();

  const [open, setOpen] = useState(false);

  // View state lives in the URL: Back, refresh, and shared links restore it.
  const { values, set } = useQueryFilters({
    tab: 'all',
    page: '1',
    search: '',
    status: '',
    auditType: '',
    priority: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
  const tab = (['all', 'mine', 'overdue'].includes(values.tab) ? values.tab : 'all') as TabKey;
  const page = Math.max(1, Number(values.page) || 1);

  // Typing stays local and responsive; the URL (and so the query) follows once
  // it settles, and Back/forward flow the other way.
  const [searchInput, setSearchInput] = useSearchInput(
    values.search,
    useCallback((next: string) => set({ search: next, page: '1' }), [set]),
  );

  const queryFilters = {
    page,
    pageSize: 20,
    search: values.search || undefined,
    status: values.status || undefined,
    auditType: values.auditType || undefined,
    priority: values.priority || undefined,
    sortBy: values.sortBy,
    sortOrder: values.sortOrder as 'asc' | 'desc',
    leadAuditorId: tab === 'mine' ? user.id : undefined,
    overdue: tab === 'overdue' ? true : undefined,
  };

  const query = useQuery({
    queryKey: ['engagements', queryFilters],
    queryFn: () => engagementsApi.list(queryFilters),
  });

  const overdueQuery = useQuery({
    queryKey: ['engagements', 'overdue-count'],
    queryFn: () => engagementsApi.list({ pageSize: 1, overdue: true }),
  });

  const tabs: TabItem[] = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'My Engagements' },
    {
      key: 'overdue',
      label: 'Overdue',
      count: overdueQuery.data?.meta.total ?? 0,
      countTone: 'danger',
    },
  ];

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
      key: 'type',
      header: 'Type',
      render: (e) => <Badge tone="gray">{humanizeStatus(e.auditType)}</Badge>,
      width: '120px',
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

  return (
    <div>
      <PageHeader
        title="Engagements"
        subtitle="Active audit instances tracked through the full lifecycle."
        actions={
          canWrite ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
              Start audit
            </Button>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <Tabs
          tabs={tabs}
          active={tab}
          onChange={(k) => set({ tab: k, page: '1' })}
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            placeholder="Search…"
            aria-label="Search engagements"
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
            value={values.auditType}
            aria-label="Filter by audit type"
            onChange={(e) => set({ auditType: e.target.value, page: '1' })}
          >
            <option value="">All types</option>
            <option value="it">IT</option>
            <option value="financial">Financial</option>
            <option value="compliance">Compliance</option>
            <option value="systems">Systems</option>
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
            icon={<Briefcase className="h-4 w-4" />}
            title={
              tab === 'mine' ? 'You have no engagements' : tab === 'overdue' ? 'No overdue engagements' : 'No engagements yet'
            }
            description={
              tab === 'all'
                ? 'Create your first engagement to start auditing.'
                : tab === 'mine'
                  ? 'Engagements you lead will show up here.'
                  : 'All audits are within their SLA.'
            }
            action={
              canWrite && tab === 'all' ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
                  Start audit
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

      <StartAuditWizard open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
