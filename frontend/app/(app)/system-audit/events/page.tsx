'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertOctagon, Ban, Download, KeyRound, Lock, LogIn, ShieldAlert, UserX } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Table, type Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { StatTile } from '@/components/system-audit/shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { logsApi } from '@/lib/api/logs';
import { systemAuditApi, type SystemLogEntry } from '@/lib/api/system-audit';
import type { AuditLogEntry } from '@/lib/types/domain';
import { formatDateTime, formatNumber } from '@/lib/utils/format';

const SECURITY_LABELS: Record<string, string> = {
  'auth.login.succeeded': 'Signed in',
  'auth.login.failed': 'Sign-in failed',
  'auth.mfa.failed': 'Two-factor code rejected',
  'auth.mfa.admin_reset': 'Two-factor reset by administrator',
  'auth.token.reuse_detected': 'Stolen session token detected',
  'auth.logout': 'Signed out',
  'auth.password_reset.requested': 'Password reset requested',
  'auth.password_reset.completed': 'Password reset completed',
  'access.denied': 'Access denied',
};

const REASON_LABELS: Record<string, string> = {
  invalid_password: 'wrong password',
  unknown_account: 'unknown account',
  account_deactivated: 'account deactivated',
  no_local_password: 'SSO-only account',
  idp_mfa_missing: 'identity provider did not confirm MFA',
  invalid_code: 'invalid code',
  revoked_token_replayed: 'revoked token replayed',
};

const TABS: TabItem[] = [
  { key: 'security', label: 'Security events' },
  { key: 'changes', label: 'Change history' },
  { key: 'exceptions', label: 'System exceptions' },
];

const values = (e: AuditLogEntry): Record<string, unknown> =>
  e.newValues && typeof e.newValues === 'object' ? (e.newValues as Record<string, unknown>) : {};

export default function EventMonitoringPage(): JSX.Element {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('log:read');
  const canExport = hasPermission('log:export');
  const { values: q, set } = useQueryFilters({ tab: 'security', days: '7', page: '1' });
  const days = Number(q.days) || 7;
  const page = Math.max(1, Number(q.page) || 1);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [selectedException, setSelectedException] = useState<SystemLogEntry | null>(null);
  const dateFrom = new Date(Date.now() - days * 86_400_000).toISOString();

  const summary = useQuery({
    queryKey: ['events', 'security-summary', days],
    queryFn: () => systemAuditApi.securitySummary(days),
    enabled: canRead,
  });
  const security = useQuery({
    queryKey: ['events', 'security', days, page],
    queryFn: () => logsApi.list({ module: 'security', dateFrom, page, pageSize: 25, sortOrder: 'desc' }),
    enabled: canRead && q.tab === 'security',
  });
  const changes = useQuery({
    queryKey: ['events', 'changes', days, page],
    queryFn: () => logsApi.list({ hasChanges: true, dateFrom, page, pageSize: 25, sortOrder: 'desc' }),
    enabled: canRead && q.tab === 'changes',
  });
  const exceptions = useQuery({
    queryKey: ['events', 'exceptions', days, page],
    queryFn: () => systemAuditApi.listSystemLogs({ dateFrom, page, pageSize: 25 }),
    enabled: canRead && q.tab === 'exceptions',
  });

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Event monitoring" />
        <Card><EmptyState icon={<Lock className="h-4 w-4" />} title="You do not have access to the audit logs" /></Card>
      </div>
    );
  }

  const s = summary.data;
  const maxDay = Math.max(1, ...(s?.byDay ?? []).map((d) => d.loginSucceeded + d.loginFailed + d.accessDenied));

  const securityColumns: Column<AuditLogEntry>[] = [
    {
      key: 'event',
      header: 'Event',
      render: (e) => {
        const v = values(e);
        const reason = typeof v.reason === 'string' ? REASON_LABELS[v.reason] ?? v.reason.replace(/_/g, ' ') : null;
        const request = typeof v.path === 'string' ? `${String(v.httpMethod ?? '')} ${v.path}`.trim() : null;
        const detail = [reason, request].filter(Boolean).join(' · ');
        return (
          <div>
            <p className="font-medium text-text-primary">{SECURITY_LABELS[e.action] ?? e.action}</p>
            {detail && <p className="text-xs text-text-secondary">{detail}</p>}
          </div>
        );
      },
    },
    {
      key: 'who',
      header: 'Account',
      render: (e) => <span className="text-text-primary">{e.userDisplayName ?? (typeof values(e).email === 'string' ? String(values(e).email) : '—')}</span>,
      width: '220px',
    },
    { key: 'status', header: 'Outcome', render: (e) => <Badge status={e.status} size="xs" withDot />, width: '110px' },
    { key: 'ip', header: 'IP address', render: (e) => <span className="font-mono text-xs text-text-secondary">{e.ipAddress ?? '—'}</span>, width: '150px' },
    { key: 'when', header: 'When', render: (e) => <span className="text-xs text-text-secondary">{formatDateTime(e.createdAt)}</span>, width: '160px' },
  ];

  const changeColumns: Column<AuditLogEntry>[] = [
    { key: 'action', header: 'Change', render: (e) => <span className="font-mono text-xs text-text-primary">{e.action}</span> },
    { key: 'entity', header: 'Record', render: (e) => <span className="text-xs text-text-secondary">{e.entityType?.replace(/_/g, ' ') ?? '—'}</span>, width: '200px' },
    { key: 'who', header: 'Changed by', render: (e) => <span>{e.userDisplayName ?? 'System'}</span>, width: '200px' },
    { key: 'when', header: 'When', render: (e) => <span className="text-xs text-text-secondary">{formatDateTime(e.createdAt)}</span>, width: '160px' },
  ];

  const exceptionColumns: Column<SystemLogEntry>[] = [
    {
      key: 'message',
      header: 'Exception',
      render: (e) => (
        <div>
          <p className="font-medium text-text-primary">{e.message}</p>
          <p className="text-xs text-text-secondary">{e.errorName ?? 'Error'}{e.path ? ` · ${e.path}` : ''}</p>
        </div>
      ),
    },
    { key: 'source', header: 'Source', render: (e) => <Badge tone="gray" size="xs">{e.source ?? 'app'}</Badge>, width: '100px' },
    { key: 'when', header: 'When', render: (e) => <span className="text-xs text-text-secondary">{formatDateTime(e.createdAt)}</span>, width: '160px' },
  ];

  const pagination = (data?: { meta: { page: number; pageSize: number; total: number } }) =>
    data ? { page: data.meta.page, pageSize: data.meta.pageSize, total: data.meta.total, onPageChange: (p: number) => set({ page: String(p) }) } : undefined;

  const exportCurrent = (format: 'csv' | 'xlsx'): void => {
    const filters = q.tab === 'changes' ? { hasChanges: true, dateFrom } : { module: 'security', dateFrom };
    logsApi.export(filters, format).catch((e: Error) => toast.error(e.message));
  };

  return (
    <div>
      <PageHeader
        title="Event monitoring"
        subtitle="Read-only view of user activity, security events, change history, and system exceptions."
        breadcrumbs={[{ label: 'System audit', href: '/system-audit' }, { label: 'Event monitoring' }]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(days)} aria-label="Time window" onChange={(e) => set({ days: e.target.value, page: '1' })}>
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
            {canExport && q.tab !== 'exceptions' && (
              <Button variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => exportCurrent('xlsx')}>Export</Button>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Successful sign-ins" value={formatNumber(s?.totals.loginSucceeded ?? 0)} icon={<LogIn className="h-4 w-4" />} />
        <StatTile label="Failed sign-ins" value={formatNumber(s?.totals.loginFailed ?? 0)} tone={(s?.totals.loginFailed ?? 0) > 0 ? 'warn' : 'neutral'} icon={<UserX className="h-4 w-4" />} />
        <StatTile label="2FA failures" value={formatNumber(s?.totals.mfaFailed ?? 0)} tone={(s?.totals.mfaFailed ?? 0) > 0 ? 'warn' : 'neutral'} icon={<KeyRound className="h-4 w-4" />} />
        <StatTile label="Access denied" value={formatNumber(s?.totals.accessDenied ?? 0)} tone={(s?.totals.accessDenied ?? 0) > 0 ? 'warn' : 'neutral'} icon={<Ban className="h-4 w-4" />} />
        <StatTile label="Session theft blocked" value={formatNumber(s?.totals.tokenReuseDetected ?? 0)} tone={(s?.totals.tokenReuseDetected ?? 0) > 0 ? 'bad' : 'neutral'} icon={<ShieldAlert className="h-4 w-4" />} />
        <StatTile label="Credential resets" value={formatNumber((s?.totals.passwordResets ?? 0) + (s?.totals.mfaResets ?? 0))} icon={<AlertOctagon className="h-4 w-4" />} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padded className="lg:col-span-2">
          <CardHeader title="Activity by day" subtitle="Successful and failed sign-ins, and denied access" />
          <div className="flex h-40 items-end gap-1">
            {(s?.byDay ?? []).map((d) => {
              const total = d.loginSucceeded + d.loginFailed + d.accessDenied;
              return (
                <div key={d.date} className="group flex h-full flex-1 flex-col items-center justify-end" title={`${d.date}: ${d.loginSucceeded} sign-ins, ${d.loginFailed} failed, ${d.accessDenied} denied`}>
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div className="flex w-full max-w-[28px] flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(total / maxDay) * 100}%`, minHeight: total ? 2 : 0 }}>
                      <div className="bg-emerald-500" style={{ height: total ? `${(d.loginSucceeded / total) * 100}%` : 0 }} />
                      <div className="bg-amber-500" style={{ height: total ? `${(d.loginFailed / total) * 100}%` : 0 }} />
                      <div className="bg-red-500" style={{ height: total ? `${(d.accessDenied / total) * 100}%` : 0 }} />
                    </div>
                  </div>
                  {days <= 30 && <span className="mt-1 text-[9px] text-text-muted">{d.date.slice(8)}</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-text-secondary">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Signed in</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" />Failed sign-in</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" />Access denied</span>
          </div>
        </Card>
        <Card padded>
          <CardHeader title="Watch list" subtitle="Accounts with the most failures" />
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Failed sign-ins</p>
          {(s?.topFailedAccounts ?? []).length === 0 && <p className="mb-3 text-xs text-text-muted">None in this window</p>}
          <ul className="mb-3 space-y-1">
            {s?.topFailedAccounts.map((a) => (
              <li key={a.account} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-text-primary">{a.account}</span>
                <span className="shrink-0 text-xs text-text-secondary">{a.count}× from {a.distinctIps} IP(s)</span>
              </li>
            ))}
          </ul>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Access denied</p>
          {(s?.topDeniedUsers ?? []).length === 0 && <p className="text-xs text-text-muted">None in this window</p>}
          <ul className="space-y-1">
            {s?.topDeniedUsers.map((u) => (
              <li key={u.userId ?? 'anon'} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-text-primary">{u.userName ?? 'Unauthenticated'}</span>
                <span className="shrink-0 text-xs text-text-secondary">{u.count}×</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Tabs tabs={TABS} active={q.tab} onChange={(key) => set({ tab: key, page: '1' })} className="mb-4" />

      {q.tab === 'security' && (
        <Table<AuditLogEntry>
          columns={securityColumns}
          data={security.data?.items}
          rowKey={(e) => e.id}
          isLoading={security.isLoading}
          isError={security.isError}
          onRetry={() => security.refetch()}
          onRowClick={setSelectedLog}
          density="compact"
          emptyState={<EmptyState icon={<Activity className="h-4 w-4" />} title="No security events in this window" />}
          pagination={pagination(security.data)}
        />
      )}
      {q.tab === 'changes' && (
        <Table<AuditLogEntry>
          columns={changeColumns}
          data={changes.data?.items}
          rowKey={(e) => e.id}
          isLoading={changes.isLoading}
          isError={changes.isError}
          onRetry={() => changes.refetch()}
          onRowClick={setSelectedLog}
          density="compact"
          emptyState={<EmptyState icon={<Activity className="h-4 w-4" />} title="No recorded changes in this window" />}
          pagination={pagination(changes.data)}
        />
      )}
      {q.tab === 'exceptions' && (
        <Table<SystemLogEntry>
          columns={exceptionColumns}
          data={exceptions.data?.items}
          rowKey={(e) => e.id}
          isLoading={exceptions.isLoading}
          isError={exceptions.isError}
          onRetry={() => exceptions.refetch()}
          onRowClick={setSelectedException}
          density="compact"
          emptyState={<EmptyState icon={<Activity className="h-4 w-4" />} title="No system exceptions in this window" />}
          pagination={pagination(exceptions.data)}
        />
      )}

      <SlideOver open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} title={selectedLog ? SECURITY_LABELS[selectedLog.action] ?? selectedLog.action : ''} description={selectedLog ? formatDateTime(selectedLog.createdAt) : undefined} width="xl">
        {selectedLog && (
          <div className="space-y-3 text-sm">
            <Detail label="Account" value={selectedLog.userDisplayName ?? '—'} />
            <Detail label="Outcome" value={selectedLog.status} />
            <Detail label="IP address" value={selectedLog.ipAddress ?? '—'} />
            <Detail label="User agent" value={selectedLog.userAgent ?? '—'} />
            {selectedLog.entityType && <Detail label="Record" value={`${selectedLog.entityType} ${selectedLog.entityId ?? ''}`} />}
            {selectedLog.oldValues != null && <Json label="Before" value={selectedLog.oldValues} />}
            {selectedLog.newValues != null && <Json label={selectedLog.oldValues != null ? 'After' : 'Details'} value={selectedLog.newValues} />}
          </div>
        )}
      </SlideOver>
      <SlideOver open={Boolean(selectedException)} onClose={() => setSelectedException(null)} title="System exception" description={selectedException ? formatDateTime(selectedException.createdAt) : undefined} width="xl">
        {selectedException && (
          <div className="space-y-3 text-sm">
            <Detail label="Message" value={selectedException.message} />
            <Detail label="Type" value={selectedException.errorName ?? '—'} />
            <Detail label="Source" value={selectedException.source ?? '—'} />
            {selectedException.path && <Detail label="Request" value={selectedException.path} />}
            {selectedException.requestId && <Detail label="Request id" value={selectedException.requestId} />}
            {selectedException.context != null && <Json label="Context (credentials redacted)" value={selectedException.context} />}
            {selectedException.stack && <Json label="Stack trace" value={selectedException.stack} />}
          </div>
        )}
      </SlideOver>
    </div>
  );
}

const Detail = ({ label, value }: { label: string; value: React.ReactNode }): JSX.Element => (
  <div className="grid grid-cols-3 gap-2 border-b border-border/60 pb-2">
    <span className="text-xs text-text-secondary">{label}</span>
    <span className="col-span-2 break-all text-text-primary">{value}</span>
  </div>
);

const Json = ({ label, value }: { label: string; value: unknown }): JSX.Element => (
  <div>
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">{label}</p>
    <pre className="max-h-80 overflow-auto rounded-md border border-border bg-surface-alt px-3 py-2 font-mono text-[11px] text-text-primary">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  </div>
);
