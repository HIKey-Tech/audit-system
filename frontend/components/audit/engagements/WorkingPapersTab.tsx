'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Send, Check, X, Eye, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { FormField } from '@/components/ui/FormField';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { workingPapersApi } from '@/lib/api/audit';
import { wpTemplatesApi } from '@/lib/api/settings';
import { formatRelative } from '@/lib/utils/format';
import { usePermission } from '@/hooks/usePermission';
import type {
  AuditEngagementDetail,
  AuditWorkingPaper,
  WorkingPaperImportPreview,
  WorkingPaperTemplateSection,
} from '@/lib/types/domain';

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

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<AuditWorkingPaper | null>(null);
  const [rejecting, setRejecting] = useState<AuditWorkingPaper | null>(null);

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

  const canCreate = canCreateWP && engagement.status === 'in_progress';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Working papers</h2>
          <p className="text-xs text-text-secondary">Drafted, reviewed, and locked alongside the engagement.</p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
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
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => setEditing(wp)}>
                      View
                    </Button>
                    {canSubmitWP && (wp.status === 'draft' || wp.status === 'rejected') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Send className="h-3.5 w-3.5" />}
                        onClick={() => submitMut.mutate(wp.id)}
                      >
                        Submit
                      </Button>
                    )}
                    {wp.status === 'submitted' && (
                      <>
                        {canApproveWP && (
                          <Button
                            size="sm"
                            variant="success"
                            leftIcon={<Check className="h-3.5 w-3.5" />}
                            onClick={() => approveMut.mutate(wp.id)}
                          >
                            Approve
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
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateOrEditPaperSlideOver
        engagementId={engagement.id}
        auditType={engagement.auditType}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={refresh}
      />
      <ImportPaperSlideOver
        engagementId={engagement.id}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={refresh}
      />
      <ViewPaperSlideOver
        paper={editing}
        canEdit={canUpdateWP}
        onClose={() => setEditing(null)}
        onSaved={refresh}
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
    </div>
  );
};

const CreateOrEditPaperSlideOver = ({
  engagementId,
  auditType,
  open,
  onClose,
  onSaved,
}: {
  engagementId: string;
  auditType: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sectionContents, setSectionContents] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['settings', 'working-paper-templates', 'list'],
    queryFn: () => wpTemplatesApi.list(),
    enabled: open,
    retry: false,
  });

  const templates = templatesQuery.data ?? [];
  const defaultTemplate =
    templates.find((t) => t.isDefault && t.auditType === auditType) ?? null;

  // Preselect the audit-type default once templates load (unless the user already chose).
  useEffect(() => {
    if (!open || touched || templatesQuery.isLoading) return;
    setSelectedTemplateId(defaultTemplate ? defaultTemplate.id : '');
  }, [open, touched, templatesQuery.isLoading, defaultTemplate]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Reset section inputs when the chosen template changes.
  useEffect(() => {
    setSectionContents(selectedTemplate ? selectedTemplate.sections.map(() => '') : []);
  }, [selectedTemplate]);

  const reset = () => {
    setTitle('');
    setContent('');
    setSectionContents([]);
    setSelectedTemplateId('');
    setTouched(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateSectionContent = (index: number, value: string) => {
    setSectionContents((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const submit = async (alsoSubmit: boolean) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title required');
      return;
    }

    let payloadContent: string;
    if (selectedTemplate) {
      const missing = selectedTemplate.sections.find(
        (section, index) => section.required && !sectionContents[index]?.trim(),
      );
      if (missing) {
        toast.error(`${missing.title} required`);
        return;
      }
      payloadContent = JSON.stringify({
        sections: selectedTemplate.sections.map((section, index) => ({
          title: section.title,
          content: sectionContents[index] ?? '',
        })),
      });
    } else {
      if (!content.trim()) {
        toast.error('Content required');
        return;
      }
      payloadContent = content;
    }

    setSaving(true);
    try {
      const created = await workingPapersApi.create(engagementId, {
        title: trimmedTitle,
        content: payloadContent,
        templateId: selectedTemplate?.id,
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
      onClose={handleClose}
      title="New working paper"
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => submit(false)} isLoading={saving} disabled={templatesQuery.isLoading}>
            Save as draft
          </Button>
          <Button size="sm" onClick={() => submit(true)} isLoading={saving} disabled={templatesQuery.isLoading}>
            Submit for review
          </Button>
        </div>
      }
    >
      {templatesQuery.isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <FormField
            label="Template"
            tooltip="Pick a structured template for this audit type, or Blank to write free-form notes. Templates standardize what every working paper captures."
          >
            <Select
              value={selectedTemplateId}
              onChange={(e) => {
                setTouched(true);
                setSelectedTemplateId(e.target.value);
              }}
            >
              <option value="">Blank (free text)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault && t.auditType === auditType ? ' (default)' : ''}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. WP-01 Sample Selection" />
          </FormField>

          {selectedTemplate ? (
            selectedTemplate.sections.map((section, index) => {
              const fieldId = `working-paper-section-${index}`;
              return (
                <FormField
                  key={`${section.title}-${index}`}
                  label={section.title}
                  required={section.required}
                  htmlFor={fieldId}
                  description={section.description}
                >
                  <Textarea
                    id={fieldId}
                    rows={4}
                    value={sectionContents[index] ?? ''}
                    placeholder={section.placeholder}
                    onChange={(e) => updateSectionContent(index, e.target.value)}
                  />
                </FormField>
              );
            })
          ) : (
            <FormField label="Content" hint="Plain text or markdown — exported into the DOCX template.">
              <Textarea rows={14} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-xs" />
            </FormField>
          )}
        </div>
      )}
    </SlideOver>
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
  const [sectionContents, setSectionContents] = useState<string[]>([]);
  const [freeformContent, setFreeformContent] = useState('');
  const [workingPaperType, setWorkingPaperType] = useState('imported');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setTitle('');
    setSectionContents([]);
    setFreeformContent('');
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
      setSectionContents(result.mappedSections.map((section) => section.content));
      setFreeformContent(result.mappedSections.length === 0 ? result.content : '');
      toast.success('Import preview ready');
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
    const hasMappedContent = preview.mappedSections.length > 0
      && sectionContents.some((value) => value.trim().length > 0);

    const content = preview.mappedSections.length > 0
      ? JSON.stringify({
          sections: preview.mappedSections.map((section, index) => ({
            title: section.title,
            content: sectionContents[index] ?? '',
          })),
        })
      : freeformContent.trim();

    if ((preview.mappedSections.length > 0 && !hasMappedContent) || !content) {
      toast.error('No content has been added yet. Review the extracted text and fill at least one section before saving.');
      return;
    }

    setSaving(true);
    try {
      await workingPapersApi.create(engagementId, {
        title: trimmedTitle,
        content,
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
      toast.success('Imported as draft');
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
    <SlideOver
      open={open}
      onClose={handleClose}
      title="Import working paper"
      description="Upload an existing DOCX, XLSX, CSV, PDF, or text work paper and review the extracted draft before saving."
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          {!preview ? (
            <Button size="sm" leftIcon={<Wand2 className="h-3.5 w-3.5" />} onClick={parseFile} isLoading={parsing}>
              Generate preview
            </Button>
          ) : (
            <Button size="sm" onClick={saveDraft} isLoading={saving}>
              Save draft
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Working paper type">
          <Input
            value={workingPaperType}
            onChange={(e) => setWorkingPaperType(e.target.value)}
            placeholder="imported"
            disabled={Boolean(preview)}
          />
        </FormField>
        <FormField label="Source file" required>
          <input
            type="file"
            accept=".docx,.xlsx,.xls,.csv,.pdf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={Boolean(preview)}
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
          />
        </FormField>

        {preview && (
          <>
            <div className="rounded-md border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary">
              <p className="font-medium text-text-primary">
                {preview.templateName ?? 'No template matched'} · confidence {Math.round(preview.confidence * 100)}%
              </p>
              {preview.warnings.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>

            <FormField label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>

            {preview.mappedSections.length > 0 ? (
              <>
                {preview.confidence < 0.5 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <p className="font-semibold">Auto-fill needs review</p>
                    <p className="mt-1">
                      The importer looks for section headings that match the selected template. For best results, uploaded files should use headings such as Objective, Test Steps, Evidence, Results, Exceptions, and Conclusion.
                    </p>
                  </div>
                )}

                {preview.mappedSections.map((section, index) => (
                <div key={`${section.title}-${index}`} className="space-y-1.5">
                  <label className="block text-xs font-semibold text-text-primary">
                    {section.title}
                    {section.required && <span className="ml-0.5 text-danger">*</span>}
                    <span className="ml-2 font-normal text-text-muted">
                      {Math.round(section.confidence * 100)}%
                    </span>
                  </label>
                  <p className="text-xs text-text-muted">{section.description}</p>
                  <Textarea
                    rows={5}
                    value={sectionContents[index] ?? ''}
                    placeholder={section.confidence === 0 ? 'No matching content was detected. Copy the relevant text from the extracted source below.' : undefined}
                    onChange={(e) => {
                      const next = [...sectionContents];
                      next[index] = e.target.value;
                      setSectionContents(next);
                    }}
                  />
                </div>
                ))}

                <details className="rounded-md border border-border bg-surface-alt px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-text-primary">
                    Extracted source text
                  </summary>
                  <Textarea
                    rows={10}
                    value={preview.extractedText || 'No text could be extracted from this file.'}
                    readOnly
                    className="mt-2 font-mono text-xs"
                  />
                </details>
              </>
            ) : (
              <FormField label="Extracted content">
                <Textarea
                  rows={16}
                  value={freeformContent}
                  onChange={(e) => setFreeformContent(e.target.value)}
                  className="font-mono text-xs"
                />
              </FormField>
            )}
          </>
        )}
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
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      toast.error('Title required');
      return;
    }
    if (!content.trim()) {
      toast.error('Content required');
      return;
    }
    setSaving(true);
    try {
      await workingPapersApi.update(paper.id, { title: trimmedTitle, content });
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
