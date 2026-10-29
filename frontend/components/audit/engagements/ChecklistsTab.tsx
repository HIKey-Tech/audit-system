'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, AlertTriangle, Upload, Library, Plus, Trash2, Paperclip, Check, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Select, Input, Textarea } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { SlideOver } from '@/components/ui/SlideOver';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api-client';
import { checklistsApi, complianceApi, evidenceApi, findingsApi } from '@/lib/api/audit';
import { documentsApi } from '@/lib/api/documents';
import { auditTypeLabel } from '@/lib/audit-domains';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermission } from '@/hooks/usePermission';
import type { AuditEngagementDetail, AuditChecklistItem, ChecklistTemplateControl } from '@/lib/types/domain';
import { NewFindingSlideOver, type FindingPrefill } from './NewFindingSlideOver';

function normalizeChecklists(
  data: Record<string, AuditChecklistItem[]> | AuditChecklistItem[] | undefined | null,
): { flat: AuditChecklistItem[]; grouped: [string, AuditChecklistItem[]][] } {
  if (!data) return { flat: [], grouped: [] };

  if (Array.isArray(data)) {
    const map = new Map<string, AuditChecklistItem[]>();
    data.forEach((it) => {
      const key = it.auditType;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    });
    return { flat: data, grouped: Array.from(map.entries()) };
  }

  const flat = Object.values(data).flat();
  const grouped = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  return { flat, grouped };
}

export const ChecklistsTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const canRaiseFinding = usePermission('finding:create');
  const canUpdateChecklist = usePermission('checklist:update');
  const [bulkResult, setBulkResult] = useState<'passed' | 'not_applicable'>('not_applicable');
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [findingPrefill, setFindingPrefill] = useState<FindingPrefill | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [addControlModalOpen, setAddControlModalOpen] = useState(false);

  const isClosed = engagement.status === 'closed';

  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'checklists'],
    queryFn: () => checklistsApi.listByEngagement(engagement.id),
  });

  const evidence = useQuery({
    queryKey: ['engagements', engagement.id, 'evidence'],
    queryFn: () => evidenceApi.listByEngagement(engagement.id),
  });

  const evidenceById = useMemo(
    () => new Map((evidence.data ?? []).map((e) => [e.id, e])),
    [evidence.data],
  );

  // Findings already raised from a control test — so a failed control shows its
  // finding instead of offering to raise a duplicate.
  const findings = useQuery({
    queryKey: ['engagements', engagement.id, 'findings'],
    queryFn: () => findingsApi.listByEngagement(engagement.id),
  });
  const findingByChecklistId = useMemo(
    () => new Map((findings.data ?? []).filter((f) => f.checklistId).map((f) => [f.checklistId!, f])),
    [findings.data],
  );

  // Latest notes text per checklist row, including drafts not yet saved (the
  // NotesInput saves on blur, so a fresh note can still be missing from the
  // cached query row when "Raise finding" is clicked straight after typing).
  const notesDrafts = useRef(new Map<string, string>());

  const openFindingForm = (item: AuditChecklistItem): void => {
    const notes = notesDrafts.current.get(item.id) ?? item.notes;
    const prefix = `Control ${item.controlReference} failed: `;
    const maxDescLen = Math.max(40, 195 - prefix.length);
    const rawDesc = item.controlDescription.trim();
    let shortDesc = rawDesc;
    if (rawDesc.length > maxDescLen) {
      const sliced = rawDesc.slice(0, maxDescLen - 1);
      const lastSpace = sliced.lastIndexOf(' ');
      shortDesc = `${(lastSpace > maxDescLen * 0.6 ? sliced.slice(0, lastSpace) : sliced).replace(/[,;:\s]+$/, '')}…`;
    }
    setFindingPrefill({
      checklistId: item.id,
      title: `${prefix}${shortDesc}`,
      description: [
        `Control ${item.controlReference} — ${item.controlDescription}`,
        item.testProcedure ? `Test procedure: ${item.testProcedure}` : null,
        notes ? `Test notes: ${notes}` : null,
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
  };

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { result: string; notes?: string | null } }) =>
      checklistsApi.update(id, dto),
    onSuccess: (updated) => {
      // Patch the returned row into the cached checklist in place — no refetch. This skips
      // the heavy full engagement-detail refetch on every test; the Overview progress ring
      // refreshes on next detail load (a single test rarely advances status, and the backend
      // reconcile is fire-and-forget with an hourly backstop job).
      qc.setQueryData<Record<string, AuditChecklistItem[]>>(
        ['engagements', engagement.id, 'checklists'],
        (old) => {
          if (!old) return old;
          const next: Record<string, AuditChecklistItem[]> = {};
          for (const [group, items] of Object.entries(old)) {
            next[group] = items.map((it) => (it.id === updated.id ? updated : it));
          }
          return next;
        },
      );
      // Refresh only the engagement summary (not the checklist or sub-tabs) so the
      // "What's next" card and progress ring reflect the test just recorded.
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id], exact: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const attachEvidence = useMutation({
    mutationFn: async ({ itemId, file }: { itemId: string; file: File }) => {
      const evidence = await evidenceApi.upload(engagement.id, file, `Checklist evidence: ${itemId}`);
      return checklistsApi.linkEvidence(itemId, evidence.id);
    },
    onSuccess: () => {
      toast.success('Evidence attached');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'checklists'] });
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'evidence'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to attach evidence'),
  });

  const { flat, grouped } = useMemo(() => normalizeChecklists(list.data), [list.data]);

  // Bulk-record one result for every control not yet tested. Each row is saved
  // through the same endpoint as a single test, so audit logging and the
  // engagement status reconcile behave exactly as for individual updates.
  const untested = flat.filter((c) => c.result === 'not_tested');
  const runBulk = async (): Promise<void> => {
    setBulkRunning(true);
    let done = 0;
    try {
      for (const item of untested) {
        await checklistsApi.update(item.id, { result: bulkResult });
        done += 1;
      }
      toast.success(`${done} control${done === 1 ? '' : 's'} marked ${humanizeStatus(bulkResult).toLowerCase()}`);
    } catch (e) {
      toast.error(`Stopped after ${done} of ${untested.length}: ${e instanceof Error ? e.message : 'Failed'}`);
    } finally {
      setBulkRunning(false);
      setBulkConfirmOpen(false);
      await qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    }
  };

  const total = flat.length;
  const tested = flat.filter((c) => c.result !== 'not_tested').length;
  const passed = flat.filter((c) => c.result === 'passed').length;
  const failed = flat.filter((c) => c.result === 'failed').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Checklists</h2>
          <p className="text-xs text-text-secondary">
            Control test register for this engagement. Upload an Act/Policy or import from the Control Library to generate checklist controls.
          </p>
        </div>
        {canUpdateChecklist && !isClosed && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Upload className="h-3.5 w-3.5" />}
              onClick={() => setUploadModalOpen(true)}
            >
              Upload Act / Policy
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Library className="h-3.5 w-3.5" />}
              onClick={() => setLibraryModalOpen(true)}
            >
              Import from Control Library
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setAddControlModalOpen(true)}
            >
              Add Control
            </Button>
          </div>
        )}
      </div>

      {list.isLoading ? (
        <Card>
          <Skeleton className="h-3 w-1/3 mb-3" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="h-4 w-4" />}
            title="No checklist items yet"
            description="A default control set is generated for the engagement audit type."
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <ProgressBar
                tested={tested}
                passed={passed}
                failed={failed}
                total={total}
              />
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                <span><span className="font-semibold text-success">{passed}</span> passed</span>
                <span><span className="font-semibold text-danger">{failed}</span> failed</span>
                <span><span className="font-semibold text-text-primary">{tested}</span> tested</span>
                <span><span className="font-semibold text-text-muted">{total - tested}</span> not tested</span>
              </div>
            </div>
            {canUpdateChecklist && untested.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
                <span className="text-text-secondary">Bulk update the {untested.length} untested controls:</span>
                <Select
                  className="w-44"
                  value={bulkResult}
                  onChange={(e) => setBulkResult(e.target.value as 'passed' | 'not_applicable')}
                  aria-label="Bulk result"
                >
                  <option value="not_applicable">Not applicable</option>
                  <option value="passed">Passed</option>
                </Select>
                <Button size="sm" variant="secondary" onClick={() => setBulkConfirmOpen(true)}>
                  Apply to all untested
                </Button>
              </div>
            )}
          </Card>
          <ConfirmDialog
            open={bulkConfirmOpen}
            title={`Mark ${untested.length} controls as ${humanizeStatus(bulkResult).toLowerCase()}?`}
            description="This records a result for every control you have not individually tested. Only do this where the testing has genuinely been done or the controls do not apply. You can still change any single control afterwards."
            confirmLabel="Apply to all"
            variant="primary"
            isLoading={bulkRunning}
            onConfirm={() => void runBulk()}
            onCancel={() => setBulkConfirmOpen(false)}
          />

          {grouped.map(([type, items]) => (
            <Card key={type} className="mb-4" padded={false}>
              <div className="border-b border-border bg-surface-alt px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {auditTypeLabel(type)}
                </p>
              </div>
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold text-text-primary">
                          {item.controlReference}
                        </p>
                        <p className="text-sm text-text-primary">{item.controlDescription}</p>
                        {item.testProcedure && (
                          <p className="mt-1 text-xs text-text-secondary">{item.testProcedure}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={item.result}
                          onChange={(e) => update.mutate({ id: item.id, dto: { result: e.target.value } })}
                          className="w-40 h-8 text-xs"
                        >
                          <option value="not_tested">Not tested</option>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                          <option value="not_applicable">Not applicable</option>
                        </Select>
                        <NotesInput
                          initial={item.notes ?? ''}
                          onDraft={(v) => notesDrafts.current.set(item.id, v)}
                          onSave={(v) => update.mutate({ id: item.id, dto: { result: item.result, notes: v || null } })}
                        />
                        <EvidenceAttach
                          attached={Boolean(item.evidenceId)}
                          highlight={item.result === 'failed' && !item.evidenceId}
                          isUploading={attachEvidence.isPending && attachEvidence.variables?.itemId === item.id}
                          onFile={(file) => attachEvidence.mutate({ itemId: item.id, file })}
                        />
                        {item.result === 'failed' &&
                          (findingByChecklistId.get(item.id) ? (
                            <Link
                              href={`/audit/findings/${findingByChecklistId.get(item.id)!.id}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-700 hover:bg-red-100"
                              title={findingByChecklistId.get(item.id)!.title}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Finding raised
                            </Link>
                          ) : (
                            canRaiseFinding && (
                              <button
                                type="button"
                                onClick={() => openFindingForm(item)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                                title="Raise a finding from this failed control — the finding stays linked to this test"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Raise finding
                              </button>
                            )
                          ))}
                      </div>
                    </div>
                    {item.evidenceId && evidenceById.get(item.evidenceId) && (
                      <a
                        href={documentsApi.downloadUrl(evidenceById.get(item.evidenceId)!.documentId)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {evidenceById.get(item.evidenceId)!.fileName}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </>
      )}

      <NewFindingSlideOver
        engagement={engagement}
        open={findingPrefill !== null}
        onClose={() => setFindingPrefill(null)}
        prefill={findingPrefill ?? undefined}
      />

      {canUpdateChecklist && !isClosed && (
        <>
          <UploadActPolicySlideOver
            engagementId={engagement.id}
            auditType={engagement.auditType}
            open={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            onImported={() => {
              setUploadModalOpen(false);
              qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'checklists'] });
              qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
            }}
          />
          <ImportFromLibrarySlideOver
            engagementId={engagement.id}
            auditType={engagement.auditType}
            open={libraryModalOpen}
            onClose={() => setLibraryModalOpen(false)}
            onImported={() => {
              setLibraryModalOpen(false);
              qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'checklists'] });
              qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
            }}
          />
          <AddCustomControlSlideOver
            engagementId={engagement.id}
            auditType={engagement.auditType}
            open={addControlModalOpen}
            onClose={() => setAddControlModalOpen(false)}
            onAdded={() => {
              setAddControlModalOpen(false);
              qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'checklists'] });
              qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
            }}
          />
        </>
      )}
    </div>
  );
};

interface ExtractedPreviewResponse {
  suggestedCode: string;
  suggestedName: string;
  controls: ChecklistTemplateControl[];
}

const UploadActPolicySlideOver = ({
  engagementId,
  auditType,
  open,
  onClose,
  onImported,
}: {
  engagementId: string;
  auditType: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}): JSX.Element => {
  const [file, setFile] = useState<File | null>(null);
  const [prefix, setPrefix] = useState('');
  const [controls, setControls] = useState<ChecklistTemplateControl[]>([]);
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [frameworkCode, setFrameworkCode] = useState('');
  const [frameworkName, setFrameworkName] = useState('');
  const [category, setCategory] = useState('regulatory');

  const extractPreview = useMutation({
    mutationFn: async (selectedFile: File) => {
      const fd = new FormData();
      fd.append('file', selectedFile);
      if (prefix.trim()) fd.append('prefix', prefix.trim());
      return api.upload<ExtractedPreviewResponse>('/audit/compliance/extract-preview', fd);
    },
    onSuccess: (res) => {
      setControls(res.controls);
      if (!frameworkCode) setFrameworkCode(res.suggestedCode);
      if (!frameworkName) setFrameworkName(res.suggestedName);
      toast.success(`Extracted ${res.controls.length} checklist control(s) from document`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to parse document'),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const cleaned = controls
        .map((c) => ({
          controlReference: c.controlReference.trim(),
          controlDescription: c.controlDescription.trim(),
          testProcedure: c.testProcedure.trim(),
        }))
        .filter((c) => c.controlReference && c.controlDescription && c.testProcedure);

      if (cleaned.length === 0) {
        throw new Error('Add or extract at least one valid control before importing');
      }

      const fd = new FormData();
      if (file) fd.append('file', file);
      if (prefix.trim()) fd.append('prefix', prefix.trim());
      fd.append('controls', JSON.stringify(cleaned));
      fd.append('auditType', auditType);
      fd.append('saveToLibrary', String(saveToLibrary));
      if (saveToLibrary) {
        if (frameworkCode.trim()) fd.append('frameworkCode', frameworkCode.trim());
        if (frameworkName.trim()) fd.append('frameworkName', frameworkName.trim());
        fd.append('category', category);
      }

      return api.upload<{ addedCount: number }>(
        `/audit/engagements/${engagementId}/checklists/import-document`,
        fd,
      );
    },
    onSuccess: (res) => {
      toast.success(`${res.addedCount} control(s) imported into engagement checklist`);
      setFile(null);
      setControls([]);
      onImported();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to import controls'),
  });

  const updateRow = (idx: number, field: keyof ChecklistTemplateControl, value: string) => {
    setControls((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const removeRow = (idx: number) => {
    setControls((prev) => prev.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    setControls((prev) => [
      ...prev,
      {
        controlReference: `${prefix.trim() || 'CTRL'}-${String(prev.length + 1).padStart(3, '0')}`,
        controlDescription: '',
        testProcedure: '',
      },
    ]);
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Upload Act / Policy / Framework"
      description="Upload a PDF, Word (.docx), Excel/CSV, or TXT document (e.g. Pension Reform Act, Procurement Policy, SOP) to automatically extract and customize audit checklist items."
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => importMutation.mutate()}
            isLoading={importMutation.isPending}
            disabled={controls.length === 0}
          >
            Import into Engagement Checklist ({controls.length})
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <FormField label="Document File (PDF, DOCX, XLSX, CSV, TXT)" required>
              <Input
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
                onChange={(e) => {
                  const selected = e.target.files?.[0] ?? null;
                  setFile(selected);
                  if (selected) {
                    extractPreview.mutate(selected);
                  }
                }}
              />
            </FormField>
          </div>
          <FormField label="Reference Prefix (optional)">
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. PEN, PROC, SOP"
            />
          </FormField>
        </div>

        {file && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs">
            <span className="text-text-secondary">
              Selected: <strong className="text-text-primary">{file.name}</strong>
            </span>
            <Button
              size="sm"
              variant="secondary"
              isLoading={extractPreview.isPending}
              onClick={() => extractPreview.mutate(file)}
            >
              Re-extract with Prefix
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-surface-alt p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
            <input
              type="checkbox"
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
            />
            Also save as a reusable Framework / Act in the Control Library
          </label>
          {saveToLibrary && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
              <FormField label="Framework Code" required>
                <Input
                  value={frameworkCode}
                  onChange={(e) => setFrameworkCode(e.target.value)}
                  placeholder="e.g. PRA-2014"
                />
              </FormField>
              <FormField label="Framework / Act Name" required>
                <Input
                  value={frameworkName}
                  onChange={(e) => setFrameworkName(e.target.value)}
                  placeholder="e.g. Pension Reform Act 2014"
                />
              </FormField>
              <FormField label="Category" required>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="act">Act / Legislation</option>
                  <option value="regulatory">Regulatory Guideline</option>
                  <option value="policy">Internal Policy / SOP</option>
                  <option value="standard">Standard / Framework</option>
                </Select>
              </FormField>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Extracted Checklist Controls ({controls.length})
            </p>
            <Button size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addRow}>
              Add Row
            </Button>
          </div>
          {extractPreview.isPending ? (
            <p className="text-xs text-text-muted py-4">Extracting clauses and controls from document…</p>
          ) : controls.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-muted">
              Select a document above to extract checklist items automatically, or click &ldquo;Add Row&rdquo; to enter controls manually.
            </p>
          ) : (
            <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
              {controls.map((c, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={c.controlReference}
                      onChange={(e) => updateRow(idx, 'controlReference', e.target.value)}
                      placeholder="Control Reference"
                      className="font-mono text-xs"
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeRow(idx)} aria-label="Remove row">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    value={c.controlDescription}
                    onChange={(e) => updateRow(idx, 'controlDescription', e.target.value)}
                    placeholder="Control requirement / description"
                  />
                  <Textarea
                    rows={2}
                    value={c.testProcedure}
                    onChange={(e) => updateRow(idx, 'testProcedure', e.target.value)}
                    placeholder="Audit test procedure"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SlideOver>
  );
};

const ImportFromLibrarySlideOver = ({
  engagementId,
  auditType,
  open,
  onClose,
  onImported,
}: {
  engagementId: string;
  auditType: string;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}): JSX.Element => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const frameworks = useQuery({
    queryKey: ['compliance', 'frameworks'],
    queryFn: () => complianceApi.listFrameworks(),
    enabled: open,
  });

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const importMutation = useMutation({
    mutationFn: () =>
      api.post<{ addedCount: number }>(
        `/audit/engagements/${engagementId}/checklists/import-framework`,
        { frameworkIds: selectedIds, auditType },
      ),
    onSuccess: (res) => {
      toast.success(`${res.addedCount} control(s) imported from Control Library`);
      setSelectedIds([]);
      onImported();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to import framework controls'),
  });

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Import from Control Library"
      description="Select one or more Acts, Policies, or Frameworks from the Control Library to import their active controls into this engagement."
      width="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => importMutation.mutate()}
            isLoading={importMutation.isPending}
            disabled={selectedIds.length === 0}
          >
            Import Selected ({selectedIds.length})
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {frameworks.isLoading ? (
          <p className="text-xs text-text-muted">Loading frameworks…</p>
        ) : (frameworks.data ?? []).length === 0 ? (
          <p className="text-xs text-text-muted">No frameworks found in the Control Library.</p>
        ) : (
          (frameworks.data ?? [])
            .filter((f) => f.isActive)
            .map((fw) => {
              const checked = selectedIds.includes(fw.id);
              return (
                <label
                  key={fw.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    checked ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-primary/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(fw.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{fw.code}</span>
                      <Badge tone="gray">{humanizeStatus(fw.category)}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-text-primary">{fw.name}</p>
                    {fw.description && (
                      <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">{fw.description}</p>
                    )}
                  </div>
                </label>
              );
            })
        )}
      </div>
    </SlideOver>
  );
};

const AddCustomControlSlideOver = ({
  engagementId,
  auditType,
  open,
  onClose,
  onAdded,
}: {
  engagementId: string;
  auditType: string;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}): JSX.Element => {
  const [controlReference, setControlReference] = useState('');
  const [controlDescription, setControlDescription] = useState('');
  const [testProcedure, setTestProcedure] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<AuditChecklistItem>(`/audit/engagements/${engagementId}/checklists`, {
        auditType,
        controlReference: controlReference.trim(),
        controlDescription: controlDescription.trim(),
        testProcedure: testProcedure.trim(),
      }),
    onSuccess: () => {
      toast.success('Checklist control added');
      setControlReference('');
      setControlDescription('');
      setTestProcedure('');
      onAdded();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add checklist control'),
  });

  const valid =
    controlReference.trim().length > 0 &&
    controlDescription.trim().length > 0 &&
    testProcedure.trim().length > 0;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add Custom Checklist Control"
      description="Add an engagement-specific control requirement and test procedure."
      width="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
            disabled={!valid}
          >
            Add Control
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Control Reference" required>
          <Input
            value={controlReference}
            onChange={(e) => setControlReference(e.target.value)}
            placeholder="e.g. PEN-CUSTOM-001"
          />
        </FormField>
        <FormField label="Control Description / Requirement" required>
          <Textarea
            rows={3}
            value={controlDescription}
            onChange={(e) => setControlDescription(e.target.value)}
            placeholder="Describe the control or policy requirement being tested…"
          />
        </FormField>
        <FormField label="Test Procedure" required>
          <Textarea
            rows={3}
            value={testProcedure}
            onChange={(e) => setTestProcedure(e.target.value)}
            placeholder="Describe the steps the auditor should perform to verify compliance…"
          />
        </FormField>
      </div>
    </SlideOver>
  );
};

const NotesInput = ({
  initial,
  onDraft,
  onSave,
}: {
  initial: string;
  onDraft: (v: string) => void;
  onSave: (v: string) => void;
}): JSX.Element => {
  const [value, setValue] = useState(initial);
  return (
    <Input
      value={value}
      placeholder="Notes…"
      onChange={(e) => {
        setValue(e.target.value);
        onDraft(e.target.value);
      }}
      onBlur={() => {
        if (value !== initial) onSave(value);
      }}
      className="w-56 h-8 text-xs"
    />
  );
};

const EvidenceAttach = ({
  attached,
  highlight,
  isUploading,
  onFile,
}: {
  attached: boolean;
  highlight: boolean;
  isUploading: boolean;
  onFile: (file: File) => void;
}): JSX.Element => {
  return (
    <label
      className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        attached
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : highlight
            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'border-border text-text-secondary hover:bg-surface-alt'
      }`}
      title={attached ? 'Evidence attached — upload to replace' : 'Attach evidence for this control'}
    >
      {attached ? <Check className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
      {isUploading ? 'Uploading…' : attached ? 'Evidence' : 'Attach evidence'}
      <input
        type="file"
        className="hidden"
        disabled={isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </label>
  );
};

const ProgressBar = ({
  tested,
  passed,
  failed,
  total,
}: {
  tested: number;
  passed: number;
  failed: number;
  total: number;
}): JSX.Element => {
  if (total === 0) return <span className="text-xs text-text-muted">No items</span>;
  const passedPct = (passed / total) * 100;
  const failedPct = (failed / total) * 100;
  const otherTestedPct = ((tested - passed - failed) / total) * 100;

  return (
    <div className="flex-1 min-w-[240px]">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="bg-emerald-500" style={{ width: `${passedPct}%` }} />
        <div className="bg-red-500" style={{ width: `${failedPct}%` }} />
        <div className="bg-blue-400" style={{ width: `${otherTestedPct}%` }} />
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-text-muted">
        {Math.round((tested / total) * 100)}% tested
      </p>
    </div>
  );
};
