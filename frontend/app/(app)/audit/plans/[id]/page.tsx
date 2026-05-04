'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Send, Check, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Skeleton, ListSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, type Column } from '@/components/ui/Table';
import { SlideOver } from '@/components/ui/SlideOver';
import { Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';

import { plansApi } from '@/lib/api/audit';
import { formatDate, formatRelative } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { AddPlanItemSlideOver } from '@/components/audit/plans/AddPlanItemSlideOver';
import { CreateEngagementSlideOver } from '@/components/audit/plans/CreateEngagementSlideOver';
import type { AuditPlanItem, AuditPlanApprovalStep } from '@/lib/types/domain';

export default function PlanDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { canManageAuditProgramme: canWrite, hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['super_admin', 'audit_admin', 'director', 'cae']);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [createEngOpen, setCreateEngOpen] = useState<{ itemId: string; title: string } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['plans', params.id],
    queryFn: () => plansApi.get(params.id),
    enabled: Boolean(params.id),
  });

  const submitMut = useMutation({
    mutationFn: () => plansApi.submit(params.id),
    onSuccess: () => {
      toast.success('Plan submitted for approval');
      qc.invalidateQueries({ queryKey: ['plans', params.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const approveMut = useMutation({
    mutationFn: () => plansApi.approve(params.id),
    onSuccess: () => {
      toast.success('Plan approved');
      qc.invalidateQueries({ queryKey: ['plans', params.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: (reason: string) => plansApi.reject(params.id, reason),
    onSuccess: () => {
      toast.success('Plan rejected');
      qc.invalidateQueries({ queryKey: ['plans', params.id] });
      setRejectOpen(false);
      setRejectReason('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  if (isError) {
    return (
      <div>
        <PageHeader title="Plan" breadcrumbs={[{ label: 'Audit Plans', href: '/audit/plans' }]} />
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Loading…" breadcrumbs={[{ label: 'Audit Plans', href: '/audit/plans' }]} />
        <div className="space-y-6">
          <Card>
            <Skeleton className="h-4 w-1/3 mb-3" />
            <ListSkeleton rows={4} />
          </Card>
        </div>
      </div>
    );
  }

  const itemColumns: Column<AuditPlanItem>[] = [
    {
      key: 'name',
      header: 'Entity',
      render: (i) => <span className="font-medium text-text-primary">{i.universeName}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (i) => <Badge tone="gray">{humanizeStatus(i.auditType)}</Badge>,
      width: '120px',
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (i) => <StatusBadge status={i.priority} />,
      width: '110px',
    },
    {
      key: 'dates',
      header: 'Planned',
      render: (i) => (
        <span className="text-xs text-text-secondary">
          {formatDate(i.plannedStartDate)} → {formatDate(i.plannedEndDate)}
        </span>
      ),
      width: '200px',
    },
    {
      key: 'engagement',
      header: 'Engagement',
      render: (i) => {
        if (i.engagementCreated && i.engagementId) {
          return (
            <Link
              href={`/audit/engagements/${i.engagementId}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              View
            </Link>
          );
        }
        if (data.status === 'approved' && canWrite) {
          return (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setCreateEngOpen({ itemId: i.id, title: i.universeName });
              }}
            >
              Create
            </Button>
          );
        }
        return <span className="text-text-muted text-xs">Pending plan approval</span>;
      },
      width: '170px',
    },
  ];

  const approvalChain: AuditPlanApprovalStep[] = data.approvalChain ?? [];

  return (
    <div>
      <PageHeader
        title={data.title}
        subtitle={`Year ${data.year}`}
        breadcrumbs={[
          { label: 'Audit Plans', href: '/audit/plans' },
          { label: data.title },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/audit/plans">
              <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            </Link>
            {data.status === 'draft' && canWrite && (
              <Button
                leftIcon={<Send className="h-4 w-4" />}
                onClick={() => submitMut.mutate()}
                isLoading={submitMut.isPending}
              >
                Submit for approval
              </Button>
            )}
            {data.status === 'submitted' && isAdmin && (
              <>
                <Button
                  variant="success"
                  leftIcon={<Check className="h-4 w-4" />}
                  onClick={() => approveMut.mutate()}
                  isLoading={approveMut.isPending}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  leftIcon={<X className="h-4 w-4" />}
                  onClick={() => setRejectOpen(true)}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Plan summary" />
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Status</dt>
              <dd className="mt-1"><StatusBadge status={data.status} /></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Year</dt>
              <dd className="mt-1 text-sm text-text-primary">{data.year}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Items</dt>
              <dd className="mt-1 text-sm text-text-primary">{data.itemsCount}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Approved by</dt>
              <dd className="mt-1 text-sm text-text-primary">{data.approvedByName ?? '—'}</dd>
            </div>
            {data.description && (
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Description</dt>
                <dd className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{data.description}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Approval chain" />
          {approvalChain.length === 0 ? (
            <p className="text-xs text-text-muted">Approval chain appears once the plan is submitted.</p>
          ) : (
            <ol className="space-y-3">
              {approvalChain.map((step) => (
                <li key={step.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ${
                      step.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : step.status === 'rejected'
                          ? 'bg-red-50 text-red-700 ring-red-200'
                          : step.status === 'pending'
                            ? 'bg-amber-50 text-amber-700 ring-amber-200'
                            : 'bg-slate-100 text-slate-700 ring-slate-200'
                    }`}
                  >
                    {step.status === 'approved' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : step.status === 'rejected' ? (
                      <X className="h-3.5 w-3.5" />
                    ) : step.status === 'pending' ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      step.level
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary">
                      Level {step.level} · {step.approverName}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      <StatusBadge status={step.status} size="xs" />
                      {step.decidedAt ? <> · {formatRelative(step.decidedAt)}</> : null}
                    </p>
                    {(step.comment || step.rejectionReason) && (
                      <p className="mt-1 text-xs text-text-secondary whitespace-pre-wrap">
                        {step.rejectionReason || step.comment}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-6" padded={false}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <CardHeader title="Plan items" subtitle="Engagements scheduled within this plan" className="mb-0" />
          {data.status === 'draft' && canWrite && (
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddItemOpen(true)}>
              Add item
            </Button>
          )}
        </div>
        <Table<AuditPlanItem>
          columns={itemColumns}
          data={data.items ?? []}
          rowKey={(r) => r.id}
          density="compact"
          emptyState={<EmptyState compact title="No items yet" description="Add the first auditable entity to this plan." />}
          className="rounded-none border-0 border-t border-border"
        />
      </Card>

      <AddPlanItemSlideOver open={addItemOpen} onClose={() => setAddItemOpen(false)} planId={data.id} />
      {createEngOpen && (
        <CreateEngagementSlideOver
          open
          onClose={() => setCreateEngOpen(null)}
          planId={data.id}
          itemId={createEngOpen.itemId}
          defaultTitle={createEngOpen.title}
        />
      )}

      <SlideOver
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject plan"
        description="Provide a clear reason — the submitter will be notified."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('Reason is required');
                  return;
                }
                rejectMut.mutate(rejectReason.trim());
              }}
              isLoading={rejectMut.isPending}
            >
              Reject plan
            </Button>
          </div>
        }
      >
        <FormField label="Reason" required>
          <Textarea
            rows={6}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why the plan is being returned to the submitter…"
          />
        </FormField>
      </SlideOver>
    </div>
  );
}
