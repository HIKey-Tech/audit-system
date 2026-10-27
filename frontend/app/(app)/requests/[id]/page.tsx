'use client';

import { useState, useRef } from 'react';
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
  Eye,
  FileSpreadsheet,
  Presentation,
  Upload,
  Image as ImageIcon,
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
import { CopyButton } from '@/components/ui/CopyButton';
import { SignaturePad } from '@/components/common/SignaturePad';
import { DocumentSignerModal } from '@/components/workflow/DocumentSignerModal';
import { requestsApi } from '@/lib/api/workflow';
import { signatureApi } from '@/lib/api/signature';
import { formatDateTime, formatRelative, formatFileSize, initialsFromName } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { useSession } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils/cn';
import type { RequestAction, SignatureVerification, WorkflowRequest } from '@/lib/types/domain';

function getFileBadge(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return {
      Icon: FileSpreadsheet,
      label: ext.toUpperCase(),
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconColor: 'text-emerald-600',
    };
  }
  if (['pptx', 'ppt'].includes(ext)) {
    return {
      Icon: Presentation,
      label: ext.toUpperCase(),
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      iconColor: 'text-amber-600',
    };
  }
  if (['docx', 'doc'].includes(ext)) {
    return {
      Icon: FileText,
      label: ext.toUpperCase(),
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      iconColor: 'text-blue-600',
    };
  }
  if (ext === 'pdf') {
    return {
      Icon: FileCheck2,
      label: 'PDF',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      iconColor: 'text-rose-600',
    };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
    return {
      Icon: ImageIcon,
      label: ext.toUpperCase(),
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      iconColor: 'text-purple-600',
    };
  }
  return {
    Icon: Paperclip,
    label: ext.toUpperCase() || 'FILE',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    iconColor: 'text-slate-600',
  };
}

export default function RequestDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const session = useSession();
  const qc = useQueryClient();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [comment, setComment] = useState('');
  const [signOpen, setSignOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{ id: string; name: string; isSignable: boolean } | null>(null);

  const { data: req, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['request', id],
    queryFn: () => requestsApi.get(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['request', id] });
    qc.invalidateQueries({ queryKey: ['requests'] });
  };

  const handleFileUpload = async (filesToUpload: FileList | File[]) => {
    const list = Array.from(filesToUpload);
    if (list.length === 0) return;
    setUploadingFiles(true);
    let successCount = 0;
    for (const file of list) {
      try {
        await requestsApi.addAttachment(id, file);
        successCount++;
      } catch (e) {
        toast.error(`Failed to upload ${file.name}: ${e instanceof Error ? e.message : 'Upload failed'}`);
      }
    }
    setUploadingFiles(false);
    if (successCount > 0) {
      toast.success(`${successCount} file(s) attached successfully`);
      invalidate();
    }
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
    return <ErrorState title="Could not load request" error={error} onRetry={() => refetch()} />;
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-alt border border-border px-2.5 py-1 font-mono text-xs font-semibold text-text-primary shadow-2xs">
          {req.referenceNumber}
          <CopyButton value={req.referenceNumber} label="reference" />
        </span>
        <StatusBadge status={req.status} withDot />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Action panel */}
          {isMyTurn && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader title="It's your turn" subtitle="Approve, upload requested documents, sign, or reject this request." />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="success"
                  leftIcon={<Check className="h-4 w-4" />}
                  isLoading={approve.isPending}
                  onClick={() => approve.mutate()}
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<Upload className="h-4 w-4" />}
                  isLoading={uploadingFiles}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Document
                </Button>
                <Button
                  leftIcon={<PenLine className="h-4 w-4" />}
                  onClick={() => {
                    const signableAtt = req.attachments?.find((a) =>
                      /\.(pdf|docx?|doc)$/i.test(a.originalName),
                    );
                    if (signableAtt) {
                      setViewerDoc({ id: signableAtt.documentId, name: signableAtt.originalName, isSignable: true });
                    } else {
                      setSignOpen(true);
                    }
                  }}
                >
                  View & Sign Document
                </Button>
                <Button
                  variant="danger"
                  leftIcon={<X className="h-4 w-4" />}
                  onClick={() => setRejecting((v) => !v)}
                >
                  Reject
                </Button>
              </div>
              <p className="mt-2.5 text-xs text-text-secondary">
                💡 Asked to provide or send a document? Click <strong className="text-text-primary">Upload Document</strong> to attach your Excel spreadsheet (.xlsx), presentation (.pptx), Word document, or PDF.
              </p>
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
              action={
                isParticipant && req.status === 'pending' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Upload className="h-3.5 w-3.5" />}
                    isLoading={uploadingFiles}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload file
                  </Button>
                ) : undefined
              }
            />

            <input
              type="file"
              ref={fileInputRef}
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFileUpload(e.target.files);
                e.target.value = '';
              }}
            />

            {req.attachments && req.attachments.length > 0 ? (
              <ul className="space-y-2">
                {req.attachments.map((a) => {
                  const isSignable = /\.(pdf|docx?|doc)$/i.test(a.originalName);
                  const badge = getFileBadge(a.originalName);
                  const IconComp = badge.Icon;
                  return (
                    <li
                      key={a.documentId}
                      className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 bg-white hover:bg-slate-50/50 transition-colors shadow-2xs"
                    >
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md border', badge.badgeClass)}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-text-primary">
                            {a.originalName}
                          </span>
                          <span className={cn('rounded px-1.5 py-0.2 text-[10px] font-bold border', badge.badgeClass)}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-xs text-text-secondary">{formatFileSize(a.fileSize)}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isSignable && (
                          <button
                            type="button"
                            onClick={() => setViewerDoc({ id: a.documentId, name: a.originalName, isSignable: false })}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-2 py-1 rounded hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </button>
                        )}
                        {isSignable && isMyTurn && (
                          <button
                            type="button"
                            onClick={() => setViewerDoc({ id: a.documentId, name: a.originalName, isSignable: true })}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200"
                          >
                            <PenLine className="h-3.5 w-3.5" /> View & Sign
                          </button>
                        )}
                        <a
                          href={`/api/proxy/documents/${a.documentId}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-primary hover:underline px-2 py-1 rounded bg-slate-100 hover:bg-slate-200"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Paperclip className="h-4 w-4" /> No attachments yet.
              </p>
            )}

            {/* Dropzone for participants when request is pending */}
            {isParticipant && req.status === 'pending' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
                }}
                className={cn(
                  'mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center transition-all',
                  isDragging
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/60 hover:bg-slate-50/80',
                  uploadingFiles && 'pointer-events-none opacity-60',
                )}
              >
                <Upload className="h-5 w-5 text-text-secondary" />
                <p className="text-xs font-semibold text-text-primary">
                  {uploadingFiles ? 'Uploading documents…' : 'Click to browse or drag & drop files here'}
                </p>
                <p className="text-[11px] text-text-secondary">
                  Supports Excel (.xlsx, .xls), PowerPoint (.pptx, .ppt), Word (.docx), PDF, CSV, images — up to 50 MB
                </p>
              </div>
            )}
          </Card>

          {/* Signed documents (generated on completion) */}
          {req.status === 'completed' && (
            <SignedDocumentsCard
              requestId={id}
              onPreviewDoc={(d) => setViewerDoc({ id: d.id, name: d.name, isSignable: false })}
            />
          )}

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

      {viewerDoc && (
        <DocumentSignerModal
          open={Boolean(viewerDoc)}
          onClose={() => setViewerDoc(null)}
          documentId={viewerDoc.id}
          documentName={viewerDoc.name}
          requestId={id}
          isSignable={viewerDoc.isSignable}
          onApprove={isMyTurn ? () => approve.mutate() : undefined}
          isApproving={approve.isPending}
          onSigned={() => {
            setViewerDoc(null);
            invalidate();
          }}
        />
      )}
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

  const iconFor = (a: RequestAction): JSX.Element => {
    if (a.actionType === 'sign') return <PenLine className="h-3.5 w-3.5 text-primary" />;
    if (a.actionType === 'approve') return <Check className="h-3.5 w-3.5 text-success" />;
    if (a.actionType === 'reject') return <X className="h-3.5 w-3.5 text-danger" />;
    if (a.comment?.toLowerCase().includes('uploaded document') || a.comment?.toLowerCase().includes('attached document')) {
      return <Upload className="h-3.5 w-3.5 text-emerald-600" />;
    }
    return <MessageSquare className="h-3.5 w-3.5 text-text-secondary" />;
  };

  const verbFor = (a: RequestAction): string => {
    if (a.actionType === 'sign') return 'signed';
    if (a.actionType === 'approve') return 'approved';
    if (a.actionType === 'reject') return 'rejected';
    if (a.comment?.toLowerCase().includes('uploaded document') || a.comment?.toLowerCase().includes('attached document')) {
      return 'uploaded a document';
    }
    return 'commented';
  };

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {actions.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[27px] flex h-6 w-6 items-center justify-center rounded-full bg-surface ring-1 ring-border">
            {iconFor(a)}
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
                <span className="text-text-secondary">{verbFor(a)}</span>
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

const SignedDocumentsCard = ({
  requestId,
  onPreviewDoc,
}: {
  requestId: string;
  onPreviewDoc?: (doc: { id: string; name: string }) => void;
}): JSX.Element | null => {
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
        subtitle="Official documents stamped with signatures and cryptographic verification."
      />
      <ul className="space-y-1.5">
        {data.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-2 bg-emerald-50/20"
          >
            <FileCheck2 className="h-4 w-4 shrink-0 text-success" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
              {d.sourceName ?? 'Signature certificate'}
            </span>
            {onPreviewDoc && (
              <button
                type="button"
                onClick={() => onPreviewDoc({ id: d.signedDocumentId, name: d.sourceName ?? 'Signed Document' })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-1.5 py-0.5 rounded hover:bg-slate-100"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </button>
            )}
            <a
              href={d.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:underline px-1"
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
