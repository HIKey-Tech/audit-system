'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Send, Check, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { FormField } from '@/components/ui/FormField';
import { Input, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { workingPapersApi } from '@/lib/api/audit';
import { formatRelative } from '@/lib/utils/format';
import { useSession, hasPermission } from '@/components/providers/AuthProvider';
import type { AuditEngagementDetail, AuditWorkingPaper } from '@/lib/types/domain';

interface Props {
  engagement: AuditEngagementDetail;
}

export const WorkingPapersTab = ({ engagement }: Props): JSX.Element => {
  const qc = useQueryClient();
  const session = useSession();
  const canWrite = hasPermission(session, 'audit:write');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AuditWorkingPaper | null>(null);

  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'working-papers'],
    queryFn: () => workingPapersApi.listByEngagement(engagement.id),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'working-papers'] });
  };

  const submitMut = useMutation({
    mutationFn: (id: string) => workingPapersApi.submit(id),
    onSuccess: () => {
      toast.success('Submitted for review');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => workingPapersApi.approve(id),
    onSuccess: () => {
      toast.success('Working paper approved');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      workingPapersApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Working paper rejected');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const canCreate = canWrite && engagement.status === 'in_progress';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Working papers</h2>
          <p className="text-xs text-text-secondary">Drafted, reviewed, and locked alongside the engagement.</p>
        </div>
        {canCreate && (
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
            New working paper
          </Button>
        )}
      </div>

      <Card padded={false}>
        {list.isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="No working papers yet"
            description={
              engagement.status !== 'in_progress'
                ? 'Working papers can be created once the engagement is in progress.'
                : 'Capture audit testing notes, samples and observations.'
            }
            action={
              canCreate ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
                  New working paper
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.data.map((wp) => (
              <li key={wp.id} className="px-5 py-4 hover:bg-surface-alt/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-text-primary">{wp.title}</h3>
                      <Badge tone="gray">v{wp.version}</Badge>
                      <StatusBadge status={wp.status} />
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      Created by {wp.createdByName} · {formatRelative(wp.createdAt)}
                      {wp.reviewerName && (
                        <> · Reviewer {wp.reviewerName}</>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setEditing(wp)}>
                      View
                    </Button>
                    {canWrite && (wp.status === 'draft' || wp.status === 'rejected') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Send className="h-3.5 w-3.5" />}
                        onClick={() => submitMut.mutate(wp.id)}
                      >
                        Submit
                      </Button>
                    )}
                    {canWrite && wp.status === 'submitted' && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          leftIcon={<Check className="h-3.5 w-3.5" />}
                          onClick={() => approveMut.mutate(wp.id)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          leftIcon={<X className="h-3.5 w-3.5" />}
                          onClick={() => {
                            const reason = window.prompt('Rejection reason') ?? '';
                            if (reason.trim()) rejectMut.mutate({ id: wp.id, reason: reason.trim() });
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateOrEditPaperSlideOver
        engagementId={engagement.id}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={refresh}
      />
      <ViewPaperSlideOver
        paper={editing}
        canEdit={canWrite}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
};

const CreateOrEditPaperSlideOver = ({
  engagementId,
  open,
  onClose,
  onSaved,
}: {
  engagementId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setContent('');
  };

  const submit = async (alsoSubmit: boolean) => {
    if (!title.trim()) {
      toast.error('Title required');
      return;
    }
    setSaving(true);
    try {
      const created = await workingPapersApi.create(engagementId, {
        title: title.trim(),
        content: content || undefined,
      });
      if (alsoSubmit) {
        await workingPapersApi.submit(created.id);
      }
      toast.success(alsoSubmit ? 'Submitted for review' : 'Saved as draft');
      onSaved();
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New working paper"
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => submit(false)} isLoading={saving}>
            Save as draft
          </Button>
          <Button size="sm" onClick={() => submit(true)} isLoading={saving}>
            Submit for review
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. WP-01 Sample Selection" />
        </FormField>
        <FormField label="Content" hint="Plain text or markdown — exported into the DOCX template.">
          <Textarea
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="font-mono text-xs"
          />
        </FormField>
      </div>
    </SlideOver>
  );
};

const ViewPaperSlideOver = ({
  paper,
  canEdit,
  onClose,
  onSaved,
}: {
  paper: AuditWorkingPaper | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const editable =
    canEdit && paper && (paper.status === 'draft' || paper.status === 'rejected');

  // Sync state when paper changes
  if (paper && paper.id && (title === '' && content === '' && paper.title)) {
    setTitle(paper.title);
    setContent(paper.content ?? '');
  }

  const handleSave = async () => {
    if (!paper) return;
    setSaving(true);
    try {
      await workingPapersApi.update(paper.id, { title, content });
      toast.success('Saved');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={Boolean(paper)}
      onClose={() => {
        setTitle('');
        setContent('');
        onClose();
      }}
      title={paper?.title ?? 'Working paper'}
      description={paper ? `Version ${paper.version} · ${paper.status}` : undefined}
      width="xl"
      footer={
        editable ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={saving}>
              Save changes
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      {paper && (
        <div className="space-y-4">
          <FormField label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} />
          </FormField>
          <FormField label="Content">
            <Textarea
              rows={20}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-xs"
              disabled={!editable}
            />
          </FormField>
          {paper.reviewComment && (
            <FormField label="Reviewer comment">
              <p className="rounded-md border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary whitespace-pre-wrap">
                {paper.reviewComment}
              </p>
            </FormField>
          )}
        </div>
      )}
    </SlideOver>
  );
};
