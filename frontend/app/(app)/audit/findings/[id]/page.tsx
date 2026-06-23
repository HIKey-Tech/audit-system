'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select } from '@/components/ui/Input';
import { findingsApi, followUpApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { cn } from '@/lib/utils/cn';

const STATUSES = ['open', 'management_response_received', 'in_remediation', 'verified'] as const;

export default function FindingDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canChangeStatus = hasPermission('finding:update');
  const canClose = hasPermission('finding:close');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['findings', params?.id],
    queryFn: () => findingsApi.get(params!.id),
    enabled: Boolean(params?.id),
  });

  const followUp = useQuery({
    queryKey: ['findings', params?.id, 'follow-up'],
    queryFn: () => followUpApi.getByFinding(params!.id).catch(() => null),
    enabled: Boolean(params?.id),
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => findingsApi.updateStatus(params!.id, status),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['findings', params!.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const requestClosure = useMutation({
    mutationFn: () => findingsApi.close(params!.id),
    onSuccess: () => {
      toast.success('Finding closure sent for approval');
      qc.invalidateQueries({ queryKey: ['findings', params!.id] });
      qc.invalidateQueries({ queryKey: ['workflow', 'approvals'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  if (isError) {
    return (
      <div>
        <PageHeader title="Finding" breadcrumbs={[{ label: 'Findings', href: '/audit/findings' }]} />
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Loading…" breadcrumbs={[{ label: 'Findings', href: '/audit/findings' }]} />
        <Card>
          <Skeleton className="h-4 w-1/3 mb-3" />
          <Skeleton className="h-3 w-2/3" />
        </Card>
      </div>
    );
  }

  const overdue = new Date(data.dueDate) < new Date() && !['verified', 'pending_closure', 'closed'].includes(data.status);

  return (
    <div>
      <PageHeader
        title={data.title}
        breadcrumbs={[
          { label: 'Findings', href: '/audit/findings' },
          { label: data.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/audit/findings">
              <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            </Link>
            {canChangeStatus && (
              <div className="w-48">
                <Select
                  value={data.status}
                  onChange={(e) => updateStatus.mutate(e.target.value)}
                  disabled={updateStatus.isPending}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanizeStatus(s)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {canClose && data.status === 'verified' && (
              <Button
                size="sm"
                onClick={() => requestClosure.mutate()}
                isLoading={requestClosure.isPending}
              >
                Request closure
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Overview" />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Severity</dt>
              <dd className="mt-1"><StatusBadge status={data.severity} /></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Status</dt>
              <dd className="mt-1"><StatusBadge status={data.status} /></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Category</dt>
              <dd className="mt-1"><Badge tone="gray">{humanizeStatus(data.category)}</Badge></dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Engagement</dt>
              <dd className="mt-1">
                <Link
                  href={`/audit/engagements/${data.engagementId}`}
                  className="font-mono text-xs text-primary hover:underline"
                >
                  {data.engagementReference}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Auditee</dt>
              <dd className="mt-1 text-sm text-text-primary">
                {data.auditeeName}
                {data.additionalAuditees && data.additionalAuditees.length > 0 && (
                  <span className="text-text-secondary">
                    {', '}
                    {data.additionalAuditees.map((a) => a.name ?? a.id).join(', ')}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Due date</dt>
              <dd className={cn('mt-1 text-sm', overdue ? 'text-danger font-medium' : 'text-text-primary')}>
                {formatDate(data.dueDate)}{overdue && ' · Overdue'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Description</dt>
              <dd className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{data.description}</dd>
            </div>
            {data.rootCause && (
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Root cause</dt>
                <dd className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{data.rootCause}</dd>
              </div>
            )}
            {data.riskImplication && (
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Risk implication</dt>
                <dd className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{data.riskImplication}</dd>
              </div>
            )}
            {data.recommendation && (
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Recommendation</dt>
                <dd className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{data.recommendation}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Follow-up" />
          {!followUp.data ? (
            <p className="text-xs text-text-muted">No follow-up recorded yet.</p>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Verification</p>
                <StatusBadge status={followUp.data.verificationStatus} />
              </div>
              {followUp.data.managementResponse && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Management response</p>
                  <p className="text-text-primary whitespace-pre-wrap mt-1">{followUp.data.managementResponse}</p>
                </div>
              )}
              {followUp.data.verificationNotes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Verifier notes</p>
                  <p className="text-text-primary whitespace-pre-wrap mt-1">{followUp.data.verificationNotes}</p>
                </div>
              )}
              {followUp.data.verifiedByName && (
                <p className="text-text-muted">Verified by {followUp.data.verifiedByName}</p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
