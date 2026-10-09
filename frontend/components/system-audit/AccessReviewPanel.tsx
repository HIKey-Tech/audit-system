'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Download, Pencil, RotateCcw, Search, ShieldAlert, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { systemAuditApi, type AccessDecision, type AccessReviewItem, type AnalysisRunDetail } from '@/lib/api/system-audit';
import { DECISION_LABELS } from '@/lib/system-audit';
import { formatDate } from '@/lib/utils/format';

const DECISION_TONE: Record<AccessDecision, 'amber' | 'green' | 'red' | 'blue'> = {
  pending: 'amber',
  appropriate: 'green',
  revoke: 'red',
  modify: 'blue',
};

const FLAG_LABELS: Record<string, string> = {
  SOD_CONFLICT: 'SoD conflict',
  TERMINATED_USER_ACTIVE: 'Leaver',
  DORMANT_ACCOUNT: 'Dormant',
  NEVER_LOGGED_IN: 'Never used',
  GENERIC_ACCOUNT: 'Generic',
  ORPHAN_ACCOUNT: 'No owner',
  PRIVILEGED_ACCESS: 'Privileged',
  MFA_NOT_ENABLED: 'No MFA',
};

/**
 * Per-account certification: reviewers record whether each account's access
 * is appropriate. Decisions are recommendations held in IAMS — the reviewed
 * system is never changed from here.
 */
export const AccessReviewPanel = ({ run, canReview }: { run: AnalysisRunDetail; canReview: boolean }): JSX.Element => {
  const qc = useQueryClient();
  const locked = run.reviewStatus === 'completed';
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState('');
  const [flagged, setFlagged] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteFor, setNoteFor] = useState<AccessDecision | null>(null);

  const query = {
    page,
    pageSize: 50,
    decision: (decision || undefined) as AccessDecision | undefined,
    flagged: flagged === '' ? undefined : flagged === 'true',
    search: debounced || undefined,
  };
  const list = useQuery({
    queryKey: ['system-audit', 'access-items', run.id, query],
    queryFn: () => systemAuditApi.listAccessItems(run.id, query),
  });
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);

  const decide = useMutation({
    mutationFn: ({ value, note }: { value: AccessDecision; note?: string }) =>
      systemAuditApi.decideAccess(run.id, Array.from(selected), value, note),
    onSuccess: (result, vars) => {
      toast.success(`${result.updated} account(s) marked ${DECISION_LABELS[vars.value].toLowerCase()}`);
      setSelected(new Set());
      setNoteFor(null);
      qc.invalidateQueries({ queryKey: ['system-audit'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns: Column<AccessReviewItem>[] = [
    ...(canReview && !locked
      ? [
          {
            key: 'select',
            header: <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} />,
            render: (r: AccessReviewItem) => <input type="checkbox" aria-label={`Select ${r.accountId}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />,
            width: '36px',
          } as Column<AccessReviewItem>,
        ]
      : []),
    {
      key: 'account',
      header: 'Account',
      render: (r) => (
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-medium text-text-primary">
            {r.isPrivileged && <ShieldAlert className="h-3.5 w-3.5 text-orange-600" aria-label="Privileged" />}
            {r.displayName ?? r.accountId}
          </p>
          <p className="text-xs text-text-muted">{r.accountId}{r.department ? ` · ${r.department}` : ''}</p>
        </div>
      ),
      width: '230px',
    },
    {
      key: 'access',
      header: 'Access held',
      render: (r) => (
        <p className="line-clamp-2 text-xs text-text-secondary" title={r.entitlements.join(', ')}>
          {r.entitlements.slice(0, 6).join(', ')}{r.entitlements.length > 6 ? ` +${r.entitlements.length - 6} more` : ''}
        </p>
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.flags.length === 0 && <span className="text-xs text-text-muted">—</span>}
          {r.flags.map((f) => <Badge key={f} tone={f === 'PRIVILEGED_ACCESS' ? 'orange' : 'red'} size="xs">{FLAG_LABELS[f] ?? f}</Badge>)}
        </div>
      ),
      width: '200px',
    },
    {
      key: 'status',
      header: 'Status / last login',
      render: (r) => (
        <div className="text-xs">
          <Badge status={r.accountStatus ?? 'active'} size="xs" />
          <p className="mt-0.5 text-text-muted">{r.lastLoginAt ? formatDate(r.lastLoginAt) : 'No login data'}</p>
        </div>
      ),
      width: '140px',
    },
    {
      key: 'decision',
      header: 'Decision',
      render: (r) => (
        <div>
          <Badge tone={DECISION_TONE[r.decision]} size="xs" withDot>{DECISION_LABELS[r.decision]}</Badge>
          {r.decisionNote && <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary" title={r.decisionNote}>{r.decisionNote}</p>}
          {r.decidedBy && <p className="text-[11px] text-text-muted">{r.decidedBy.name}</p>}
        </div>
      ),
      width: '200px',
    },
  ];

  return (
    <Card padded>
      {run.accessReview && (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">{run.accessReview.total} accounts</span>
          <Badge tone="amber" size="xs">{run.accessReview.pending} pending</Badge>
          <Badge tone="green" size="xs">{run.accessReview.appropriate} appropriate</Badge>
          <Badge tone="red" size="xs">{run.accessReview.revoke} revoke</Badge>
          <Badge tone="blue" size="xs">{run.accessReview.modify} modify</Badge>
        </div>
      )}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input placeholder="Search account, name, department" aria-label="Search accounts" leftIcon={<Search className="h-4 w-4" />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={decision} aria-label="Decision" onChange={(e) => { setDecision(e.target.value); setPage(1); }}>
          <option value="">All decisions</option>
          {Object.entries(DECISION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={flagged} aria-label="Flags" onChange={(e) => { setFlagged(e.target.value); setPage(1); }}>
          <option value="">All accounts</option>
          <option value="true">Flagged by a rule</option>
          <option value="false">No flags</option>
        </Select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {canReview && !locked && (
          <>
            <span className="mr-1 text-xs text-text-secondary">{selected.size} selected</span>
            <Button size="sm" variant="secondary" leftIcon={<Check className="h-3.5 w-3.5" />} disabled={!selected.size} onClick={() => {
              // Privileged or rule-flagged accounts need a written justification.
              const needsReason = rows.some((r) => selected.has(r.id) && (r.isPrivileged || r.flags.includes('SOD_CONFLICT')));
              if (needsReason) setNoteFor('appropriate');
              else decide.mutate({ value: 'appropriate' });
            }}>Appropriate</Button>
            <Button size="sm" variant="secondary" leftIcon={<Ban className="h-3.5 w-3.5" />} disabled={!selected.size} onClick={() => setNoteFor('revoke')}>Revoke</Button>
            <Button size="sm" variant="secondary" leftIcon={<Pencil className="h-3.5 w-3.5" />} disabled={!selected.size} onClick={() => setNoteFor('modify')}>Modify</Button>
            <Button size="sm" variant="ghost" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} disabled={!selected.size} onClick={() => decide.mutate({ value: 'pending' })}>Reset</Button>
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => systemAuditApi.exportAccessItems(run.id, 'xlsx').catch((e: Error) => toast.error(e.message))}>Review worksheet</Button>
        </div>
      </div>

      <Table<AccessReviewItem>
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        density="compact"
        emptyState={<EmptyState icon={<Users className="h-4 w-4" />} title="No accounts match the filters" />}
        pagination={
          list.data
            ? { page: list.data.meta.page, pageSize: list.data.meta.pageSize, total: list.data.meta.total, onPageChange: setPage }
            : undefined
        }
      />

      <ReasonDialog
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        onConfirm={(note) => decide.mutate({ value: noteFor!, note })}
        title={
          noteFor === 'revoke'
            ? 'Recommend revoking access'
            : noteFor === 'appropriate'
              ? 'Justify this access'
              : 'Recommend changing access'
        }
        description={
          noteFor === 'appropriate'
            ? 'Some of the selected accounts are privileged or have a segregation-of-duties conflict. Explain why the access is appropriate.'
            : 'Say what should be removed or changed. IAMS records the recommendation — the system owner makes the change in the source system.'
        }
        reasonLabel={noteFor === 'appropriate' ? 'Justification' : 'Recommendation'}
        confirmLabel="Save decision"
        minLength={5}
        isLoading={decide.isPending}
      />
    </Card>
  );
};
