'use client';

import { useState } from 'react';
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
import { Select, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { findingsApi, followUpApi } from '@/lib/api/audit';
import { documentsApi } from '@/lib/api/documents';
import { LinkedAssetsCard } from '@/components/common/LinkedAssetsCard';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { cn } from '@/lib/utils/cn';

// Manual, auditor-settable statuses. `verified` is deliberately excluded — it is
// only reachable through the Verify action below, which captures verification
// notes, so a finding can never be marked verified without a recorded rationale.
const STATUSES = ['open', 'management_response_received', 'in_remediation'] as const;
const MANUAL_STATUS_SET = new Set<string>(STATUSES);

export default function FindingDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { hasPermission, user } = usePermissions();
  const canChangeStatus = hasPermission('finding:update');
  const canClose = hasPermission('finding:close');
  const canVerify = hasPermission('followup:verify');

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

  const invalidate = (): void => {
    qc.invalidateQueries({ queryKey: ['findings', params!.id] });
    qc.invalidateQueries({ queryKey: ['findings', params!.id, 'follow-up'] });
  };

  const updateStatus = useMutation({
    mutationFn: (status: string) => findingsApi.updateStatus(params!.id, status),
    onSuccess: () => {
      toast.success('Status updated');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const requestClosure = useMutation({
    mutationFn: () => findingsApi.close(params!.id),
    onSuccess: () => {
      toast.success('Finding closure sent for approval');
      invalidate();
      qc.invalidateQueries({ queryKey: ['workflow', 'approvals'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  // ── Follow-up actions ────────────────────────────────────────
  const [response, setResponse] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [verification, setVerification] = useState<'verified' | 'rejected'>('verified');
  const [notes, setNotes] = useState('');

  const submitResponse = useMutation({
    mutationFn: () => followUpApi.submitResponse(params!.id, { managementResponse: response }),
    onSuccess: () => {
      toast.success('Management response submitted');
      setResponse('');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const uploadEvidence = useMutation({
    mutationFn: () => followUpApi.uploadEvidence(params!.id, evidenceFile!),
    onSuccess: () => {
      toast.success('Remediation evidence uploaded');
      setEvidenceFile(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const submitVerify = useMutation({
    mutationFn: () =>
      followUpApi.verify(params!.id, {
        verificationStatus: verification,
        verificationNotes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Verification recorded');
      setNotes('');
      invalidate();
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

  // Who may act on the follow-up. The auditee (or a co-responder) submits the
  // management response and remediation evidence; the audit team verifies.
  const isResponder =
    data.auditeeId === user.id ||
    (data.additionalAuditees ?? []).some((a) => a.id === user.id);
  const canRespond = isResponder && hasPermission('followup:respond');
  const canSubmitEvidence = isResponder && hasPermission('followup:evidence');
  const isSettled = ['pending_closure', 'closed'].includes(data.status);
  // The manual status dropdown only makes sense before verification. Afterwards
  // the status is driven by the Verify action and the closure workflow.
  const showStatusDropdown = canChangeStatus && MANUAL_STATUS_SET.has(data.status);

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
            {showStatusDropdown && (
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
            {data.controlReference && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Raised from control</dt>
                <dd className="mt-1 text-sm text-text-primary" title={data.controlDescription}>
                  <span className="font-mono text-xs">{data.controlReference}</span>
                  {data.controlDescription && (
                    <span className="text-text-secondary"> — {data.controlDescription}</span>
                  )}
                </dd>
              </div>
            )}
            {data.riskTitle && data.riskId && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Linked risk</dt>
                <dd className="mt-1 text-sm">
                  <Link href={`/risk/${data.riskId}`} className="text-primary hover:underline">
                    {data.riskTitle}
                  </Link>
                </dd>
              </div>
            )}
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
          <div className="space-y-4 text-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Verification</p>
              <StatusBadge status={followUp.data?.verificationStatus ?? 'pending'} />
            </div>

            {followUp.data?.managementResponse && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Management response</p>
                <p className="text-text-primary whitespace-pre-wrap mt-1">{followUp.data.managementResponse}</p>
              </div>
            )}
            {followUp.data?.remediationEvidence && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Remediation evidence</p>
                <a
                  href={documentsApi.downloadUrl(followUp.data.remediationEvidence.documentId)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {followUp.data.remediationEvidence.fileName}
                </a>
              </div>
            )}
            {followUp.data?.verificationNotes && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Verifier notes</p>
                <p className="text-text-primary whitespace-pre-wrap mt-1">{followUp.data.verificationNotes}</p>
              </div>
            )}
            {followUp.data?.verifiedByName && (
              <p className="text-text-muted">Verified by {followUp.data.verifiedByName}</p>
            )}

            {/* Auditee: submit a management response */}
            {canRespond && !isSettled && (
              <div className="rounded-md border border-border bg-surface-alt p-3">
                <FormField label="Management response" required>
                  <Textarea
                    rows={4}
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Describe planned remediation and timeline…"
                  />
                </FormField>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!response.trim()) {
                        toast.error('Response cannot be empty');
                        return;
                      }
                      submitResponse.mutate();
                    }}
                    isLoading={submitResponse.isPending}
                  >
                    Submit response
                  </Button>
                </div>
              </div>
            )}

            {/* Auditee: upload remediation evidence */}
            {canSubmitEvidence && !isSettled && (
              <div className="rounded-md border border-border bg-surface-alt p-3">
                <FormField label="Remediation evidence">
                  <input
                    type="file"
                    onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-md border border-border bg-white px-3 py-2 text-xs text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  />
                </FormField>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!evidenceFile) {
                        toast.error('Choose a file to upload');
                        return;
                      }
                      uploadEvidence.mutate();
                    }}
                    isLoading={uploadEvidence.isPending}
                  >
                    Upload evidence
                  </Button>
                </div>
              </div>
            )}

            {/* Audit team: verify or reject remediation */}
            {canVerify && !isSettled && followUp.data && (
              <div className="rounded-md border border-border bg-surface-alt p-3">
                <FormField label="Verification">
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="verify"
                        checked={verification === 'verified'}
                        onChange={() => setVerification('verified')}
                      />
                      Verified
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="verify"
                        checked={verification === 'rejected'}
                        onChange={() => setVerification('rejected')}
                      />
                      Rejected
                    </label>
                  </div>
                </FormField>
                <FormField label="Notes">
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How remediation was verified…" />
                </FormField>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={() => submitVerify.mutate()} isLoading={submitVerify.isPending}>
                    Save verification
                  </Button>
                </div>
              </div>
            )}

            {!followUp.data && !canRespond && !canSubmitEvidence && !canVerify && (
              <p className="text-xs text-text-muted">No follow-up recorded yet.</p>
            )}
          </div>
        </Card>

        <LinkedAssetsCard scope="finding" id={params!.id} />
      </div>
    </div>
  );
}
