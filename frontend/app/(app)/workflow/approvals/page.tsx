'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Send, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { workflowApi } from '@/lib/api/workflow';
import type { WorkflowApproval } from '@/lib/types/domain';
import { ApproveSignPanel } from '@/components/workflow/ApproveSignPanel';
import { SignedApprovalDocuments } from '@/components/workflow/SignedApprovalDocuments';
import { formatRelative } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { cn } from '@/lib/utils/cn';

/** Where to inspect the record awaiting approval before signing off on it. */
const entityHref = (a: WorkflowApproval): string | null => {
  if (a.entityType === 'audit_plan') return `/audit/plans/${a.entityId}`;
  if (a.entityType === 'audit_finding_closure') return `/audit/findings/${a.entityId}`;
  if (a.engagementId) return `/audit/engagements/${a.engagementId}`;
  return null;
};

const submitterName = (a: WorkflowApproval): string => a.submittedBy?.displayName ?? 'Unknown';

export default function ApprovalsPage(): JSX.Element {
  const qc = useQueryClient();
  const [view, setView] = useState<'inbox' | 'history'>('inbox');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [historySearch, setHistorySearch] = useState('');

  const pending = useQuery({
    queryKey: ['workflow', 'pending'],
    queryFn: () => workflowApi.listPending(),
  });

  const history = useQuery({
    queryKey: ['workflow', 'history'],
    queryFn: () => workflowApi.listHistory(),
    enabled: view === 'history',
  });

  const filteredHistory = useMemo(() => {
    let items = history.data ?? [];
    if (historyFilter !== 'all') {
      items = items.filter((a) => a.status === historyFilter);
    }
    if (historySearch.trim()) {
      const q = historySearch.trim().toLowerCase();
      items = items.filter(
        (a) =>
          (a.entityTitle?.toLowerCase().includes(q) ?? false) ||
          a.entityType.toLowerCase().includes(q) ||
          (a.submittedBy?.displayName?.toLowerCase().includes(q) ?? false),
      );
    }
    return items;
  }, [history.data, historyFilter, historySearch]);

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => workflowApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Rejected');
      qc.invalidateQueries({ queryKey: ['workflow'] });
      setRejectingId(null);
      setRejectReason('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const approvals = pending.data;

  return (
    <div>
      <PageHeader
        title="Review/Approval"
        subtitle="Audit records (programmes, engagements, reviews) awaiting your sign-off."
        actions={
          <Link href="/requests">
            <Button variant="secondary" size="sm" leftIcon={<Send className="h-4 w-4" />}>
              Requests history
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-border">
        {(['inbox', 'history'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              view === v
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {v === 'inbox' ? 'Pending inbox' : 'History'}
          </button>
        ))}
      </div>

      {view === 'history' ? (
        history.isLoading ? (
          <Card>
            <Skeleton className="h-12 w-full" />
          </Card>
        ) : !history.data || history.data.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Inbox className="h-4 w-4" />}
              title="No approval history yet"
              description="Approvals you submit or action will appear here once completed."
            />
          </Card>
        ) : (
          <div>
            {/* Filter pills & search */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'approved', label: 'Approved' },
                    { key: 'rejected', label: 'Rejected' },
                  ] as const
                ).map((chip) => {
                  const count =
                    chip.key === 'all'
                      ? history.data.length
                      : history.data.filter((i) => i.status === chip.key).length;
                  const isSelected = historyFilter === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setHistoryFilter(chip.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer',
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-surface-alt text-text-secondary hover:bg-slate-200 hover:text-text-primary',
                      )}
                    >
                      <span>{chip.label}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-text-muted',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Filter history..."
                  className="h-8 w-full rounded-md border border-border bg-white pl-8 pr-7 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Inbox className="h-4 w-4" />}
                  title="No matching history items"
                  description="Try adjusting your filter or search query."
                />
              </Card>
            ) : (
              <Card padded={false}>
                <ul className="divide-y divide-border">
                  {filteredHistory.map((a) => (
                <li key={a.id} className="px-5 py-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="gray">{humanizeStatus(a.entityType)}</Badge>
                        {a.entityTitle && (
                          <span className="text-sm font-medium text-text-primary truncate">{a.entityTitle}</span>
                        )}
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">
                        Submitted by {submitterName(a)} · {formatRelative(a.updatedAt)}
                      </p>
                      {a.rejectionReason && (
                        <p className="mt-1 text-xs text-danger">Reason: {a.rejectionReason}</p>
                      )}
                    </div>
                    {entityHref(a) && (
                      <Link href={entityHref(a)!} className="text-xs font-medium text-primary hover:underline">
                        View
                      </Link>
                    )}
                  </div>
                  {a.status === 'approved' && (
                    <div className="pt-1">
                      <SignedApprovalDocuments approvalId={a.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    )
      ) : pending.isLoading ? (
        <Card>
          <Skeleton className="h-12 w-full" />
        </Card>
      ) : !approvals || approvals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="h-4 w-4" />}
            title="Your approval inbox is empty"
            description="New requests appear here when they reach your level."
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-border">
            {approvals.map((a) => {
              const days = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              const isStale = days > 3;
              return (
                <li key={a.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="gray">{humanizeStatus(a.entityType)}</Badge>
                        {a.entityTitle && (
                          <span className="text-sm font-medium text-text-primary truncate">{a.entityTitle}</span>
                        )}
                        <span className="text-xs text-text-secondary">
                          Level {a.currentLevel}
                          {a.steps?.length ? ` of ${a.steps.length}` : ''}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">
                        Submitted by {submitterName(a)} · {formatRelative(a.createdAt)}
                        {entityHref(a) && (
                          <>
                            {' · '}
                            <Link href={entityHref(a)!} className="font-medium text-primary hover:underline">
                              Review before signing
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={cn('text-xs', isStale ? 'font-medium text-danger' : 'text-text-secondary')}
                    >
                      {days}d waiting
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => {
                          setApprovingId((cur) => (cur === a.id ? null : a.id));
                          setRejectingId(null);
                        }}
                      >
                        Approve &amp; Sign
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRejectingId(a.id);
                          setApprovingId(null);
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                  {approvingId === a.id && (
                    <ApproveSignPanel
                      approvalId={a.id}
                      entityType={a.entityType}
                      onDone={() => setApprovingId(null)}
                    />
                  )}
                  {rejectingId === a.id && (
                    <div className="mt-3 rounded-md border border-border bg-surface-alt p-3">
                      <FormField label="Reason" required>
                        <Textarea
                          rows={3}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Explain why this is being rejected…"
                        />
                      </FormField>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectReason('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (!rejectReason.trim()) return toast.error('Reason required');
                            reject.mutate({ id: a.id, reason: rejectReason.trim() });
                          }}
                          isLoading={reject.isPending}
                        >
                          Submit rejection
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
