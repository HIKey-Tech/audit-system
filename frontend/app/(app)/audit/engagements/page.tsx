'use client';

import { useState } from 'react';
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
import { engagementsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { NewEngagementSlideOver } from '@/components/audit/engagements/NewEngagementSlideOver';
import type { AuditEngagement } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

type TabKey = 'all' | 'mine' | 'overdue';

export default function EngagementsListPage(): JSX.Element {
  const router = useRouter();
  const { canManageAuditProgramme: canWrite, user } = usePermissions();

  const [tab, setTab] = useState<TabKey>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [auditType, setAuditType] = useState('');
  const [priority, setPriority] = useState('');
  const [open, setOpen] = useState(false);

  const queryFilters = {
    page,
    pageSize: 20,
    search: search || undefined,
    status: status || undefined,
    auditType: auditType || undefined,
    priority: priority || undefined,
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
      key: 'reference',
      header: 'Reference',
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
      key: 'sla',
      header: 'SLA Deadline',
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
              New Engagement
            </Button>
          ) : null
        }
      />

      <Card padded className="mb-4">
        <Tabs
          tabs={tabs}
          active={tab}
          onChange={(k) => {
            setTab(k as TabKey);
            setPage(1);
          }}
          className="mb-4"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Input
            placeholder="Search…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="under_review">Under review</option>
            <option value="reported">Reported</option>
            <option value="closed">Closed</option>
          </Select>
          <Select
            value={auditType}
            onChange={(e) => {
              setAuditType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All types</option>
            <option value="it">IT</option>
            <option value="financial">Financial</option>
            <option value="compliance">Compliance</option>
            <option value="systems">Systems</option>
          </Select>
          <Select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
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
                  New Engagement
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

      <NewEngagementSlideOver open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
