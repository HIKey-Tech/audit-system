'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Send } from 'lucide-react';
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
import { ApproveSignPanel } from '@/components/workflow/ApproveSignPanel';
import { formatRelative } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { cn } from '@/lib/utils/cn';

export default function ApprovalsPage(): JSX.Element {
  const qc = useQueryClient();
  const [view, setView] = useState<'inbox' | 'history'>('inbox');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const pending = useQuery({
    queryKey: ['workflow', 'pending'],
    queryFn: () => workflowApi.listPending(),
  });

  const history = useQuery({
    queryKey: ['workflow', 'history'],
    queryFn: () => workflowApi.listHistory(),
    enabled: view === 'history',
  });

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
        title="Audit Approvals"
        subtitle="Audit records (plans, engagements, reports) awaiting your sign-off."
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
          <Card padded={false}>
            <ul className="divide-y divide-border">
              {history.data.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="gray">{humanizeStatus(a.entityType)}</Badge>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      Submitted by {a.submittedByName} · {formatRelative(a.updatedAt)}
                    </p>
                    {a.rejectionReason && (
                      <p className="mt-1 text-xs text-danger">Reason: {a.rejectionReason}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
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
                        <span className="text-sm font-medium text-text-primary">
                          Level {a.currentLevel} of {a.totalLevels}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">
                        Submitted by {a.submittedByName} · {formatRelative(a.createdAt)}
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
