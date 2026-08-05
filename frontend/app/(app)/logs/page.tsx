'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search } from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { logsApi } from '@/lib/api/logs';
import { formatDateTime, formatNumber } from '@/lib/utils/format';
import { usePermission } from '@/hooks/usePermission';
import { cn } from '@/lib/utils/cn';
import type { AuditLogEntry } from '@/lib/types/domain';

// ─────────────────────────────────────────────────────────────
// Mappings
// ─────────────────────────────────────────────────────────────

/** Plain-English action labels. Keys are lowercased for case-insensitive match. */
const ACTION_LABELS: Record<string, string> = {
  // Auth (HTTP)
  'post:/api/v1/auth/login': 'User logged in',
  'post:/api/v1/auth/logout': 'User logged out',
  // Documents (HTTP)
  'post:/api/v1/documents': 'Uploaded document',
  'post:/api/v1/workflow/assignments': 'Assigned staff',
  // Audit engagement
  'audit.engagement.create': 'Created engagement',
  'audit.engagement.status.update': 'Updated engagement status',
  // Audit report
  'audit.report.generate': 'Generated audit report',
  'audit.report.issue': 'Issued audit report',
  // Audit plan
  'audit.plan.submit': 'Submitted audit programme',
  'audit.plan.approve': 'Approved audit programme',
  // Audit findings
  'audit.finding.create': 'Logged finding',
  'audit.finding.close': 'Closed finding',
  // Working papers
  'audit.workingpaper.create': 'Created working paper',
  'audit.workingpaper.submit': 'Submitted working paper',
  // Workflow
  'workflow.approval.approve': 'Approved item',
  'workflow.approval.reject': 'Rejected item',
  'workflow.escalation.fire': 'Escalation triggered',
  'workflow.assignment.create': 'Assigned staff member',
  // Risk
  'risk.register.create': 'Created risk',
  'risk.assessment.create': 'Assessed risk',
};

/** Title-cases an arbitrary token, leaving short noise words lowercased. */
const titleCaseToken = (token: string, index: number): string => {
  if (!token) return token;
  const noise = new Set(['api', 'v1', 'v2']);
  if (index > 0 && noise.has(token.toLowerCase())) return '';
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
};

/** Cleans an unmapped action into a readable phrase. */
const cleanAction = (raw: string): string => {
  // Strip HTTP method prefix: "POST:/Api/V1/Foo/Bar" → "/Api/V1/Foo/Bar"
  const colonIdx = raw.indexOf(':');
  const body = colonIdx > 0 && colonIdx < 8 ? raw.slice(colonIdx + 1) : raw;
  const tokens = body
    .replace(/[./]+/g, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);
  return tokens.map((t, i) => titleCaseToken(t, i)).filter(Boolean).join(' ') || raw;
};

const humanizeAction = (raw: string): string => {
  const key = raw.toLowerCase();
  return ACTION_LABELS[key] ?? cleanAction(raw);
};

/** Module dropdown labels. */
const MODULE_LABELS: Record<string, string> = {
  auth: 'Authentication',
  audit: 'Audit',
  workflow: 'Workflow',
  document: 'Documents',
  risk: 'Risk',
  logging: 'Logging',
  background: 'Background',
  messaging: 'Notifications',
};

const moduleLabel = (mod: string): string => MODULE_LABELS[mod.toLowerCase()] ?? mod;

/** Entity type labels. */
const ENTITY_LABELS: Record<string, string> = {
  audit_report: 'Audit Review',
  audit_engagement: 'Engagement',
  audit_working_paper: 'Working Paper',
  audit_finding: 'Finding',
  audit_plan: 'Audit Programme',
  audit_universe: 'Universe Entity',
  workflow_approval: 'Approval',
  escalation_policy: 'Escalation Policy',
  risk_register: 'Risk',
  risk_assessment: 'Risk Assessment',
};

const formatEntityType = (entityType: string | null): string => {
  if (!entityType) return '—';
  const mapped = ENTITY_LABELS[entityType];
  if (mapped) return mapped;
  return entityType
    .split('_')
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(' ');
};

/** True when the entry was emitted by the HTTP request middleware. */
const isHttpEntry = (log: AuditLogEntry): boolean => log.durationMs !== null && log.durationMs !== undefined;

const formatDuration = (ms: number): string => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
};

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function LogsPage(): JSX.Element | null {
  const router = useRouter();
  const canRead = usePermission('log:read');
  const canSummary = usePermission('log:summary');

  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (!canRead) router.replace('/dashboard');
  }, [canRead, router]);

  const modules = useQuery({
    queryKey: ['logs', 'modules'],
    queryFn: () => logsApi.modules(),
    enabled: canRead,
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
    enabled: canRead,
  });

  const summary = useQuery({
    queryKey: ['logs', 'summary', { dateFrom, dateTo }],
    queryFn: () =>
      logsApi.summary({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: canRead && canSummary,
  });

  const summaryTotals = summary.data
    ? summary.data.reduce(
        (acc, row) => ({
          total: acc.total + row.totalActions,
          success: acc.success + row.successCount,
          failure: acc.failure + row.failureCount,
        }),
        { total: 0, success: 0, failure: 0 },
      )
    : null;

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      render: (l) => <span className="font-medium text-text-primary">{humanizeAction(l.action)}</span>,
    },
    {
      key: 'module',
      header: 'Module',
      render: (l) => <Badge tone="gray">{moduleLabel(l.module)}</Badge>,
      width: '140px',
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (l) => <span className="text-text-secondary">{formatEntityType(l.entityType)}</span>,
      width: '160px',
    },
    {
      key: 'user',
      header: 'User',
      render: (l) => (
        <span className={cn(l.userDisplayName ? 'text-text-primary' : 'italic text-text-secondary')}>
          {l.userDisplayName ?? 'System'}
        </span>
      ),
      width: '180px',
    },
    {
      key: 'status',
      header: 'Status',
      render: (l) => <LogStatusBadge status={l.status} />,
      width: '110px',
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (l) => (
        <span className="text-xs tabular-nums text-text-secondary">
          {isHttpEntry(l) ? formatDuration(l.durationMs as number) : '—'}
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

  if (!canRead) return null;

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Complete record of all actions performed in the system"
        actions={
          list.data ? (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Total entries</p>
              <p className="text-lg font-semibold tabular-nums text-text-primary">{formatNumber(list.data.meta.total)}</p>
            </div>
          ) : null
        }
      />

      {canSummary && summaryTotals && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Total actions" value={formatNumber(summaryTotals.total)} tone="neutral" />
          <StatTile label="Successful" value={formatNumber(summaryTotals.success)} tone="success" />
          <StatTile label="Failed" value={formatNumber(summaryTotals.failure)} tone="failure" />
        </div>
      )}

      <Card padded className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Search by action or user"
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
                {moduleLabel(m)}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <KV label="Action" value={humanizeAction(selected.action)} />
              <KV label="Module" value={moduleLabel(selected.module)} />
              <KV label="Status" value={<LogStatusBadge status={selected.status} />} />
              <KV
                label="Duration"
                value={isHttpEntry(selected) ? formatDuration(selected.durationMs as number) : '—'}
              />
              <KV label="Entity type" value={formatEntityType(selected.entityType)} />
              <KV label="User" value={selected.userDisplayName ?? 'System'} />
              <KV label="IP" value={selected.ipAddress ?? '—'} />
              <KV label="When" value={formatDateTime(selected.createdAt)} />
            </div>
            <KV label="Raw action" value={<span className="font-mono">{selected.action}</span>} />
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

// ─────────────────────────────────────────────────────────────
// Local components
// ─────────────────────────────────────────────────────────────

const LogStatusBadge = ({ status }: { status: string }): JSX.Element => {
  if (status === 'failure') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-red-700 whitespace-nowrap">
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        Failure
      </span>
    );
  }
  return <Badge status={status} withDot />;
};

const StatTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'failure';
}): JSX.Element => {
  const toneClasses =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'failure'
        ? 'text-red-700'
        : 'text-text-primary';
  return (
    <Card padded className="!p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', toneClasses)}>{value}</p>
    </Card>
  );
};

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
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
      <pre className="overflow-x-auto rounded-md border border-border bg-surface-alt px-3 py-2 font-mono text-[11px] text-text-primary">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
};
