'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Award, Check, Plus, Trash2, ListChecks } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { Badge } from '@/components/ui/Badge';
import { UserSelect } from '@/components/common/UserSelect';
import { ScoredUserSelect } from '@/components/common/ScoredUserSelect';
import { checklistsApi, engagementsApi, plansApi, universeApi } from '@/lib/api/audit';
import { workflowApi } from '@/lib/api/workflow';
import { usersApi } from '@/lib/api/users';
import { getMatchScore, isRelevantSkill } from './assignment-matching';
import type { AuditEngagement, ChecklistTemplateControl } from '@/lib/types/domain';

type Mode = 'plan' | 'ad_hoc';
type AuditType = 'it' | 'financial' | 'compliance' | 'systems';
type Priority = 'low' | 'medium' | 'high' | 'critical';

const toISO = (d: string): string => (d ? `${d}T00:00:00.000Z` : d);

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-select the audit type — used by the dedicated domain modules. */
  initialAuditType?: AuditType;
  /** Pre-select the starting mode — domain modules open straight into ad-hoc. */
  initialMode?: Mode;
}

export const StartAuditWizard = ({
  open,
  onClose,
  initialAuditType,
  initialMode = 'plan',
}: Props): JSX.Element => {
  const qc = useQueryClient();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>(initialMode);

  // scope
  const [planId, setPlanId] = useState('');
  const [planItemId, setPlanItemId] = useState('');
  const [universeId, setUniverseId] = useState('');
  const [auditType, setAuditType] = useState<AuditType>(initialAuditType ?? 'compliance');
  const [priority, setPriority] = useState<Priority>('medium');
  const [adhocReason, setAdhocReason] = useState('');
  // team + schedule
  const [title, setTitle] = useState('');
  const [leadAuditorId, setLeadAuditorId] = useState('');
  const [auditManagerId, setAuditManagerId] = useState('');
  const [auditeeId, setAuditeeId] = useState('');
  const [supportingIds, setSupportingIds] = useState<string[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sla, setSla] = useState('');
  const [slaTouched, setSlaTouched] = useState(false);
  const [plannedHours, setPlannedHours] = useState('');
  // per-engagement checklist controls (customisable, pre-filled from the template)
  const [checklistControls, setChecklistControls] = useState<ChecklistTemplateControl[]>([]);
  const [checklistTouched, setChecklistTouched] = useState(false);
  // created
  const [created, setCreated] = useState<AuditEngagement | null>(null);

  const reset = () => {
    setStep(1);
    setMode(initialMode);
    setPlanId('');
    setPlanItemId('');
    setUniverseId('');
    setAuditType(initialAuditType ?? 'compliance');
    setPriority('medium');
    setAdhocReason('');
    setTitle('');
    setLeadAuditorId('');
    setAuditManagerId('');
    setAuditeeId('');
    setSupportingIds([]);
    setCandidateSearch('');
    setStart('');
    setEnd('');
    setSla('');
    setSlaTouched(false);
    setChecklistControls([]);
    setChecklistTouched(false);
    setCreated(null);
  };

  useEffect(() => {
    if (open) reset();
  }, [open]);

  // SLA prefills to the end date until the user edits it.
  useEffect(() => {
    if (!slaTouched && end) setSla(end);
  }, [end, slaTouched]);

  const plans = useQuery({
    queryKey: ['plans', 'approved'],
    queryFn: () => plansApi.list({ pageSize: 50, status: 'approved' }),
    enabled: open && mode === 'plan',
  });
  const planDetail = useQuery({
    queryKey: ['plans', planId],
    queryFn: () => plansApi.get(planId),
    enabled: open && mode === 'plan' && Boolean(planId),
  });
  const universe = useQuery({
    queryKey: ['universe', 'active', 'all'],
    queryFn: () => universeApi.list({ pageSize: 100, status: 'active' }),
    enabled: open && mode === 'ad_hoc',
  });

  const entityOptions: ComboboxOption[] = useMemo(
    () =>
      (universe.data?.items ?? []).map((e) => ({
        value: e.id,
        label: e.name,
        hint: `${e.category} · risk ${e.riskScore}`,
      })),
    [universe.data],
  );
  const selectedEntity = (universe.data?.items ?? []).find((e) => e.id === universeId) ?? null;

  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.list({ pageSize: 100 }),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const userName = (userId: string): string => {
    const u = usersQuery.data?.items.find((x) => x.id === userId);
    return u ? (u.displayName || `${u.firstName} ${u.lastName}`) : userId;
  };

  // Audit type drives skill matching — from the plan item (plan mode) or the picked type (ad-hoc).
  const effectiveAuditType = useMemo(() => {
    if (mode === 'plan') {
      return (planDetail.data?.items ?? []).find((i) => i.id === planItemId)?.auditType ?? auditType;
    }
    return auditType;
  }, [mode, planDetail.data, planItemId, auditType]);

  // Checklist controls that would populate this engagement — pulled once we reach
  // the Review step and the audit type is known, used to pre-fill the editor.
  const controlsPreview = useQuery({
    queryKey: ['checklist-controls', effectiveAuditType],
    queryFn: () => checklistsApi.previewControls(effectiveAuditType),
    enabled: open && step === 3 && Boolean(effectiveAuditType),
    staleTime: 5 * 60_000,
  });

  // Changing the audit type discards prior edits so the correct template loads.
  useEffect(() => {
    setChecklistTouched(false);
  }, [effectiveAuditType]);

  // Seed the editor from the template until the creator edits it.
  useEffect(() => {
    if (step === 3 && !checklistTouched && controlsPreview.data) {
      setChecklistControls(controlsPreview.data);
    }
  }, [step, checklistTouched, controlsPreview.data]);

  const updateControl = (idx: number, field: keyof ChecklistTemplateControl, value: string) => {
    setChecklistTouched(true);
    setChecklistControls((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const removeControl = (idx: number) => {
    setChecklistTouched(true);
    setChecklistControls((prev) => prev.filter((_, i) => i !== idx));
  };
  const addControl = () => {
    setChecklistTouched(true);
    setChecklistControls((prev) => [...prev, { controlReference: '', controlDescription: '', testProcedure: '' }]);
  };

  // Supporting-auditor candidates: active users (excluding the core roles), ranked by skill match.
  const supportingCandidates = useMemo(() => {
    const coreIds = [leadAuditorId, auditManagerId, auditeeId];
    const q = candidateSearch.trim().toLowerCase();
    return (usersQuery.data?.items ?? [])
      .filter((u) => u.isActive && !coreIds.includes(u.id))
      .filter((u) => {
        if (!q) return true;
        const name = (u.displayName || `${u.firstName} ${u.lastName}`).toLowerCase();
        return name.includes(q) || u.skills.some((s) => s.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const diff = getMatchScore(b.skills, effectiveAuditType) - getMatchScore(a.skills, effectiveAuditType);
        if (diff !== 0) return diff;
        return (a.displayName || a.firstName).localeCompare(b.displayName || b.firstName);
      });
  }, [usersQuery.data, leadAuditorId, auditManagerId, auditeeId, candidateSearch, effectiveAuditType]);

  const create = useMutation({
    mutationFn: async (): Promise<AuditEngagement> => {
      // Only send controls that are fully filled in; an empty list lets the
      // backend fall back to the global per-audit-type template.
      const cleanedControls = checklistControls
        .map((c) => ({
          controlReference: c.controlReference.trim(),
          controlDescription: c.controlDescription.trim(),
          testProcedure: c.testProcedure.trim(),
        }))
        .filter((c) => c.controlReference && c.controlDescription && c.testProcedure);
      const checklistControlsArg = cleanedControls.length > 0 ? cleanedControls : undefined;

      const eng = mode === 'plan'
        ? await engagementsApi.createFromPlan({
            title: title.trim(),
            leadAuditorId,
            auditManagerId,
            auditeeId,
            plannedStartDate: toISO(start),
            plannedEndDate: toISO(end),
            slaDeadline: toISO(sla),
            plannedHours: Number(plannedHours) > 0 ? Math.round(Number(plannedHours)) : undefined,
            planItemId,
            checklistControls: checklistControlsArg,
          })
        : await engagementsApi.createAdhoc({
            title: title.trim(),
            leadAuditorId,
            auditManagerId,
            auditeeId,
            plannedStartDate: toISO(start),
            plannedEndDate: toISO(end),
            slaDeadline: toISO(sla),
            plannedHours: Number(plannedHours) > 0 ? Math.round(Number(plannedHours)) : undefined,
            universeId,
            auditType,
            priority,
            adhocReason: adhocReason.trim(),
            checklistControls: checklistControlsArg,
          });

      // Assign the supporting auditors picked in step 2.
      if (supportingIds.length > 0) {
        const results = await Promise.allSettled(
          supportingIds.map((userId) =>
            workflowApi.createAssignment({ engagementId: eng.id, userId, role: 'supporting_auditor' }),
          ),
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) toast.warning(`${failed} supporting auditor(s) could not be assigned — add them from the engagement.`);
      }
      return eng;
    },
    onSuccess: (eng) => {
      setCreated(eng);
      qc.invalidateQueries({ queryKey: ['engagements'] });
      setStep(4);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create engagement'),
  });

  const startNow = useMutation({
    mutationFn: () => engagementsApi.updateStatus(created!.id, 'in_progress'),
    onSuccess: () => finish(),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to start'),
  });

  const finish = () => {
    const id = created?.id;
    onClose();
    if (id) router.push(`/audit/engagements/${id}`);
  };

  // ── per-step validation ──
  const scopeValid =
    mode === 'plan' ? Boolean(planItemId) : Boolean(universeId) && adhocReason.trim().length >= 5;
  const teamValid =
    title.trim().length >= 2 &&
    Boolean(leadAuditorId && auditManagerId && auditeeId) &&
    Boolean(start && end && sla) &&
    new Date(end) >= new Date(start) &&
    new Date(sla) >= new Date(start);

  const goNext = () => {
    if (step === 1 && !scopeValid) {
      toast.error(mode === 'plan' ? 'Select a plan item' : 'Select an entity and give an ad-hoc reason (min 5 chars)');
      return;
    }
    if (step === 2 && !teamValid) {
      toast.error('Complete the team and a valid schedule (end and SLA on/after start)');
      return;
    }
    setStep((s) => s + 1);
  };

  const stepLabels = ['Scope', 'Team & schedule', 'Review', 'Launch'];

  // Past the first step, or with anything typed, closing would lose the wizard's
  // progress. Once the engagement exists (step 4) there is nothing left to lose.
  const isDirty = !created && (step > 1 || Boolean(title.trim()) || Boolean(planItemId) || Boolean(universeId));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      dirty={isDirty}
      title="Start an audit"
      description={`Step ${step} of 4 · ${stepLabels[step - 1]}`}
      width="xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-text-muted">{stepLabels[step - 1]}</div>
          <div className="flex gap-2">
            {step > 1 && step < 4 && (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < 3 && (
              <Button size="sm" onClick={goNext}>
                Next
              </Button>
            )}
            {step === 3 && (
              <Button size="sm" onClick={() => create.mutate()} isLoading={create.isPending}>
                Create engagement
              </Button>
            )}
            {step === 4 && (
              <div className="flex flex-col items-end gap-2 w-full">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={finish}>
                    Save &amp; review later
                  </Button>
                  <Button size="sm" onClick={() => startNow.mutate()} isLoading={startNow.isPending}>
                    Start fieldwork
                  </Button>
                </div>
                <p className="text-[11px] text-text-muted text-right max-w-xs">
                  &quot;Save &amp; review later&quot; leaves the engagement in Planning status. Start fieldwork when your team is ready.
                </p>
              </div>
            )}
          </div>
        </div>
      }
    >
      {/* Step indicator */}
      <ol className="mb-5 flex items-center gap-2 text-xs">
        {stepLabels.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  done ? 'bg-primary text-white' : current ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'bg-surface-alt text-text-muted'
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : n}
              </span>
              <span className={current ? 'font-medium text-text-primary' : 'text-text-muted'}>{label}</span>
              {n < 4 && <span className="mx-1 h-px w-4 bg-border" />}
            </li>
          );
        })}
      </ol>

      {/* Step 1 — Scope */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="inline-flex rounded-md border border-border bg-surface-alt p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode('plan')}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${mode === 'plan' ? 'bg-white text-primary shadow-card' : 'text-text-secondary'}`}
            >
              From plan item
            </button>
            <button
              type="button"
              onClick={() => setMode('ad_hoc')}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${mode === 'ad_hoc' ? 'bg-white text-primary shadow-card' : 'text-text-secondary'}`}
            >
              Ad-hoc
            </button>
          </div>

          {mode === 'plan' ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Plan" required>
                  <Select value={planId} onChange={(e) => { setPlanId(e.target.value); setPlanItemId(''); }}>
                    <option value="">Select plan…</option>
                    {plans.data?.items.map((p) => (
                      <option key={p.id} value={p.id}>{p.title} ({p.year})</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Plan item" required>
                  <Select value={planItemId} onChange={(e) => setPlanItemId(e.target.value)} disabled={!planId || planDetail.isLoading}>
                    <option value="">Select item…</option>
                    {(planDetail.data?.items ?? []).filter((i) => !i.engagementCreated).map((it) => (
                      <option key={it.id} value={it.id}>{it.universeName} ({it.auditType})</option>
                    ))}
                  </Select>
                </FormField>
              </div>
              {planId && !planDetail.isLoading && (planDetail.data?.items ?? []).filter((i) => !i.engagementCreated).length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No available items on this plan.{' '}
                  <Link
                    href={`/audit/plans/${planId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-medium"
                  >
                    Open the plan
                  </Link>
                  {' '}to add auditable entities, then come back here.
                </p>
              )}
            </>
          ) : (
            <>
              <FormField label="Auditable entity" required>
                <Combobox
                  value={universeId}
                  onChange={setUniverseId}
                  options={entityOptions}
                  placeholder="Search entities…"
                  emptyText={universe.isLoading ? 'Loading…' : 'No entities'}
                />
              </FormField>
              {selectedEntity && (
                <p className="text-xs text-text-secondary">
                  Current risk score: <Badge tone="gray">{selectedEntity.riskScore}</Badge>
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  label="Audit type"
                  required
                  tooltip="IT: infrastructure & cybersecurity (ISO 27001/22301). Financial: transactions & controls. Compliance: ISO/NDPR adherence. Systems: configuration, change & continuity."
                >
                  <Select value={auditType} onChange={(e) => setAuditType(e.target.value as AuditType)}>
                    <option value="it">IT</option>
                    <option value="financial">Financial</option>
                    <option value="compliance">Compliance</option>
                    <option value="systems">Systems</option>
                  </Select>
                </FormField>
                <FormField
                  label="Priority"
                  required
                  tooltip="Drives scheduling and SLA expectations. Critical/High engagements escalate faster when overdue."
                >
                  <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Select>
                </FormField>
              </div>
              <FormField
                label="Ad-hoc reason"
                required
                description="Required for audits outside the approved annual plan — explains the trigger (e.g. incident, management request)."
              >
                <Textarea rows={3} value={adhocReason} onChange={(e) => setAdhocReason(e.target.value)} placeholder="Why outside the approved plan?" />
              </FormField>
            </>
          )}
        </div>
      )}

      {/* Step 2 — Team & schedule */}
      {step === 2 && (
        <div className="space-y-4">
          <FormField label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Engagement title" />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Lead auditor" required tooltip="Owns fieldwork and day-to-day execution of the engagement. Ranked by skill match, workload and capacity.">
              <ScoredUserSelect role="lead_auditor" auditType={effectiveAuditType} priority={priority} value={leadAuditorId} onChange={setLeadAuditorId} />
            </FormField>
            <FormField label="Audit manager" required tooltip="Reviews and signs off the lead auditor's work. Lists only users who can approve.">
              <ScoredUserSelect role="audit_manager" auditType={effectiveAuditType} priority={priority} value={auditManagerId} onChange={setAuditManagerId} />
            </FormField>
          </div>
          <FormField label="Auditee" required tooltip="Primary contact in the audited area who provides evidence and management responses.">
            <UserSelect value={auditeeId} onChange={setAuditeeId} />
          </FormField>
          <FormField
            label={`Supporting auditors${supportingIds.length > 0 ? ` (${supportingIds.length} selected)` : ''}`}
            tooltip="Optional. Additional auditors who support fieldwork. Ranked by skill match to this audit type; can be changed later."
          >
            <Input
              value={candidateSearch}
              onChange={(e) => setCandidateSearch(e.target.value)}
              placeholder="Search by name or skill…"
            />
            <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {usersQuery.isLoading ? (
                <p className="text-xs text-text-muted">Loading users…</p>
              ) : supportingCandidates.length === 0 ? (
                <p className="text-xs text-text-muted">No matching users.</p>
              ) : (
                supportingCandidates.map((c) => {
                  const selected = supportingIds.includes(c.id);
                  const matched = getMatchScore(c.skills, effectiveAuditType) > 0;
                  const relevant = c.skills.filter((s) => isRelevantSkill(s, effectiveAuditType)).slice(0, 3);
                  return (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-text-primary">
                            {c.displayName || `${c.firstName} ${c.lastName}`}
                          </p>
                          {matched && (
                            <Badge tone="purple" className="flex items-center gap-0.5">
                              <Award className="h-3 w-3" /> Recommended
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          {c.department && <span className="text-[11px] text-text-muted">{c.department}</span>}
                          {relevant.map((s) => (
                            <span key={s} className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{s}</span>
                          ))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={selected ? 'secondary' : 'primary'}
                        leftIcon={selected ? <Check className="h-3.5 w-3.5" /> : undefined}
                        onClick={() =>
                          setSupportingIds((prev) =>
                            selected ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                          )
                        }
                      >
                        {selected ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Planned start" required>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </FormField>
            <FormField label="Planned end" required>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </FormField>
            <FormField label="SLA deadline" required tooltip="Target completion date. Breaching it triggers the escalation workflow. Defaults to the end date.">
              <Input
                type="date"
                value={sla}
                onChange={(e) => { setSla(e.target.value); setSlaTouched(true); }}
              />
            </FormField>
            <FormField label="Budgeted hours" optional tooltip="Total effort budget for the engagement. The team logs actual hours against it from the engagement overview.">
              <Input
                type="number"
                min="1"
                step="1"
                value={plannedHours}
                onChange={(e) => setPlannedHours(e.target.value)}
                placeholder="e.g. 120"
              />
            </FormField>
          </div>
          {start && end && new Date(end) < new Date(start) && (
            <p className="text-xs text-danger" role="alert">End date must be on or after the start date.</p>
          )}
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div className="space-y-6">
          <dl className="space-y-3 text-sm">
            <Row label="Mode" value={mode === 'plan' ? 'From plan item' : 'Ad-hoc'} />
            {mode === 'ad_hoc' && <Row label="Entity" value={selectedEntity?.name ?? '—'} />}
            {mode === 'ad_hoc' && <Row label="Audit type" value={auditType} />}
            {mode === 'ad_hoc' && <Row label="Priority" value={priority} />}
            <Row label="Title" value={title} />
            <Row label="Lead auditor" value={userName(leadAuditorId)} />
            <Row label="Audit manager" value={userName(auditManagerId)} />
            <Row label="Auditee" value={userName(auditeeId)} />
            <Row
              label="Supporting auditors"
              value={supportingIds.length > 0 ? supportingIds.map(userName).join(', ') : 'None'}
            />
            <Row label="Schedule" value={`${start} → ${end} (SLA ${sla})`} />
          </dl>

          {/* Per-engagement checklist controls */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Checklist controls{checklistControls.length > 0 ? ` (${checklistControls.length})` : ''}
                </h3>
              </div>
              <Button type="button" size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addControl}>
                Add control
              </Button>
            </div>
            <p className="mb-3 text-xs text-text-secondary">
              Prefilled from the {effectiveAuditType} template. Edit, add or remove controls — the audit team
              will test exactly this list for this engagement. Leave empty to use the standard template.
            </p>

            {controlsPreview.isLoading ? (
              <p className="text-xs text-text-muted">Loading template…</p>
            ) : checklistControls.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface-alt px-3 py-4 text-center text-xs text-text-muted">
                No controls. The engagement will fall back to the standard {effectiveAuditType} template — or add controls above.
              </p>
            ) : (
              <div className="space-y-3">
                {checklistControls.map((c, idx) => (
                  <div key={idx} className="space-y-2 rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-start gap-2">
                      <Input
                        value={c.controlReference}
                        onChange={(e) => updateControl(idx, 'controlReference', e.target.value)}
                        placeholder="Control reference (e.g. ISO27001-A.9.2)"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeControl(idx)}
                        aria-label="Remove control"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      value={c.controlDescription}
                      onChange={(e) => updateControl(idx, 'controlDescription', e.target.value)}
                      placeholder="Control description"
                    />
                    <Textarea
                      rows={2}
                      value={c.testProcedure}
                      onChange={(e) => updateControl(idx, 'testProcedure', e.target.value)}
                      placeholder="Test procedure"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4 — Launch */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-4 w-4 stroke-[3]" />
            </span>
            <div className="text-sm">
              <p className="font-semibold text-text-primary">
                Engagement {created?.referenceNumber} created
              </p>
              <p className="text-text-secondary">
                Team assigned. Start fieldwork now, or leave it in Planning to review later.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Team</p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span className="text-text-secondary">Lead Auditor</span><span className="font-medium text-text-primary">{userName(leadAuditorId)}</span></li>
              <li className="flex justify-between"><span className="text-text-secondary">Audit Manager</span><span className="font-medium text-text-primary">{userName(auditManagerId)}</span></li>
              <li className="flex justify-between"><span className="text-text-secondary">Auditee</span><span className="font-medium text-text-primary">{userName(auditeeId)}</span></li>
              {supportingIds.map((id) => (
                <li key={id} className="flex justify-between"><span className="text-text-secondary">Supporting Auditor</span><span className="font-medium text-text-primary">{userName(id)}</span></li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </SlideOver>
  );
};

const Row = ({ label, value }: { label: string; value: string }): JSX.Element => (
  <div className="flex items-center justify-between border-b border-border pb-2">
    <dt className="text-text-secondary">{label}</dt>
    <dd className="font-medium text-text-primary">{value}</dd>
  </div>
);
