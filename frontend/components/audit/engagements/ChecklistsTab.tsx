'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Paperclip, Check, Download } from 'lucide-react';

import { Card } from '@/components/ui/Card';
import { Select, Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { checklistsApi, evidenceApi, findingsApi } from '@/lib/api/audit';
import { documentsApi } from '@/lib/api/documents';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermission } from '@/hooks/usePermission';
import type { AuditEngagementDetail, AuditChecklistItem } from '@/lib/types/domain';
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
  const [findingPrefill, setFindingPrefill] = useState<FindingPrefill | null>(null);

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
    setFindingPrefill({
      checklistId: item.id,
      title: `Control ${item.controlReference} failed: ${item.controlDescription.slice(0, 120)}`,
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

  const total = flat.length;
  const tested = flat.filter((c) => c.result !== 'not_tested').length;
  const passed = flat.filter((c) => c.result === 'passed').length;
  const failed = flat.filter((c) => c.result === 'failed').length;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary">Checklists</h2>
        <p className="text-xs text-text-secondary">Control test register for this engagement.</p>
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
          </Card>

          {grouped.map(([type, items]) => (
            <Card key={type} className="mb-4" padded={false}>
              <div className="border-b border-border bg-surface-alt px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {humanizeStatus(type)} Audit
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
    </div>
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
