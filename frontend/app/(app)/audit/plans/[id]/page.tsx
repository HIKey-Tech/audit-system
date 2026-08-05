'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Send, Check, X } from 'lucide-react';
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
import { formatDate } from '@/lib/utils/format';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { AddPlanItemSlideOver } from '@/components/audit/plans/AddPlanItemSlideOver';
import { CreateEngagementSlideOver } from '@/components/audit/plans/CreateEngagementSlideOver';
import { ApproveSignPanel } from '@/components/workflow/ApproveSignPanel';
import { SignedApprovalDocuments } from '@/components/workflow/SignedApprovalDocuments';
import { ApprovalChain } from '@/components/audit/engagements/ApprovalChain';
import type { AuditPlanItem } from '@/lib/types/domain';
import { auditTypeLabel } from '@/lib/audit-domains';

export default function PlanDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const qc = useQueryClient();
  const { canManageAuditProgramme: canWrite, hasPermission } = usePermissions();
  const isAdmin = hasPermission('plan:approve');

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [createEngOpen, setCreateEngOpen] = useState<{ itemId: string; title: string } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['plans', id],
    queryFn: () => plansApi.get(id),
    enabled: Boolean(id),
  });

  const submitMut = useMutation({
    mutationFn: () => plansApi.submit(id),
    onSuccess: () => {
      toast.success('Programme submitted for approval');
      qc.invalidateQueries({ queryKey: ['plans', id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: (reason: string) => plansApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Programme rejected');
      qc.invalidateQueries({ queryKey: ['plans', id] });
      setRejectOpen(false);
      setRejectReason('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  if (isError) {
    return (
      <div>
        <PageHeader title="Programme" breadcrumbs={[{ label: 'Audit Programme', href: '/audit/plans' }]} />
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Loading…" breadcrumbs={[{ label: 'Audit Programme', href: '/audit/plans' }]} />
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
      render: (i) => (
        <div className="min-w-0">
          <span className="font-medium text-text-primary">{i.universeName}</span>
          {i.notes && (
            <p className="mt-0.5 text-xs text-text-muted whitespace-pre-wrap">{i.notes}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (i) => <Badge tone="gray">{auditTypeLabel(i.auditType, 'short')}</Badge>,
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
        // Approved but the viewer can't create engagements — say so instead of
        // wrongly implying the programme is still awaiting approval.
        return (
          <span className="text-text-muted text-xs">
            {data.status === 'approved' ? 'No engagement yet' : 'Pending programme approval'}
          </span>
        );
      },
      width: '170px',
    },
  ];

  return (
    <div>
      <PageHeader
        title={data.title}
        subtitle={`Year ${data.year}`}
        breadcrumbs={[
          { label: 'Audit Programme', href: '/audit/plans' },
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
                  onClick={() => setApproveOpen((v) => !v)}
                >
                  Approve &amp; Sign
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

      {approveOpen && data.status === 'submitted' && isAdmin && (
        <div className="mb-6">
          <ApproveSignPanel
            entityType="audit_plan"
            showComment={false}
            approveFn={() => plansApi.approve(id)}
            onDone={() => {
              setApproveOpen(false);
              qc.invalidateQueries({ queryKey: ['plans', id] });
            }}
          />
        </div>
      )}

      {data.status === 'approved' && (
        <div className="mb-6">
          <SignedApprovalDocuments entityType="audit_plan" entityId={id} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Programme summary" />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Status</dt>
              <dd className="mt-1"><StatusBadge status={data.status} /></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Year</dt>
              <dd className="mt-1 text-sm text-text-primary">{data.year}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Plans</dt>
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
          <CardHeader title="Approval chain" subtitle="Who needs to approve, in order" />
          <ApprovalChain entityType="audit_plan" entityId={id} />
          {data.status === 'rejected' && data.rejectionReason && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200 whitespace-pre-wrap">
              Rejected: {data.rejectionReason}
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-6" padded={false}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <CardHeader title="Plans" subtitle="Audits scheduled within this programme" className="mb-0" />
          {data.status === 'draft' && canWrite && (
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddItemOpen(true)}>
              Add plan
            </Button>
          )}
        </div>
        <Table<AuditPlanItem>
          columns={itemColumns}
          data={data.items ?? []}
          rowKey={(r) => r.id}
          density="compact"
          emptyState={<EmptyState compact title="No plans yet" description="Add the first auditable entity to this programme." />}
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
        title="Reject programme"
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
              Reject programme
            </Button>
          </div>
        }
      >
        <FormField label="Reason" required>
          <Textarea
            rows={6}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why the programme is being returned to the submitter…"
          />
        </FormField>
      </SlideOver>
    </div>
  );
}
