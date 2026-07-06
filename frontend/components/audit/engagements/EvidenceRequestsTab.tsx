'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload, FileType2, CheckCircle2, CornerUpLeft, Trash2, Inbox } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { Input, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { evidenceRequestsApi } from '@/lib/api/audit';
import { formatDate, formatRelative } from '@/lib/utils/format';
import { useSession, hasPermission } from '@/components/providers/AuthProvider';
import { cn } from '@/lib/utils/cn';
import type { AuditEngagementDetail, EvidenceRequest } from '@/lib/types/domain';

/**
 * PBC list — the auditor asks the auditee for documents, the auditee uploads
 * against each request, the auditor accepts or returns. Visible to both sides
 * (the API scopes what non-audit-staff can see).
 */
export const EvidenceRequestsTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const session = useSession();
  const canRequest = hasPermission(session, 'evidence:request');

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [returning, setReturning] = useState<EvidenceRequest | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'evidence-requests'],
    queryFn: () => evidenceRequestsApi.listByEngagement(engagement.id),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'evidence-requests'] });
    // Responses create engagement evidence too.
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'evidence'] });
  };

  const create = useMutation({
    mutationFn: () =>
      evidenceRequestsApi.create(engagement.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
      }),
    onSuccess: () => {
      toast.success('Request sent to the auditee');
      setShowForm(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create request'),
  });

  const respond = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => evidenceRequestsApi.respond(id, file),
    onSuccess: () => {
      toast.success('Document submitted — the auditor will review it');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to upload'),
  });

  const accept = useMutation({
    mutationFn: (id: string) => evidenceRequestsApi.accept(id),
    onSuccess: () => {
      toast.success('Request fulfilled');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const returnReq = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => evidenceRequestsApi.return(id, reason),
    onSuccess: () => {
      toast.success('Returned to the auditee');
      setReturning(null);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => evidenceRequestsApi.cancel(id),
    onSuccess: () => {
      toast.success('Request cancelled');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const pickFileFor = (requestId: string) => {
    setRespondingTo(requestId);
    fileRef.current?.click();
  };

  const requests = list.data ?? [];

  return (
    <div className="space-y-4">
      {/* Hidden file input shared by all "Upload" buttons */}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && respondingTo) respond.mutate({ id: respondingTo, file });
          e.target.value = '';
          setRespondingTo(null);
        }}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Documents requested from <span className="font-medium text-text-primary">{engagement.auditeeName ?? 'the auditee'}</span> for this audit.
        </p>
        {canRequest && (
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowForm((v) => !v)}>
            New request
          </Button>
        )}
      </div>

      {showForm && (
        <Card padded>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="What do you need?" required className="sm:col-span-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bank reconciliations for Q1 2026"
              />
            </FormField>
            <FormField label="Details (optional)" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Period, format, or anything that helps the auditee find the right document…"
              />
            </FormField>
            <FormField label="Due date (optional)">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (title.trim().length < 3) return toast.error('Title is required');
                create.mutate();
              }}
              isLoading={create.isPending}
            >
              Send request
            </Button>
          </div>
        </Card>
      )}

      {list.isLoading ? (
        <Card padded>
          <Skeleton className="h-12 w-full" />
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="h-4 w-4" />}
            title="No evidence requests yet"
            description={
              canRequest
                ? 'Request documents from the auditee instead of chasing them by email — everything stays tracked here.'
                : 'When the audit team needs documents from you, requests will appear here.'
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const isAssignee = r.assignedToId === session.id;
            const overdue = r.dueDate && r.status !== 'fulfilled' && new Date(r.dueDate) < new Date();
            return (
              <li key={r.id}>
                <Card padded>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{r.title}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      {r.description && <p className="mt-1 text-sm text-text-secondary">{r.description}</p>}
                      <p className="mt-1 text-xs text-text-muted">
                        Requested by {r.requestedByName} · assigned to {r.assignedToName} ·{' '}
                        {formatRelative(r.createdAt)}
                        {r.dueDate && (
                          <span className={cn(overdue && 'font-semibold text-danger')}>
                            {' '}· due {formatDate(r.dueDate)}{overdue ? ' (overdue)' : ''}
                          </span>
                        )}
                      </p>
                      {r.status === 'open' && r.returnReason && (
                        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Returned: {r.returnReason}
                        </p>
                      )}
                      {r.evidence.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {r.evidence.map((f) => (
                            <li key={f.id} className="flex items-center gap-1.5 text-xs text-text-secondary">
                              <FileType2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{f.fileName}</span>
                              <span className="text-text-muted">· {formatRelative(f.uploadedAt)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {r.status !== 'fulfilled' && (isAssignee || canRequest) && (
                        <Button
                          size="sm"
                          variant={isAssignee && r.status === 'open' ? 'primary' : 'secondary'}
                          leftIcon={<Upload className="h-3.5 w-3.5" />}
                          onClick={() => pickFileFor(r.id)}
                          isLoading={respond.isPending && respondingTo === r.id}
                        >
                          Upload
                        </Button>
                      )}
                      {canRequest && r.status === 'submitted' && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            onClick={() => accept.mutate(r.id)}
                            isLoading={accept.isPending}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            leftIcon={<CornerUpLeft className="h-3.5 w-3.5" />}
                            onClick={() => setReturning(r)}
                          >
                            Return
                          </Button>
                        </>
                      )}
                      {canRequest && r.status === 'open' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => cancel.mutate(r.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ReasonDialog
        open={returning !== null}
        title="Return this submission"
        description="Tell the auditee what was wrong or missing so they can re-upload the right document."
        confirmLabel="Return to auditee"
        onConfirm={(reason) => {
          if (returning) returnReq.mutate({ id: returning.id, reason });
        }}
        onClose={() => setReturning(null)}
        isLoading={returnReq.isPending}
      />
    </div>
  );
};
