'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FilePlus2, RotateCcw, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, type Column } from '@/components/ui/Table';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { SlideOver } from '@/components/ui/SlideOver';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import {
  systemAuditApi,
  type AnalysisException,
  type AnalysisRunDetail,
  type Disposition,
  type Severity,
} from '@/lib/api/system-audit';
import { DISPOSITION_LABELS } from '@/lib/system-audit';
import { formatDateTime } from '@/lib/utils/format';
import { RaiseFindingSlideOver } from './RaiseFindingSlideOver';
import { SeverityBadge, summaryLabel } from './shared';

const DISPOSITION_TONE: Record<Disposition, 'red' | 'gray' | 'blue' | 'amber'> = {
  open: 'amber',
  confirmed: 'red',
  false_positive: 'gray',
  explained: 'blue',
};

export const ExceptionsPanel = ({
  run,
  canReview,
  canRaiseFinding,
}: {
  run: AnalysisRunDetail;
  canReview: boolean;
  canRaiseFinding: boolean;
}): JSX.Element => {
  const qc = useQueryClient();
  const locked = run.reviewStatus === 'completed';
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [disposition, setDisposition] = useState('');
  const [ruleCode, setRuleCode] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteFor, setNoteFor] = useState<Disposition | null>(null);
  const [detail, setDetail] = useState<AnalysisException | null>(null);
  const [raiseOpen, setRaiseOpen] = useState(false);

  const query = {
    page,
    pageSize: 50,
    severity: (severity || undefined) as Severity | undefined,
    disposition: (disposition || undefined) as Disposition | undefined,
    ruleCode: ruleCode || undefined,
    search: debounced || undefined,
  };
  const list = useQuery({
    queryKey: ['system-audit', 'exceptions', run.id, query],
    queryFn: () => systemAuditApi.listExceptions(run.id, query),
  });
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const selectedRows = rows.filter((r) => selected.has(r.id));

  const dispose = useMutation({
    mutationFn: ({ value, note }: { value: Disposition; note?: string }) =>
      systemAuditApi.disposition(Array.from(selected), value, note),
    onSuccess: (result, vars) => {
      toast.success(`${result.updated} exception(s) marked ${DISPOSITION_LABELS[vars.value].toLowerCase()}`);
      setSelected(new Set());
      setNoteFor(null);
      qc.invalidateQueries({ queryKey: ['system-audit'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const columns: Column<AnalysisException>[] = [
    ...(canReview && !locked
      ? [
          {
            key: 'select',
            header: (
              <input
                type="checkbox"
                aria-label="Select all on this page"
                checked={allOnPage}
                onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))}
              />
            ),
            render: (r: AnalysisException) => (
              <input
                type="checkbox"
                aria-label={`Select ${r.title}`}
                checked={selected.has(r.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => toggle(r.id)}
              />
            ),
            width: '36px',
          } as Column<AnalysisException>,
        ]
      : []),
    { key: 'severity', header: 'Severity', render: (r) => <SeverityBadge severity={r.severity} />, width: '110px' },
    {
      key: 'title',
      header: 'Exception',
      render: (r) => (
        <div className="min-w-0">
          <p className="text-sm text-text-primary">{r.title}</p>
          <p className="mt-0.5 text-xs text-text-muted">{r.ruleLabel}{r.recordRef ? ` · ${r.recordRef}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'disposition',
      header: 'Disposition',
      render: (r) => (
        <div>
          <Badge tone={DISPOSITION_TONE[r.disposition]} size="xs" withDot>{DISPOSITION_LABELS[r.disposition]}</Badge>
          {r.finding && (
            <Link href={`/audit/findings/${r.finding.id}`} onClick={(e) => e.stopPropagation()} className="mt-1 block text-xs text-primary hover:underline">
              Finding: {r.finding.title}
            </Link>
          )}
        </div>
      ),
      width: '220px',
    },
  ];

  return (
    <Card padded>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Search exceptions" aria-label="Search exceptions" leftIcon={<Search className="h-4 w-4" />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={ruleCode} aria-label="Rule" onChange={(e) => { setRuleCode(e.target.value); setPage(1); }}>
          <option value="">All rules</option>
          {run.ruleCounts.map((r) => <option key={r.ruleCode} value={r.ruleCode}>{r.label} ({r.count})</option>)}
        </Select>
        <Select value={severity} aria-label="Severity" onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
          <option value="">All severities</option>
          {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={disposition} aria-label="Disposition" onChange={(e) => { setDisposition(e.target.value); setPage(1); }}>
          <option value="">All dispositions</option>
          {Object.entries(DISPOSITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {canReview && !locked && (
          <>
            <span className="mr-1 text-xs text-text-secondary">{selected.size} selected</span>
            <Button size="sm" variant="secondary" leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />} disabled={!selected.size} onClick={() => dispose.mutate({ value: 'confirmed' })}>Confirm</Button>
            <Button size="sm" variant="secondary" leftIcon={<XCircle className="h-3.5 w-3.5" />} disabled={!selected.size} onClick={() => setNoteFor('false_positive')}>False positive</Button>
            <Button size="sm" variant="secondary" leftIcon={<AlertTriangle className="h-3.5 w-3.5" />} disabled={!selected.size} onClick={() => setNoteFor('explained')}>Explained</Button>
            <Button size="sm" variant="ghost" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} disabled={!selected.size} onClick={() => dispose.mutate({ value: 'open' })}>Reopen</Button>
            {canRaiseFinding && (
              <Button
                size="sm"
                leftIcon={<FilePlus2 className="h-3.5 w-3.5" />}
                disabled={!selected.size || selectedRows.some((r) => r.finding)}
                onClick={() => setRaiseOpen(true)}
              >
                Raise finding
              </Button>
            )}
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => systemAuditApi.exportExceptions(run.id, 'xlsx').catch((e: Error) => toast.error(e.message))}>Excel</Button>
          <Button size="sm" variant="ghost" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => systemAuditApi.exportExceptions(run.id, 'csv').catch((e: Error) => toast.error(e.message))}>CSV</Button>
        </div>
      </div>

      <Table<AnalysisException>
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        onRowClick={(r) => setDetail(r)}
        density="compact"
        emptyState={
          <EmptyState
            icon={<CheckCircle2 className="h-4 w-4" />}
            title={run.exceptionCount === 0 ? 'No exceptions — every record passed' : 'No exceptions match the filters'}
          />
        }
        pagination={
          list.data
            ? { page: list.data.meta.page, pageSize: list.data.meta.pageSize, total: list.data.meta.total, onPageChange: setPage }
            : undefined
        }
      />

      <ReasonDialog
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        onConfirm={(note) => dispose.mutate({ value: noteFor!, note })}
        title={noteFor === 'false_positive' ? 'Mark as false positive' : 'Mark as explained'}
        description={`Record why the ${selected.size} selected exception(s) do not need a finding. The note is kept in the audit trail.`}
        reasonLabel="Explanation"
        confirmLabel="Save"
        minLength={5}
        isLoading={dispose.isPending}
      />

      <SlideOver open={Boolean(detail)} onClose={() => setDetail(null)} title="Exception" description={detail?.ruleLabel} width="lg">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2"><SeverityBadge severity={detail.severity} /><Badge tone={DISPOSITION_TONE[detail.disposition]} size="xs">{DISPOSITION_LABELS[detail.disposition]}</Badge></div>
            <p className="font-medium text-text-primary">{detail.title}</p>
            <dl className="space-y-2">
              {detail.recordRef && <Row label="Record" value={detail.recordRef} />}
              <Row label="Rule" value={<span className="font-mono text-xs">{detail.ruleCode}</span>} />
              {Object.entries(detail.details).map(([k, v]) => (
                <Row key={k} label={summaryLabel(k)} value={<pre className="whitespace-pre-wrap break-all font-mono text-xs">{typeof v === 'string' ? v : JSON.stringify(v, null, 2)}</pre>} />
              ))}
              {detail.disposedBy && <Row label="Dispositioned" value={`${detail.disposedBy.name}, ${formatDateTime(detail.disposedAt)}`} />}
              {detail.dispositionNote && <Row label="Note" value={detail.dispositionNote} />}
            </dl>
          </div>
        )}
      </SlideOver>

      {raiseOpen && (
        <RaiseFindingSlideOver
          open={raiseOpen}
          onClose={() => { setRaiseOpen(false); setSelected(new Set()); }}
          run={run}
          exceptions={selectedRows}
        />
      )}
    </Card>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }): JSX.Element => (
  <div className="grid grid-cols-3 gap-3 border-b border-border/60 pb-2">
    <dt className="text-xs text-text-secondary">{label}</dt>
    <dd className="col-span-2 text-text-primary">{value}</dd>
  </div>
);
