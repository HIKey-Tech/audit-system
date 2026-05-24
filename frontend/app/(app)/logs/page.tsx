'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search, X as CloseX } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { logsApi } from '@/lib/api/logs';
import { formatDateTime } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import type { AuditLogEntry } from '@/lib/types/domain';

export default function LogsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const modules = useQuery({
    queryKey: ['logs', 'modules'],
    queryFn: () => logsApi.modules(),
  });

  const list = useQuery({
    queryKey: ['logs', { page, module, status, dateFrom, dateTo, search }],
    queryFn: () =>
      logsApi.list({
        page,
        pageSize: 30,
        module: module || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        action: search || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  });

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (l) => <span className="font-medium text-text-primary">{humanizeStatus(l.action)}</span>,
    },
    {
      key: 'module',
      header: 'Module',
      render: (l) => <Badge tone="gray">{l.module}</Badge>,
      width: '120px',
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (l) => <span className="text-text-secondary">{l.entityType ?? '—'}</span>,
      width: '140px',
    },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (l) =>
        l.entityId ? <span className="font-mono text-[11px] text-text-muted">{l.entityId.slice(0, 8)}…</span> : <span>—</span>,
      width: '110px',
    },
    {
      key: 'user',
      header: 'User',
      render: (l) => <span className="text-text-secondary">{l.userDisplayName ?? '—'}</span>,
      width: '170px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <StatusBadge status={l.status} />,
      width: '110px',
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (l) => (
        <span className="text-xs tabular-nums text-text-secondary">
          {l.durationMs !== null && l.durationMs !== undefined ? `${l.durationMs}ms` : '—'}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (l) => <span className="text-xs text-text-secondary">{formatDateTime(l.createdAt)}</span>,
      width: '170px',
    },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Tamper-evident audit trail of mutating actions across IAMS." />

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Action (e.g. create_engagement)"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All modules</option>
            {modules.data?.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </Card>

      <Table<AuditLogEntry>
        columns={columns}
        data={list.data?.items}
        rowKey={(l) => l.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        onRowClick={(l) => setSelected(l)}
        emptyState={
          <EmptyState
            icon={<ScrollText className="h-4 w-4" />}
            title="No log entries"
            description="Adjust the filters to broaden the search."
          />
        }
        density="compact"
        pagination={
          list.data
            ? {
                page: list.data.meta.page,
                pageSize: list.data.meta.pageSize,
                total: list.data.meta.total,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <SlideOver
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Log entry"
        description={selected?.id}
        width="xl"
      >
        {selected && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KV label="Action" value={humanizeStatus(selected.action)} />
              <KV label="Module" value={selected.module} />
              <KV label="Status" value={<StatusBadge status={selected.status} />} />
              <KV label="Duration" value={selected.durationMs ? `${selected.durationMs} ms` : '—'} />
              <KV label="Entity type" value={selected.entityType ?? '—'} />
              <KV label="Entity ID" value={<span className="font-mono">{selected.entityId ?? '—'}</span>} />
              <KV label="User" value={selected.userDisplayName ?? '—'} />
              <KV label="IP" value={selected.ipAddress ?? '—'} />
              <KV label="When" value={formatDateTime(selected.createdAt)} />
            </div>
            <KV label="User agent" value={<span className="break-all">{selected.userAgent ?? '—'}</span>} />
            <JsonBlock label="Old values" value={selected.oldValues} />
            <JsonBlock label="New values" value={selected.newValues} />
            <JsonBlock label="Metadata" value={selected.metadata} />
          </div>
        )}
      </SlideOver>
    </div>
  );
}

const KV = ({ label, value }: { label: string; value: React.ReactNode }): JSX.Element => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
    <div className="mt-0.5 text-text-primary">{value}</div>
  </div>
);

const JsonBlock = ({ label, value }: { label: string; value: unknown }): JSX.Element | null => {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">{label}</p>
      <pre className="overflow-x-auto rounded-md border border-border bg-surface-alt px-3 py-2 text-[11px] font-mono text-text-primary">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
};

void CloseX;
