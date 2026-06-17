'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Paperclip,
  FileText,
  PenLine,
  MessageSquare,
  ShieldCheck,
  Ban,
  Check,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  FileCheck2,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SlideOver } from '@/components/ui/SlideOver';
import { Avatar } from '@/components/ui/Avatar';
import { SignaturePad } from '@/components/common/SignaturePad';
import { requestsApi } from '@/lib/api/workflow';
import { signatureApi } from '@/lib/api/signature';
import { formatDateTime, formatRelative, formatFileSize, initialsFromName } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { useSession } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils/cn';
import type { RequestAction, SignatureVerification, WorkflowRequest } from '@/lib/types/domain';

export default function RequestDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const session = useSession();
  const qc = useQueryClient();
  const router = useRouter();

  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [comment, setComment] = useState('');
  const [signOpen, setSignOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const { data: req, isLoading, isError, refetch } = useQuery({
    queryKey: ['request', id],
    queryFn: () => requestsApi.get(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['request', id] });
    qc.invalidateQueries({ queryKey: ['requests'] });
  };

  const approve = useMutation({
    mutationFn: () => requestsApi.approve(id),
    onSuccess: () => {
      toast.success('Approved');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const reject = useMutation({
    mutationFn: () => requestsApi.reject(id, rejectReason.trim()),
    onSuccess: () => {
      toast.success('Rejected');
      setRejecting(false);
      setRejectReason('');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const addComment = useMutation({
    mutationFn: () => requestsApi.comment(id, comment.trim()),
    onSuccess: () => {
      toast.success('Comment added');
      setComment('');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const cancel = useMutation({
    mutationFn: () => requestsApi.cancel(id),
    onSuccess: () => {
      toast.success('Request cancelled');
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="mb-4 h-8 w-64" />
        <Card>
          <Skeleton className="h-40 w-full" />
        </Card>
      </div>
    );
  }

  if (isError || !req) {
    return <ErrorState title="Could not load request" onRetry={() => refetch()} />;
  }

  const currentStep = req.steps?.find((s) => s.level === req.currentLevel);
  const isInitiator = req.initiatorId === session.id;
  const isParticipant = isInitiator || (req.steps?.some((s) => s.recipientId === session.id) ?? false);
  const isMyTurn =
    req.status === 'pending' && currentStep?.recipientId === session.id && currentStep?.status === 'pending';
  const myFullName = session.displayName?.trim() || `${session.firstName} ${session.lastName}`.trim();

  return (
    <div>
      <Link
        href="/requests"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to requests
      </Link>

      <PageHeader
        title={req.title}
        breadcrumbs={[{ label: 'Requests', href: '/requests' }]}
        subtitle={`${req.referenceNumber} · from ${req.initiator?.displayName ?? 'someone'} · ${formatRelative(req.createdAt)}`}
        actions={
          isInitiator && req.status === 'pending' ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Ban className="h-4 w-4" />}
              isLoading={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Cancel request
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <StatusBadge status={req.status} withDot />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Action panel */}
          {isMyTurn && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader title="It's your turn" subtitle="Approve, sign, or reject this request." />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="success"
                  leftIcon={<Check className="h-4 w-4" />}
                  isLoading={approve.isPending}
                  onClick={() => approve.mutate()}
                >
                  Approve
                </Button>
                <Button leftIcon={<PenLine className="h-4 w-4" />} onClick={() => setSignOpen(true)}>
                  Sign
                </Button>
                <Button
                  variant="danger"
                  leftIcon={<X className="h-4 w-4" />}
                  onClick={() => setRejecting((v) => !v)}
                >
                  Reject
                </Button>
              </div>
              {rejecting && (
                <div className="mt-3 rounded-md border border-border bg-white p-3">
                  <FormField label="Reason for rejection" required>
                    <Textarea
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why you are rejecting this request…"
                    />
                  </FormField>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      isLoading={reject.isPending}
                      onClick={() => {
                        if (!rejectReason.trim()) return toast.error('Reason required');
                        reject.mutate();
                      }}
                    >
                      Submit rejection
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Description */}
          <Card>
            <CardHeader title="Details" />
            <p className="whitespace-pre-wrap text-sm text-text-primary">
              {req.description || <span className="text-text-secondary">No description provided.</span>}
            </p>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader
              title="Attachments"
              subtitle={`${req.attachments?.length ?? 0} file(s)`}
            />
            {req.attachments && req.attachments.length > 0 ? (
              <ul className="space-y-1.5">
                {req.attachments.map((a) => (
                  <li
                    key={a.documentId}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-text-secondary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{a.originalName}</span>
                    <span className="text-xs text-text-secondary">{formatFileSize(a.fileSize)}</span>
                    <a
                      href={`/api/proxy/documents/${a.documentId}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Paperclip className="h-4 w-4" /> No attachments.
              </p>
            )}
          </Card>

          {/* Signed documents (generated on completion) */}
          {req.status === 'completed' && <SignedDocumentsCard requestId={id} />}

          {/* Activity timeline */}
          <Card>
            <CardHeader
              title="Activity"
              subtitle="Comments and signatures, most recent last."
              action={
                <Button variant="ghost" size="sm" onClick={() => setVerifyOpen(true)}>
                  Verify signatures
                </Button>
              }
            />
            <ActivityTimeline actions={req.actions ?? []} />

            {/* Comment box */}
            {isParticipant && req.status === 'pending' && (
              <div className="mt-4 border-t border-border pt-4">
                <FormField label="Add a comment">
                  <Textarea
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Leave a note for the initiator and current recipient…"
                  />
                </FormField>
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<MessageSquare className="h-3.5 w-3.5" />}
                    isLoading={addComment.isPending}
                    onClick={() => {
                      if (!comment.trim()) return;
                      addComment.mutate();
                    }}
                  >
                    Comment
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Recipient chain */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Recipients" subtitle="They act in this order." />
            <ol className="space-y-3">
              {req.steps?.map((s) => {
                const isCurrent = s.level === req.currentLevel && req.status === 'pending';
                return (
                  <li key={s.id} className="flex items-start gap-3">
                    <StepIcon status={s.status} isCurrent={isCurrent} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text-primary">
                          {s.recipient?.displayName ?? 'Recipient'}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-secondary">
                        Step {s.level} · {humanizeStatus(s.status)}
                        {s.actedAt ? ` · ${formatRelative(s.actedAt)}` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>

      <SignModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        requestId={id}
        expectedName={myFullName}
        request={req}
        onSigned={invalidate}
      />

      <VerifyModal open={verifyOpen} onClose={() => setVerifyOpen(false)} requestId={id} request={req} />
    </div>
  );
}

const StepIcon = ({ status, isCurrent }: { status: string; isCurrent: boolean }): JSX.Element => {
  if (status === 'approved' || status === 'signed') {
    return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />;
  }
  if (status === 'rejected') {
    return <X className="mt-0.5 h-5 w-5 shrink-0 text-danger" />;
  }
  return (
    <Clock
      className={cn('mt-0.5 h-5 w-5 shrink-0', isCurrent ? 'text-amber-600' : 'text-text-secondary')}
    />
  );
};

const ActivityTimeline = ({ actions }: { actions: RequestAction[] }): JSX.Element => {
  if (actions.length === 0) {
    return <p className="text-sm text-text-secondary">No activity yet.</p>;
  }

  const iconFor = (t: string): JSX.Element => {
    if (t === 'sign') return <PenLine className="h-3.5 w-3.5 text-primary" />;
    if (t === 'approve') return <Check className="h-3.5 w-3.5 text-success" />;
    if (t === 'reject') return <X className="h-3.5 w-3.5 text-danger" />;
    return <MessageSquare className="h-3.5 w-3.5 text-text-secondary" />;
  };

  const verbFor = (t: string): string =>
    t === 'sign' ? 'signed' : t === 'approve' ? 'approved' : t === 'reject' ? 'rejected' : 'commented';

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {actions.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[27px] flex h-6 w-6 items-center justify-center rounded-full bg-surface ring-1 ring-border">
            {iconFor(a.actionType)}
          </span>
          <div className="flex items-center gap-2">
            <Avatar
              initials={initialsFromName(a.actor?.firstName, a.actor?.lastName, a.actor?.displayName)}
              size="sm"
              tone="slate"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary">
                <span className="font-medium">{a.actor?.displayName ?? 'Someone'}</span>{' '}
                <span className="text-text-secondary">{verbFor(a.actionType)}</span>
              </p>
              <p className="text-[11px] text-text-secondary">{formatDateTime(a.createdAt)}</p>
            </div>
          </div>
          {a.comment && (
            <p className="mt-1 whitespace-pre-wrap rounded-md bg-surface-alt px-3 py-2 text-sm text-text-primary">
              {a.comment}
            </p>
          )}
          {a.actionType === 'sign' && a.signatureHash && (
            <p className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-text-secondary">
              <ShieldCheck className="h-3 w-3 text-success" />
              {a.signatureHash.slice(0, 24)}…
            </p>
          )}
        </li>
      ))}
    </ol>
  );
};

const SignModal = ({
  open,
  onClose,
  requestId,
  expectedName,
  request,
  onSigned,
}: {
  open: boolean;
  onClose: () => void;
  requestId: string;
  expectedName: string;
  request: WorkflowRequest;
  onSigned: () => void;
}): JSX.Element => {
  const [affirmation, setAffirmation] = useState('');
  const [comment, setComment] = useState('');
  const qc = useQueryClient();

  // Inline signature setup: a stamped image is required before signing. If the user
  // has none, they create one here (saved to their profile); the backend records the
  // active signature's id at sign time — no extra payload needed.
  const { data: sig, isLoading: sigLoading } = useQuery({
    queryKey: ['signature'],
    queryFn: () => signatureApi.get(),
    enabled: open,
  });

  const saveSig = useMutation({
    mutationFn: ({ blob, kind }: { blob: Blob; kind: 'drawn' | 'uploaded' }) =>
      signatureApi.save(blob, kind),
    onSuccess: () => {
      toast.success('Signature saved');
      qc.invalidateQueries({ queryKey: ['signature'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save signature'),
  });

  const sign = useMutation({
    mutationFn: () => requestsApi.sign(requestId, affirmation.trim(), comment.trim() || undefined),
    onSuccess: () => {
      toast.success('Signed');
      setAffirmation('');
      setComment('');
      onSigned();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to sign'),
  });

  const matches = affirmation.trim().toLowerCase() === expectedName.toLowerCase();

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Sign request"
      description="A signature records your identity, the time, and a hash of the exact content."
      width="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!matches || !sig}
            isLoading={sign.isPending}
            onClick={() => sign.mutate()}
          >
            Sign now
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-border bg-surface-alt px-3 py-3 text-sm">
          <p className="font-medium text-text-primary">{request.title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {request.referenceNumber} · {request.attachments?.length ?? 0} attachment(s)
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            By signing you affirm you have reviewed this request and its attachments. This is recorded in the
            audit trail and cannot be undone.
          </span>
        </div>

        {/* Signature: preview if set up, else inline create */}
        {sigLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : sig ? (
          <div className="rounded-md border border-border bg-white px-3 py-2">
            <p className="mb-1 text-xs font-medium text-text-secondary">Signing as</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sig.imageUrl} alt="Your signature" className="h-14 object-contain" />
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-surface-alt px-3 py-3">
            <p className="mb-2 text-xs text-text-secondary">
              You don’t have a signature yet. Draw or upload one — it’s saved to your profile and stamped
              onto the signed document.
            </p>
            <SignaturePad onChange={(blob, kind) => saveSig.mutate({ blob, kind })} />
          </div>
        )}

        <FormField label={`Type your full name to affirm (${expectedName})`} required>
          <Input
            value={affirmation}
            onChange={(e) => setAffirmation(e.target.value)}
            placeholder={expectedName}
            autoComplete="off"
          />
        </FormField>
        {affirmation.length > 0 && !matches && (
          <p className="text-xs text-danger">Name must match your account name exactly.</p>
        )}

        <FormField label="Comment (optional)">
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note with your signature…"
          />
        </FormField>
      </div>
    </SlideOver>
  );
};

const SignedDocumentsCard = ({ requestId }: { requestId: string }): JSX.Element | null => {
  const { data, isLoading } = useQuery({
    queryKey: ['request', requestId, 'signed'],
    queryFn: () => requestsApi.signedDocuments(requestId),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Signed documents" />
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Signed documents"
        subtitle="Downloadable copies with every signature stamped on a signature page. PDF attachments only."
      />
      <ul className="space-y-1.5">
        {data.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
          >
            <FileCheck2 className="h-4 w-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
              {d.sourceName ?? 'Signature certificate'}
            </span>
            <a
              href={d.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
};

const VerifyModal = ({
  open,
  onClose,
  requestId,
  request,
}: {
  open: boolean;
  onClose: () => void;
  requestId: string;
  request: WorkflowRequest;
}): JSX.Element => {
  const { data, isLoading } = useQuery({
    queryKey: ['request', requestId, 'verify'],
    queryFn: () => requestsApi.verifySignatures(requestId),
    enabled: open,
  });

  const nameFor = (signerId: string): string => {
    const action = request.actions?.find((a) => a.actorId === signerId && a.actionType === 'sign');
    return action?.actor?.displayName ?? signerId.slice(0, 8);
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Signature verification"
      description="Each signature is re-hashed against the current content to detect tampering."
      width="md"
    >
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-text-secondary">This request has no signatures yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((v: SignatureVerification) => (
            <li
              key={v.actionId}
              className={cn(
                'rounded-md border px-3 py-3',
                v.valid ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50',
              )}
            >
              <div className="flex items-center gap-2">
                {v.valid ? (
                  <ShieldCheck className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-danger" />
                )}
                <span className="text-sm font-medium text-text-primary">{nameFor(v.signerId)}</span>
                <span
                  className={cn(
                    'ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    v.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
                  )}
                >
                  {v.valid ? 'Valid' : 'Tampered'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-text-secondary">Signed {formatDateTime(v.signedAt)}</p>
              <p className="mt-1 break-all font-mono text-[11px] text-text-secondary">{v.storedHash}</p>
            </li>
          ))}
        </ul>
      )}
    </SlideOver>
  );
};
