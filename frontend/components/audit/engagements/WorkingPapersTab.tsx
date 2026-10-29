'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  FileText,
  Send,
  Check,
  X,
  Eye,
  Upload,
  Wand2,
  Download,
  FlaskConical,
  FileType2,
  ChevronDown,
  Loader2,
  ListChecks,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { DocumentWorkspaceModal } from '@/components/ui/DocumentWorkspaceModal';
import { FormField } from '@/components/ui/FormField';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  WordDocumentEditor,
  sectionsToWordHtml,
  legacyContentToWordHtml,
  plainOrMarkdownToHtml,
} from '@/components/ui/WordDocumentEditor';
import { checklistsApi, evidenceApi, workingPapersApi } from '@/lib/api/audit';
import { wpTemplatesApi } from '@/lib/api/settings';
import { documentsApi } from '@/lib/api/documents';
import { SamplingToolSlideOver } from './SamplingToolSlideOver';
import { ApproveSignPanel } from '@/components/workflow/ApproveSignPanel';
import { SignedApprovalDocuments } from '@/components/workflow/SignedApprovalDocuments';
import { DocumentSignerModal } from '@/components/workflow/DocumentSignerModal';
import { formatRelative } from '@/lib/utils/format';
import { usePermission } from '@/hooks/usePermission';
import { useSession } from '@/components/providers/AuthProvider';
import type {
  AuditChecklistItem,
  AuditEngagementDetail,
  AuditWorkingPaper,
  WorkingPaperImportPreview,
} from '@/lib/types/domain';

/** Small Write / Preview segmented toggle shared by the create and view/edit forms. */
const WritePreviewToggle = ({
  previewing,
  onChange,
}: {
  previewing: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element => (
  <div className="inline-flex shrink-0 rounded-md border border-border p-0.5 text-xs font-medium">
    <button
      type="button"
      onClick={() => onChange(false)}
      className={`whitespace-nowrap shrink-0 rounded px-2.5 py-1 transition-colors ${!previewing ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'}`}
    >
      Word Editor
    </button>
    <button
      type="button"
      onClick={() => onChange(true)}
      className={`whitespace-nowrap shrink-0 rounded px-2.5 py-1 transition-colors ${previewing ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'}`}
    >
      Print Preview
    </button>
  </div>
);

/** Split-button export: primary downloads PDF (signature images embedded), the
 * chevron menu offers Word (.docx, typed sign-off block). Mirrors the report tab. */
const WorkingPaperExportButton = ({
  paperId,
  onPreviewPdf,
}: {
  paperId: string;
  onPreviewPdf?: (url: string, name: string) => void;
}): JSX.Element => {
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showMenu]);

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExportingFormat(format);
    setShowMenu(false);
    try {
      const { blob, fileName } = await workingPapersApi.exportFile(paperId, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${fileName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportingFormat(null);
    }
  };

  const handlePreview = async () => {
    setShowMenu(false);
    try {
      const { blob, fileName } = await workingPapersApi.exportFile(paperId, 'pdf');
      const url = URL.createObjectURL(blob);
      onPreviewPdf?.(url, fileName);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate PDF preview');
    }
  };

  return (
    <div ref={menuRef} className="relative flex">
      <Button
        size="sm"
        variant="secondary"
        leftIcon={<Download className="h-3.5 w-3.5" />}
        isLoading={exportingFormat === 'pdf'}
        disabled={exportingFormat === 'docx'}
        onClick={() => handleExport('pdf')}
        className="rounded-r-none border-r-0"
      >
        Export PDF
      </Button>
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        disabled={exportingFormat !== null}
        aria-label="More export options"
        className="inline-flex h-8 items-center rounded-r-md border border-border bg-white px-1.5 text-text-secondary hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {showMenu && (
        <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-border bg-white py-1 shadow-lg">
          {onPreviewPdf && (
            <button
              type="button"
              onClick={handlePreview}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-alt"
            >
              <Eye className="h-3.5 w-3.5 text-primary" />
              Preview PDF
            </button>
          )}
          <button
            type="button"
            onClick={() => handleExport('docx')}
            disabled={exportingFormat !== null}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportingFormat === 'docx' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            Export Word (.docx)
          </button>
        </div>
      )}
    </div>
  );
};

/** HTML snapshot of the engagement's control test results, for embedding
 * into a working paper inside the Word editor. */
function buildTestResultsHtml(items: AuditChecklistItem[]): string {
  const tested = items.filter((c) => c.result !== 'not_tested');
  const count = (r: string): number => items.filter((c) => c.result === r).length;
  const rows = items
    .map((c) => {
      const label = c.result.replace(/_/g, ' ').toUpperCase();
      return `<tr>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;font-weight:600;">${c.controlReference}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;">${c.controlDescription}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;font-weight:700;">${label}</td>
        <td style="border:1px solid #cbd5e1;padding:6px 8px;">${c.notes ?? '—'}</td>
      </tr>`;
    })
    .join('');

  return `<h2 style="color:#000000;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-top:18px;margin-bottom:8px;font-size:15px;font-weight:700;">Control Test Results Summary</h2>
<p style="color:#000000;"><strong>Summary:</strong> ${tested.length} of ${items.length} controls tested — ${count('passed')} passed, ${count('failed')} failed, ${count('not_applicable')} N/A.</p>
<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:12px;">
  <thead>
    <tr>
      <th style="border:1px solid #94a3b8;background:#f8fafc;padding:6px 8px;text-align:left;color:#000000;">Ref</th>
      <th style="border:1px solid #94a3b8;background:#f8fafc;padding:6px 8px;text-align:left;color:#000000;">Control Description</th>
      <th style="border:1px solid #94a3b8;background:#f8fafc;padding:6px 8px;text-align:left;color:#000000;">Result</th>
      <th style="border:1px solid #94a3b8;background:#f8fafc;padding:6px 8px;text-align:left;color:#000000;">Auditor Notes</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

interface Props {
  engagement: AuditEngagementDetail;
}

export const WorkingPapersTab = ({ engagement }: Props): JSX.Element => {
  const qc = useQueryClient();
  const canCreateWP = usePermission('working_paper:create');
  const canUpdateWP = usePermission('working_paper:update');
  const canSubmitWP = usePermission('working_paper:submit');
  const canApproveWP = usePermission('working_paper:approve');
  const canRejectWP = usePermission('working_paper:reject');
  const canSample = usePermission('evidence:upload');
  const session = useSession();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [samplingOpen, setSamplingOpen] = useState(false);
  const [samplingPrefill, setSamplingPrefill] = useState<{ title: string; content: string } | null>(null);
  const [editing, setEditing] = useState<AuditWorkingPaper | null>(null);
  const [rejecting, setRejecting] = useState<AuditWorkingPaper | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null);

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

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      workingPapersApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Working paper rejected');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const canCreate = canCreateWP && engagement.status === 'in_progress';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Working papers</h2>
          <p className="text-xs text-text-secondary">
            Author working papers in the built-in Word-style document editor with template headers, tables, and inline images.
          </p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            {canSample && (
              <Button size="sm" variant="secondary" leftIcon={<FlaskConical className="h-3.5 w-3.5" />} onClick={() => setSamplingOpen(true)}>
                Sampling tool
              </Button>
            )}
            <Button size="sm" variant="secondary" leftIcon={<Upload className="h-3.5 w-3.5" />} onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
              New working paper
            </Button>
          </div>
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
                : 'Capture audit testing notes, samples and observations using the Word-style document editor.'
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
                      <Badge tone="gray">v{wp.version ?? wp.versionNumber ?? 1}</Badge>
                      <StatusBadge status={wp.status} explain="working_paper" />
                      {wp.sourceDocumentId && <Badge tone="blue">Imported</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-text-secondary">
                      Created by {wp.createdByName} · {formatRelative(wp.createdAt)}
                      {wp.reviewerName && (
                        <> · Reviewer {wp.reviewerName}</>
                      )}
                    </p>
                    {wp.status === 'rejected' && (wp.reviewComment ?? wp.rejectionReason) && (
                      <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">
                        <span className="font-semibold">Rejected:</span>{' '}
                        {wp.reviewComment ?? wp.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setEditing(wp)}>
                      {wp.createdById === session.id && (wp.status === 'draft' || wp.status === 'rejected') ? 'Open in Editor' : 'View'}
                    </Button>
                    <WorkingPaperExportButton
                      paperId={wp.id}
                      onPreviewPdf={(url, name) => setPdfPreview({ url, name })}
                    />
                    {canSubmitWP && wp.createdById === session.id && (wp.status === 'draft' || wp.status === 'rejected') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Send className="h-3.5 w-3.5" />}
                        onClick={() => submitMut.mutate(wp.id)}
                      >
                        Submit
                      </Button>
                    )}
                    {wp.status === 'submitted' && wp.createdById !== session.id && (
                      <>
                        {canApproveWP && (
                          <Button
                            size="sm"
                            variant="success"
                            leftIcon={<Check className="h-3.5 w-3.5" />}
                            onClick={() => setApprovingId((cur) => (cur === wp.id ? null : wp.id))}
                          >
                            Approve &amp; Sign
                          </Button>
                        )}
                        {canRejectWP && (
                          <Button
                            size="sm"
                            variant="danger"
                            leftIcon={<X className="h-3.5 w-3.5" />}
                            onClick={() => setRejecting(wp)}
                          >
                            Reject
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {approvingId === wp.id && (
                  <ApproveSignPanel
                    entityType="audit_working_paper"
                    showComment={false}
                    wpContent={wp.content ?? undefined}
                    approveFn={(edits) => workingPapersApi.approve(wp.id, edits)}
                    onDone={() => {
                      setApprovingId(null);
                      refresh();
                    }}
                  />
                )}
                {wp.status === 'approved' && (
                  <div className="mt-3">
                    <SignedApprovalDocuments entityType="audit_working_paper" entityId={wp.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateOrEditPaperSlideOver
        engagement={engagement}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setSamplingPrefill(null);
        }}
        onSaved={refresh}
        initialTitle={samplingPrefill?.title}
        initialContent={samplingPrefill?.content}
      />
      <SamplingToolSlideOver
        engagementId={engagement.id}
        open={samplingOpen}
        onClose={() => setSamplingOpen(false)}
        onCreateWorkingPaper={(title, content) => {
          setSamplingPrefill({ title, content });
          setSamplingOpen(false);
          setCreateOpen(true);
        }}
      />
      <ImportPaperSlideOver
        engagementId={engagement.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={refresh}
      />
      <ViewPaperSlideOver
        paper={editing}
        engagement={engagement}
        canEdit={canUpdateWP}
        canApprove={canApproveWP}
        onClose={() => setEditing(null)}
        onSaved={refresh}
        onPreviewPdf={(url, name) => setPdfPreview({ url, name })}
      />
      <ReasonDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          if (!rejecting) return;
          await rejectMut.mutateAsync({ id: rejecting.id, reason });
          setRejecting(null);
        }}
        title="Reject working paper"
        description="Provide a reason. It is recorded on the working paper and visible to the preparer."
        placeholder="Reason for rejection…"
        confirmLabel="Reject"
        tone="danger"
        isLoading={rejectMut.isPending}
      />

      {pdfPreview && (
        <DocumentSignerModal
          open={!!pdfPreview}
          onClose={() => {
            URL.revokeObjectURL(pdfPreview.url);
            setPdfPreview(null);
          }}
          fileUrl={pdfPreview.url}
          documentName={pdfPreview.name}
          isSignable={false}
        />
      )}
    </div>
  );
};

const CreateOrEditPaperSlideOver = ({
  engagement,
  open,
  onClose,
  onSaved,
  initialTitle,
  initialContent,
}: {
  engagement: AuditEngagementDetail;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Optional prefill (e.g. the sampling tool's methodology write-up). */
  initialTitle?: string;
  initialContent?: string;
}): JSX.Element => {
  const engagementId = engagement.id;
  const auditType = engagement.auditType;
  const [title, setTitle] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['settings', 'working-paper-templates', 'list'],
    queryFn: () => wpTemplatesApi.list(),
    enabled: open,
    retry: false,
  });

  const checklistsQuery = useQuery({
    queryKey: ['engagements', engagementId, 'checklists'],
    queryFn: () => checklistsApi.listByEngagement(engagementId),
    enabled: open,
  });
  const checklistItems: AuditChecklistItem[] = checklistsQuery.data
    ? Object.values(checklistsQuery.data).flat()
    : [];

  const templates = templatesQuery.data ?? [];
  const defaultTemplate =
    templates.find((t) => t.isDefault && t.auditType === auditType) ??
    templates.find((t) => t.isDefault) ??
    null;

  // Prefill from the caller (sampling tool)
  useEffect(() => {
    if (open && initialContent !== undefined) {
      setEditorHtml(`<!-- page-margin:normal -->\n${plainOrMarkdownToHtml(initialContent)}`);
      if (initialTitle) setTitle(initialTitle);
      setSelectedTemplateId('');
      setTouched(true);
    }
  }, [open, initialContent, initialTitle]);

  // Preselect the audit-type default once templates load (unless the user already chose)
  useEffect(() => {
    if (!open || touched || templatesQuery.isLoading) return;
    if (defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
      setEditorHtml(
        sectionsToWordHtml(
          defaultTemplate.sections.map((s) => ({
            title: s.title,
            description: s.description,
            placeholder: s.placeholder,
            content: '',
          })),
        ),
      );
    } else {
      setSelectedTemplateId('');
      setEditorHtml(
        sectionsToWordHtml([
          { title: 'Objective', description: 'State the audit test objective and control being evaluated.' },
          { title: 'Scope & Population', description: 'Describe the population, period covered, and sample size.' },
          { title: 'Test Procedures Performed', description: 'Document the step-by-step audit procedures executed.' },
          { title: 'Results & Exceptions', description: 'Summarize test outcomes, exceptions noted, and root causes.' },
          { title: 'Conclusion', description: 'State the overall conclusion on control effectiveness.' },
        ]),
      );
    }
    setTouched(true);
  }, [open, touched, templatesQuery.isLoading, defaultTemplate]);

  const handleSelectTemplate = (tplId: string) => {
    setTouched(true);
    setSelectedTemplateId(tplId);
    const chosen = templates.find((t) => t.id === tplId);
    if (chosen) {
      setEditorHtml(
        sectionsToWordHtml(
          chosen.sections.map((s) => ({
            title: s.title,
            description: s.description,
            placeholder: s.placeholder,
            content: '',
          })),
        ),
      );
    } else {
      setEditorHtml('<!-- page-margin:normal -->\n<p><br /></p>');
    }
  };

  const handleAppendChecklistResults = () => {
    if (checklistItems.length === 0) return;
    const block = buildTestResultsHtml(checklistItems);
    setEditorHtml((prev) => `${prev}\n${block}`);
    toast.success('Control test results table appended to document');
  };

  const reset = () => {
    setTitle('');
    setEditorHtml('');
    setSelectedTemplateId('');
    setTouched(false);
    setPreviewing(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (alsoSubmit: boolean) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title is required');
      return;
    }

    const plainText = editorHtml
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();

    if (!plainText && !/<img\b/i.test(editorHtml)) {
      toast.error('Working paper content is required');
      return;
    }

    setSaving(true);
    try {
      const created = await workingPapersApi.create(engagementId, {
        title: trimmedTitle,
        content: editorHtml,
        templateId: selectedTemplateId || undefined,
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

  const isDirty = title.trim().length > 0;

  return (
    <DocumentWorkspaceModal
      open={open}
      onClose={handleClose}
      dirty={isDirty}
      title={
        <div className="flex items-center gap-2 max-w-md w-full">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Working Paper Title (e.g. WP-01 Access Control Review)"
            className="h-8 text-xs font-semibold"
          />
        </div>
      }
      subtitle={`${engagement.referenceNumber} · ${engagement.title}`}
      badge={<Badge status="draft">Draft</Badge>}
      headerCenter={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium whitespace-nowrap">Template:</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#1E3A8A] focus:outline-none"
            >
              <option value="">Blank Document</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault && t.auditType === auditType ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
          {checklistItems.length > 0 && !previewing && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={<ListChecks className="h-3.5 w-3.5" />}
              onClick={handleAppendChecklistResults}
              title={`Append test results table for ${checklistItems.length} checklist controls`}
            >
              Insert Controls ({checklistItems.length})
            </Button>
          )}
        </div>
      }
      headerRight={
        <div className="flex items-center gap-2">
          <WritePreviewToggle previewing={previewing} onChange={setPreviewing} />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Save className="h-3.5 w-3.5" />}
            onClick={() => submit(false)}
            isLoading={saving}
            disabled={templatesQuery.isLoading}
          >
            Save as Draft
          </Button>
          <Button
            size="sm"
            leftIcon={<Send className="h-3.5 w-3.5" />}
            onClick={() => submit(true)}
            isLoading={saving}
            disabled={templatesQuery.isLoading}
          >
            Submit for Review
          </Button>
        </div>
      }
    >
      {templatesQuery.isLoading ? (
        <div className="p-8 space-y-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <WordDocumentEditor
            value={editorHtml}
            onChange={(html) => {
              setTouched(true);
              setEditorHtml(html);
            }}
            documentTitle={title || 'Audit Working Paper'}
            engagementReference={engagement.referenceNumber}
            engagementTitle={engagement.title}
            preparedBy={engagement.leadAuditorName ?? undefined}
            status="draft"
            version={1}
            readOnly={previewing}
            onSaveDraft={() => submit(false)}
            savingDraft={saving}
          />
        </div>
      )}
    </DocumentWorkspaceModal>
  );
};

const ImportPaperSlideOver = ({
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<WorkingPaperImportPreview | null>(null);
  const [title, setTitle] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [workingPaperType, setWorkingPaperType] = useState('imported');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setTitle('');
    setEditorHtml('');
    setWorkingPaperType('imported');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseFile = async () => {
    if (!file) {
      toast.error('Choose a file to import');
      return;
    }

    setParsing(true);
    try {
      const result = await workingPapersApi.importPreview(engagementId, file, { workingPaperType });
      setPreview(result);
      setTitle(result.suggestedTitle);
      setWorkingPaperType(result.workingPaperType);
      if (result.mappedSections.length > 0) {
        setEditorHtml(
          sectionsToWordHtml(
            result.mappedSections.map((s) => ({
              title: s.title,
              description: s.description,
              content: s.content,
            })),
          ),
        );
      } else {
        setEditorHtml(legacyContentToWordHtml(result.content || result.extractedText));
      }
      toast.success('Import loaded into Word Editor');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to parse working paper');
    } finally {
      setParsing(false);
    }
  };

  const saveDraft = async () => {
    if (!preview) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title required');
      return;
    }

    if (!editorHtml.trim()) {
      toast.error('No content has been added yet.');
      return;
    }

    setSaving(true);
    try {
      await workingPapersApi.create(engagementId, {
        title: trimmedTitle,
        content: editorHtml,
        templateId: preview.templateId ?? undefined,
        sourceDocumentId: preview.documentId,
        workingPaperType,
        importMetadata: {
          fileName: preview.fileName,
          fileType: preview.fileType,
          templateName: preview.templateName,
          confidence: preview.confidence,
          warnings: preview.warnings,
        },
      });
      toast.success('Imported working paper saved as draft');
      onSaved();
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save import');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DocumentWorkspaceModal
      open={open}
      onClose={handleClose}
      dirty={Boolean(preview)}
      title={
        preview ? (
          <div className="flex items-center gap-2 max-w-md w-full">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Working Paper Title"
              className="h-8 text-xs font-semibold"
            />
          </div>
        ) : (
          'Import Working Paper'
        )
      }
      subtitle={
        preview
          ? `${preview.templateName ?? 'Free-form document'} · mapping confidence ${Math.round(preview.confidence * 100)}%`
          : 'Upload an existing DOCX, XLSX, CSV, PDF, or text working paper and edit it in the Word Document Editor.'
      }
      headerRight={
        <div className="flex items-center gap-2">
          {!preview ? (
            <Button
              size="sm"
              leftIcon={<Wand2 className="h-3.5 w-3.5" />}
              onClick={parseFile}
              isLoading={parsing}
              disabled={!file}
            >
              Load into Editor
            </Button>
          ) : (
            <Button
              size="sm"
              leftIcon={<Save className="h-3.5 w-3.5" />}
              onClick={saveDraft}
              isLoading={saving}
            >
              Save as Draft
            </Button>
          )}
        </div>
      }
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {!preview ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-12 flex items-center justify-center bg-slate-100">
            <div className="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-6 shadow-md space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#1E3A8A]">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Import Document into Word Editor
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload DOCX, XLSX, CSV, PDF, or Markdown files.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Working paper type">
                  <Input
                    value={workingPaperType}
                    onChange={(e) => setWorkingPaperType(e.target.value)}
                    placeholder="imported"
                  />
                </FormField>
                <FormField label="Source file" required>
                  <input
                    type="file"
                    accept=".docx,.xlsx,.xls,.csv,.pdf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-md border border-border bg-white px-3 py-1.5 text-xs text-text-primary file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white"
                  />
                </FormField>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  leftIcon={<Wand2 className="h-3.5 w-3.5" />}
                  onClick={parseFile}
                  isLoading={parsing}
                  disabled={!file}
                >
                  Load into Word Editor
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {preview.warnings.length > 0 && (
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
                <span className="font-semibold">Import Notes: </span>
                {preview.warnings.join(' · ')}
              </div>
            )}
            <WordDocumentEditor
              value={editorHtml}
              onChange={setEditorHtml}
              documentTitle={title || 'Imported Working Paper'}
              onSaveDraft={saveDraft}
              savingDraft={saving}
            />
          </div>
        )}
      </div>
    </DocumentWorkspaceModal>
  );
};

const ViewPaperSlideOver = ({
  paper,
  engagement,
  canEdit,
  canApprove,
  onClose,
  onSaved,
  onPreviewPdf,
}: {
  paper: AuditWorkingPaper | null;
  engagement: AuditEngagementDetail;
  canEdit: boolean;
  canApprove: boolean;
  onClose: () => void;
  onSaved: () => void;
  onPreviewPdf?: (url: string, name: string) => void;
}): JSX.Element => {
  const session = useSession();
  const [title, setTitle] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [reviewerEditing, setReviewerEditing] = useState(false);

  const isAuthorEditable =
    canEdit &&
    Boolean(paper) &&
    paper?.createdById === session.id &&
    (paper?.status === 'draft' || paper?.status === 'rejected');

  const isReviewerSubmitted =
    canApprove &&
    Boolean(paper) &&
    paper?.status === 'submitted' &&
    paper?.createdById !== session.id;

  const editable = isAuthorEditable || (isReviewerSubmitted && reviewerEditing);
  const showReadOnly = !editable || previewing;

  useEffect(() => {
    if (!paper) return;
    setTitle(paper.title);
    setEditorHtml(legacyContentToWordHtml(paper.content));
    setPreviewing(false);
    setReviewerEditing(false);
  }, [paper]);

  const handleSave = async () => {
    if (!paper) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title required');
      return;
    }

    setSaving(true);
    try {
      await workingPapersApi.update(paper.id, { title: trimmedTitle, content: editorHtml });
      toast.success('Working paper saved as draft');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = Boolean(
    isAuthorEditable &&
      paper &&
      (title !== paper.title || editorHtml !== legacyContentToWordHtml(paper.content)),
  );

  return (
    <DocumentWorkspaceModal
      open={Boolean(paper)}
      onClose={onClose}
      dirty={isDirty}
      title={
        isAuthorEditable ? (
          <div className="flex items-center gap-2 max-w-md w-full">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Working Paper Title"
              className="h-8 text-xs font-semibold"
            />
          </div>
        ) : (
          paper?.title ?? 'Working paper'
        )
      }
      subtitle={
        paper
          ? `${engagement.referenceNumber} · ${engagement.title} · Version v${paper.version ?? paper.versionNumber ?? 1}.0`
          : undefined
      }
      badge={
        paper && (
          <Badge status={paper.status}>
            {paper.status.toUpperCase()}
          </Badge>
        )
      }
      headerRight={
        <div className="flex items-center gap-2">
          {paper && <WorkingPaperExportButton paperId={paper.id} onPreviewPdf={onPreviewPdf} />}
          {isReviewerSubmitted && (
            <Button
              size="sm"
              variant={reviewerEditing ? 'primary' : 'secondary'}
              onClick={() => setReviewerEditing((v) => !v)}
            >
              {reviewerEditing ? 'Editing Mode' : 'Edit in Word Mode'}
            </Button>
          )}
          {editable && <WritePreviewToggle previewing={previewing} onChange={setPreviewing} />}
          {isAuthorEditable && (
            <Button
              size="sm"
              onClick={handleSave}
              isLoading={saving}
              leftIcon={<Save className="h-3.5 w-3.5" />}
            >
              Save as Draft
            </Button>
          )}
        </div>
      }
    >
      {paper && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1 min-h-[640px] flex flex-col">
            <WordDocumentEditor
              value={editorHtml}
              onChange={setEditorHtml}
              documentTitle={title || paper.title}
              engagementReference={engagement.referenceNumber}
              engagementTitle={engagement.title}
              preparedBy={paper.createdByName}
              status={paper.status}
              version={paper.version ?? paper.versionNumber ?? 1}
              readOnly={showReadOnly}
              onSaveDraft={isAuthorEditable ? handleSave : undefined}
              savingDraft={saving}
            />
          </div>

          <div className="border-t border-slate-200 bg-white p-4 sm:p-6 space-y-4">
            {isReviewerSubmitted && (
              <ApproveSignPanel
                entityType="audit_working_paper"
                showComment={false}
                wpContent={editorHtml}
                approveFn={(edits) =>
                  workingPapersApi.approve(
                    paper.id,
                    edits ?? (editorHtml !== (paper.content ?? '') ? { content: editorHtml } : undefined),
                  )
                }
                onDone={() => {
                  onSaved();
                  onClose();
                }}
              />
            )}

            {paper.reviewComment && (
              <FormField label="Reviewer comment">
                <p className="rounded-md border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary whitespace-pre-wrap">
                  {paper.reviewComment}
                </p>
              </FormField>
            )}

            <PaperEvidenceLinks paperId={paper.id} engagementId={paper.engagementId} />

            <PaperComments paperId={paper.id} />
          </div>
        </div>
      )}
    </DocumentWorkspaceModal>
  );
};

/**
 * Linked evidence — attaches engagement evidence to this specific working paper,
 * so the paper cites the exact files that support its testing.
 */
const PaperEvidenceLinks = ({
  paperId,
  engagementId,
}: {
  paperId: string;
  engagementId: string;
}): JSX.Element => {
  const qc = useQueryClient();
  const canLink = usePermission('evidence:upload');

  const evidence = useQuery({
    queryKey: ['engagements', engagementId, 'evidence'],
    queryFn: () => evidenceApi.listByEngagement(engagementId),
  });

  const all = evidence.data ?? [];
  const linked = all.filter((e) => e.workingPaperId === paperId);
  const available = all.filter((e) => !e.workingPaperId);

  const refresh = () => qc.invalidateQueries({ queryKey: ['engagements', engagementId, 'evidence'] });

  const link = useMutation({
    mutationFn: (evidenceId: string) => evidenceApi.linkWorkingPaper(evidenceId, paperId),
    onSuccess: () => {
      toast.success('Evidence linked to working paper');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to link evidence'),
  });

  const unlink = useMutation({
    mutationFn: (evidenceId: string) => evidenceApi.unlinkWorkingPaper(evidenceId),
    onSuccess: () => {
      toast.success('Evidence unlinked');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to unlink evidence'),
  });

  return (
    <div className="border-t border-border pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Linked evidence{linked.length > 0 ? ` (${linked.length})` : ''}
      </p>

      {evidence.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : linked.length === 0 ? (
        <p className="text-xs text-text-muted">
          No evidence linked to this working paper yet.
          {canLink && ' Attach files uploaded on the Evidence tab below.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {linked.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center gap-2 rounded-md border border-border bg-surface-alt/60 px-3 py-2"
            >
              <FileType2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs text-text-primary">{ev.fileName}</span>
              <a
                href={documentsApi.downloadUrl(ev.documentId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
              {canLink && (
                <button
                  type="button"
                  onClick={() => unlink.mutate(ev.id)}
                  className="text-sm leading-none text-text-muted hover:text-danger"
                  title="Unlink from this working paper"
                  disabled={unlink.isPending}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canLink && (
        <div className="mt-2">
          {available.length > 0 ? (
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) link.mutate(e.target.value);
              }}
              className="text-xs"
            >
              <option value="">+ Link engagement evidence…</option>
              {available.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.fileName}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-[11px] text-text-muted">
              No unlinked evidence available — upload files on the Evidence tab first.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Review-comment thread — lets a reviewer point at specific problems (and the
 * preparer reply) without rejecting the paper.
 */
const PaperComments = ({ paperId }: { paperId: string }): JSX.Element => {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const comments = useQuery({
    queryKey: ['working-papers', paperId, 'comments'],
    queryFn: () => workingPapersApi.listComments(paperId),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['working-papers', paperId, 'comments'] });

  const add = useMutation({
    mutationFn: () => workingPapersApi.addComment(paperId, body.trim()),
    onSuccess: () => {
      setBody('');
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to comment'),
  });

  const resolve = useMutation({
    mutationFn: (commentId: string) => workingPapersApi.resolveComment(commentId),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const items = comments.data ?? [];
  const openCount = items.filter((c) => !c.resolvedAt).length;

  return (
    <div className="border-t border-border pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Review comments{openCount > 0 ? ` (${openCount} open)` : ''}
      </p>

      {comments.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted">
          No comments yet. Reviewers can point out issues here instead of rejecting the paper.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li
              key={c.id}
              className={`rounded-md border px-3 py-2 ${c.resolvedAt ? 'border-border bg-surface-alt/50 opacity-70' : 'border-border bg-surface-alt'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-primary">
                    {c.authorName}
                    <span className="ml-1.5 font-normal text-text-muted">{formatRelative(c.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-text-secondary">{c.body}</p>
                  {c.resolvedAt && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-success">
                      Resolved{c.resolvedByName ? ` by ${c.resolvedByName}` : ''}
                    </p>
                  )}
                </div>
                {!c.resolvedAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolve.mutate(c.id)}
                    isLoading={resolve.isPending && resolve.variables === c.id}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-end gap-2">
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Point out an issue or reply…"
          className="flex-1"
        />
        <Button
          size="sm"
          onClick={() => {
            if (!body.trim()) return;
            add.mutate();
          }}
          isLoading={add.isPending}
        >
          Comment
        </Button>
      </div>
    </div>
  );
};
