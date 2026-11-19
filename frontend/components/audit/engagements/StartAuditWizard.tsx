'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Award, Check, ChevronDown, ChevronUp, Plus, Search, Trash2, ListChecks, Upload, Library } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { Badge } from '@/components/ui/Badge';
import { UserSelect } from '@/components/common/UserSelect';
import { ScoredUserSelect } from '@/components/common/ScoredUserSelect';
import { api } from '@/lib/api-client';
import { checklistsApi, complianceApi, engagementsApi, plansApi, universeApi } from '@/lib/api/audit';
import { workflowApi } from '@/lib/api/workflow';
import { usersApi } from '@/lib/api/users';
import { auditTypeLabel, SELECTABLE_AUDIT_TYPES, type SelectableAuditTypeKey } from '@/lib/audit-domains';
import { getMatchScore, isRelevantSkill } from './assignment-matching';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ChipList } from './ChipList';
import { useAuditTypeMismatch } from '@/lib/hooks/useAuditTypeMismatch';
import type { AuditEngagement, ChecklistTemplateControl } from '@/lib/types/domain';

type Mode = 'plan' | 'ad_hoc';
type AuditType = SelectableAuditTypeKey;
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
  // Group audit: further areas covered and further people being audited.
  const [extraAreaIds, setExtraAreaIds] = useState<string[]>([]);
  const [extraAuditeeIds, setExtraAuditeeIds] = useState<string[]>([]);
  // Paste a list of email addresses to add many people being audited at once.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sla, setSla] = useState('');
  const [slaTouched, setSlaTouched] = useState(false);
  const [plannedHours, setPlannedHours] = useState('');
  // per-engagement checklist controls (customisable, pre-filled from the template)
  const [checklistControls, setChecklistControls] = useState<ChecklistTemplateControl[]>([]);
  const [checklistTouched, setChecklistTouched] = useState(false);
  // Frameworks/Acts the creator has ticked, and the control references each one brought in (so unticking
  // removes exactly those controls).
  const [selectedFrameworkIds, setSelectedFrameworkIds] = useState<string[]>([]);
  const [frameworkRefs, setFrameworkRefs] = useState<Record<string, string[]>>({});
  const [loadingFrameworkId, setLoadingFrameworkId] = useState<string | null>(null);
  const [frameworkSearch, setFrameworkSearch] = useState('');
  // Frameworks set as the default for this audit type are ticked once when the Review step opens.
  const defaultsAppliedFor = useRef<string | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  // created
  const [created, setCreated] = useState<AuditEngagement | null>(null);

  const reset = () => {
    setStep(1);
    setMode(initialMode);
    setPlanId('');
    setPlanItemId('');
    setUniverseId('');
    setExtraAreaIds([]);
    setExtraAuditeeIds([]);
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
    setSelectedFrameworkIds([]);
    setFrameworkRefs({});
    setFrameworkSearch('');
    defaultsAppliedFor.current = null;
    setDefaultsApplied(false);
    setControlSearch('');
    setControlsExpanded(false);
    setCreated(null);
  };

  useEffect(() => {
    if (open) reset();
  }, [open]);

  // OLA prefills to the end date until the user edits it.
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

  // Picking a plan item prefills the title, priority and dates it already carries, so the
  // user isn't retyping what the programme says. Everything stays editable.
  const prefilledItemRef = useRef<string>('');
  useEffect(() => {
    if (mode !== 'plan' || !planItemId) {
      prefilledItemRef.current = '';
      return;
    }
    if (prefilledItemRef.current === planItemId) return; // once per selection, never overwrite edits
    const item = (planDetail.data?.items ?? []).find((i) => i.id === planItemId);
    if (!item) return;
    prefilledItemRef.current = planItemId;
    const typeLabel = item.auditType === 'it' ? 'IT' : item.auditType.charAt(0).toUpperCase() + item.auditType.slice(1);
    setTitle(`${item.universeName} ${typeLabel} Audit${planDetail.data?.year ? ` ${planDetail.data.year}` : ''}`);
    if (item.plannedStartDate) setStart(item.plannedStartDate.slice(0, 10));
    if (item.plannedEndDate) setEnd(item.plannedEndDate.slice(0, 10));
    if (['critical', 'high', 'medium', 'low'].includes(item.priority)) setPriority(item.priority as Priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planItemId, planDetail.data, mode]);

  const universe = useQuery({
    queryKey: ['universe', 'active', 'all'],
    queryFn: () => universeApi.list({ pageSize: 100, status: 'active' }),
    enabled: open,
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
  // The entity the audit is primarily about (from the plan item, or the one picked for an ad-hoc audit).
  const primaryEntityId =
    mode === 'plan' ? (planDetail.data?.items ?? []).find((i) => i.id === planItemId)?.universeId ?? '' : universeId;
  const areaOptions: ComboboxOption[] = entityOptions.filter(
    (o) => o.value !== primaryEntityId && !extraAreaIds.includes(o.value),
  );
  const entityName = (id: string): string => (universe.data?.items ?? []).find((e) => e.id === id)?.name ?? '…';

  const usersQuery = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.list({ pageSize: 100 }),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const directoryQuery = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: () => usersApi.directory(),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  /** Adds everyone in a pasted list of emails. People not in the system yet are created (as with 'add by email'). */
  const addPastedAuditees = async (): Promise<void> => {
    const emails = [...new Set((pasteText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map((e) => e.toLowerCase()))];
    if (emails.length === 0) {
      toast.error('No email addresses found. Paste one per line, or separate them with commas.');
      return;
    }
    setPasteBusy(true);
    const ids: string[] = [];
    const failed: string[] = [];
    for (const email of emails) {
      try {
        const person = await usersApi.provisionAuditee({ email });
        ids.push(person.id);
      } catch {
        failed.push(email);
      }
    }
    const skip = new Set([leadAuditorId, auditManagerId, auditeeId, ...extraAuditeeIds]);
    const fresh = [...new Set(ids)].filter((id) => !skip.has(id));
    setExtraAuditeeIds((prev) => [...prev, ...fresh]);
    qc.invalidateQueries({ queryKey: ['users', 'directory'] });
    setPasteBusy(false);
    if (failed.length === 0) {
      setPasteText('');
      setPasteOpen(false);
      toast.success(`${fresh.length} ${fresh.length === 1 ? 'person' : 'people'} added`);
    } else {
      setPasteText(failed.join('\n'));
      toast.warning(`${fresh.length} added. ${failed.length} could not be added (left in the box): check those addresses.`);
    }
  };

  const userName = (userId: string): string => {
    if (!userId) return '—';
    const u =
      usersQuery.data?.items.find((x) => x.id === userId) ??
      directoryQuery.data?.find((x) => x.id === userId);
    if (u) return u.displayName || `${u.firstName} ${u.lastName}`.trim() || userId;
    const eligible = auditStaffQuery.data?.find((x) => x.id === userId);
    if (eligible?.displayName) return eligible.displayName;
    if (created?.auditeeId === userId && created?.auditeeName) return created.auditeeName;
    if (created?.leadAuditorId === userId && created?.leadAuditorName) return created.leadAuditorName;
    if (created?.auditManagerId === userId && created?.auditManagerName) return created.auditManagerName;
    return userId;
  };

  // Audit type drives skill matching — from the plan item (plan mode) or the picked type (ad-hoc).
  const effectiveAuditType = useMemo(() => {
    if (mode === 'plan') {
      return (planDetail.data?.items ?? []).find((i) => i.id === planItemId)?.auditType ?? auditType;
    }
    return auditType;
  }, [mode, planDetail.data, planItemId, auditType]);
  const typeMismatch = useAuditTypeMismatch(effectiveAuditType);

  // Audit staff are the users whose role grants fieldwork permissions (same list the lead picker
  // uses, so one cache entry) — never matched on role names, which admins can create freely.
  const auditStaffQuery = useQuery({
    queryKey: ['engagements', 'eligible-users', 'lead_auditor', effectiveAuditType ?? '', priority ?? ''],
    queryFn: () => engagementsApi.eligibleUsers({ role: 'lead_auditor', auditType: effectiveAuditType, priority }),
    staleTime: 60_000,
    enabled: open,
  });

  // The standard checklist this audit type falls back to when no framework is chosen — used only to tell
  // the creator what they get by default. It is not pre-filled into the editor.
  const controlsPreview = useQuery({
    queryKey: ['checklist-controls', effectiveAuditType],
    queryFn: () => checklistsApi.previewControls(effectiveAuditType),
    enabled: open && step === 3 && Boolean(effectiveAuditType),
    staleTime: 5 * 60_000,
  });

  const updateControl = (idx: number, field: keyof ChecklistTemplateControl, value: string) => {
    setChecklistTouched(true);
    setChecklistControls((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const removeControl = (idx: number) => {
    setChecklistTouched(true);
    setChecklistControls((prev) => prev.filter((_, i) => i !== idx));
  };
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [controlSearch, setControlSearch] = useState('');
  // A new control goes to the top and the list opens, so it is visible straight away
  // (with hundreds of controls, a row added at the bottom would look like nothing happened).
  const addControl = () => {
    setChecklistTouched(true);
    setControlSearch('');
    setControlsExpanded(true);
    setChecklistControls((prev) => [{ controlReference: '', controlDescription: '', testProcedure: '' }, ...prev]);
  };
  const visibleControls = useMemo(() => {
    const q = controlSearch.trim().toLowerCase();
    const indexed = checklistControls.map((c, idx) => ({ c, idx }));
    if (!q) return indexed;
    return indexed.filter(
      ({ c }) =>
        c.controlReference.toLowerCase().includes(q) ||
        c.controlDescription.toLowerCase().includes(q),
    );
  }, [checklistControls, controlSearch]);

  const frameworksQuery = useQuery({
    queryKey: ['compliance', 'coverage'],
    queryFn: () => complianceApi.coverage(),
    enabled: open && step === 3,
  });
  const defaultsQuery = useQuery({
    queryKey: ['compliance', 'default-frameworks'],
    queryFn: () => complianceApi.getDefaultFrameworks(),
    enabled: open && step === 3,
  });
  const availableFrameworks = useMemo(() => {
    const q = frameworkSearch.trim().toLowerCase();
    return (frameworksQuery.data?.frameworks ?? [])
      .filter((f) => f.isActive && f.activeControls > 0)
      .filter((f) => !q || f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))
      .sort((x, y) => x.code.localeCompare(y.code));
  }, [frameworksQuery.data, frameworkSearch]);

  const toggleFramework = async (fwId: string) => {
    if (loadingFrameworkId) return;
    setChecklistTouched(true);
    if (selectedFrameworkIds.includes(fwId)) {
      // Untick: take out the controls this framework brought in (unless another ticked one also has them).
      const mine = new Set(frameworkRefs[fwId] ?? []);
      const keep = new Set(
        selectedFrameworkIds.filter((id) => id !== fwId).flatMap((id) => frameworkRefs[id] ?? []),
      );
      setChecklistControls((prev) =>
        prev.filter((c) => {
          const ref = c.controlReference.toUpperCase();
          return !mine.has(ref) || keep.has(ref);
        }),
      );
      setSelectedFrameworkIds((prev) => prev.filter((id) => id !== fwId));
      setFrameworkRefs(({ [fwId]: _removed, ...rest }) => rest);
      return;
    }
    setLoadingFrameworkId(fwId);
    try {
      // The API returns at most 200 controls a page; fetch every page so a large framework is not cut short.
      const all: ChecklistTemplateControl[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await complianceApi.listControls({ frameworkId: fwId, pageSize: 200, page, isActive: true });
        all.push(
          ...res.items.map((c) => ({
            controlReference: c.controlReference,
            controlDescription: c.controlDescription,
            testProcedure: c.testProcedure,
          })),
        );
        if (res.items.length < 200) break;
      }
      setChecklistControls((prev) => {
        const existing = new Set(prev.map((c) => c.controlReference.toUpperCase()));
        return [...prev, ...all.filter((c) => !existing.has(c.controlReference.toUpperCase()))];
      });
      setSelectedFrameworkIds((prev) => [...prev, fwId]);
      setFrameworkRefs((prev) => ({ ...prev, [fwId]: all.map((c) => c.controlReference.toUpperCase()) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load framework controls');
    } finally {
      setLoadingFrameworkId(null);
    }
  };

  useEffect(() => {
    if (!open || step !== 3 || !effectiveAuditType || !defaultsQuery.data) return;
    if (defaultsAppliedFor.current === effectiveAuditType) return;
    defaultsAppliedFor.current = effectiveAuditType;
    const ids = (defaultsQuery.data[effectiveAuditType] ?? []).filter((id) => !selectedFrameworkIds.includes(id));
    if (ids.length === 0) return;
    void (async () => {
      for (const id of ids) await toggleFramework(id);
      setDefaultsApplied(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, effectiveAuditType, defaultsQuery.data]);

  const importFromDocument = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload<{
        suggestedCode: string;
        suggestedName: string;
        controls: ChecklistTemplateControl[];
      }>('/audit/compliance/extract-preview', fd);
    },
    onSuccess: (res) => {
      setChecklistTouched(true);
      setChecklistControls((prev) => {
        const existingRefs = new Set(prev.map((c) => c.controlReference.toUpperCase()));
        const additions = res.controls.filter(
          (c) => !existingRefs.has(c.controlReference.toUpperCase()),
        );
        toast.success(`Extracted ${additions.length} control(s) from ${res.suggestedName}`);
        return [...prev, ...additions];
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to extract controls from document'),
  });

  // Supporting-auditor candidates: active users (excluding the core roles), ranked by skill match.
  const supportingCandidates = useMemo(() => {
    const coreIds = [leadAuditorId, auditManagerId, auditeeId];
    const auditStaffIds = new Set((auditStaffQuery.data ?? []).map((u) => u.id));
    const q = candidateSearch.trim().toLowerCase();
    return (usersQuery.data?.items ?? [])
      .filter((u) => u.isActive && !coreIds.includes(u.id))
      // Only audit staff can join the audit team (the server enforces the same rule).
      .filter((u) => auditStaffIds.has(u.id))
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
  }, [usersQuery.data, auditStaffQuery.data, leadAuditorId, auditManagerId, auditeeId, candidateSearch, effectiveAuditType]);

  const create = useMutation({
    mutationFn: async (): Promise<AuditEngagement> => {
      // Preserve all non-blank checklist controls; auto-fill defaults if a user added a row
      // and left one of the three fields blank so the count on Review matches the created engagement.
      const cleanedControls = checklistControls
        .map((c, idx) => {
          const ref = c.controlReference.trim();
          const desc = c.controlDescription.trim();
          const proc = c.testProcedure.trim();
          if (!ref && !desc && !proc) return null;
          const finalRef = ref || `CTRL-${String(idx + 1).padStart(3, '0')}`;
          const finalDesc = desc || proc || `Control requirement ${finalRef}`;
          const finalProc =
            proc || `Verify compliance with ${finalRef}: inspect supporting records and evidence for "${finalDesc}".`;
          return {
            controlReference: finalRef,
            controlDescription: finalDesc,
            testProcedure: finalProc,
          };
        })
        .filter((c): c is ChecklistTemplateControl => c !== null);
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
            additionalAuditeeIds: extraAuditeeIds.length > 0 ? extraAuditeeIds : undefined,
            additionalUniverseIds: extraAreaIds.length > 0 ? extraAreaIds : undefined,
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
            additionalAuditeeIds: extraAuditeeIds.length > 0 ? extraAuditeeIds : undefined,
            additionalUniverseIds: extraAreaIds.length > 0 ? extraAreaIds : undefined,
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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements'] });
      finish();
    },
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
      toast.error('Complete the team and a valid schedule (end and OLA on/after start)');
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
              <Button
                size="sm"
                onClick={() => (typeMismatch ? setConfirmMismatch(true) : create.mutate())}
                isLoading={create.isPending}
              >
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
                      <option key={it.id} value={it.id}>{it.universeName} ({it.auditType === 'it' ? 'IT' : it.auditType.charAt(0).toUpperCase() + it.auditType.slice(1)})</option>
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
                  tooltip="Select the audit domain or specialized audit type (e.g. System/IT, Financial, Compliance, Operational, Pension, Procurement, HR & Payroll, Project, or Special Investigation)."
                >
                  <Select value={auditType} onChange={(e) => setAuditType(e.target.value as AuditType)}>
                    {SELECTABLE_AUDIT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Priority"
                  required
                  tooltip="Drives scheduling and OLA expectations. Critical/High engagements escalate faster when overdue."
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

          {(mode === 'ad_hoc' ? Boolean(universeId) : Boolean(planItemId)) && (
            <FormField
              label="Other areas covered by this audit (optional)"
              tooltip="One audit can cover several entities, such as a department and its units, or several systems. Add the other areas here and the audit produces one consolidated report for all of them."
            >
              <Combobox
                value=""
                onChange={(id) => id && setExtraAreaIds((prev) => [...prev, id])}
                options={areaOptions}
                placeholder="Add another area…"
                emptyText={universe.isLoading ? 'Loading…' : 'No other entities'}
              />
              <ChipList
                items={extraAreaIds.map((id) => ({ id, label: entityName(id) }))}
                onRemove={(id) => setExtraAreaIds((prev) => prev.filter((x) => x !== id))}
                emptyText="Just the entity above. Add more only if this one audit covers several areas."
              />
            </FormField>
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
              <ScoredUserSelect role="lead_auditor" auditType={effectiveAuditType} priority={priority} value={leadAuditorId} onChange={setLeadAuditorId} excludeIds={[auditManagerId, auditeeId].filter(Boolean)} />
            </FormField>
            <FormField label="Audit manager" required tooltip="Reviews and signs off the lead auditor's work. Lists only users who can approve.">
              <ScoredUserSelect role="audit_manager" auditType={effectiveAuditType} priority={priority} value={auditManagerId} onChange={setAuditManagerId} excludeIds={[leadAuditorId, auditeeId].filter(Boolean)} />
            </FormField>
          </div>
          <FormField label="Main auditee: the person being audited" required tooltip="Choose the person in charge of what is being audited, such as the head of the department or unit. They are the main contact who is told about the audit, provides evidence and answers findings. This is NOT the auditor. Add everyone else being audited in the next box. Not signed in to IAMS yet? Use 'Add by AD corporate email'.">
            <UserSelect value={auditeeId} onChange={setAuditeeId} excludeIds={[leadAuditorId, auditManagerId, ...extraAuditeeIds].filter(Boolean)} />
          </FormField>
          <FormField
            label="Other people being audited (optional)"
            tooltip="When a department or a process is run by several people, add them all here. Each is told they are being audited and gets access to this audit, and sees only the findings assigned to them. Someone not in the system yet? Use the email option in the list."
          >
            <UserSelect
              value=""
              onChange={(id) => id && setExtraAuditeeIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
              placeholder="Add another person…"
              excludeIds={[leadAuditorId, auditManagerId, auditeeId, ...extraAuditeeIds].filter(Boolean)}
            />
            <ChipList
              items={extraAuditeeIds.map((id) => ({ id, label: userName(id) }))}
              onRemove={(id) => setExtraAuditeeIds((prev) => prev.filter((x) => x !== id))}
              emptyText="Just the main auditee above. Add more if several people answer for this audit."
            />
            <button
              type="button"
              className="mt-2 text-xs font-medium text-primary hover:underline"
              onClick={() => setPasteOpen((v) => !v)}
            >
              {pasteOpen ? 'Hide the list box' : 'Adding a whole department or unit? Paste a list of emails'}
            </button>
            {pasteOpen && (
              <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface-alt p-3">
                <Textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'One email per line, or separated by commas:\nada.obi@galaxybackbone.com.ng\nbola.musa@galaxybackbone.com.ng'}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-text-muted">
                    Everyone is added to this audit and emailed that they are being audited. People who have not signed in yet are
                    created for you.
                  </p>
                  <Button type="button" size="sm" isLoading={pasteBusy} disabled={!pasteText.trim()} onClick={() => void addPastedAuditees()}>
                    Add them
                  </Button>
                </div>
              </div>
            )}
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
              {usersQuery.isLoading || auditStaffQuery.isLoading ? (
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
            <FormField label="OLA deadline" required tooltip="Target completion date. Breaching it triggers the escalation workflow. Defaults to the end date.">
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
            {mode === 'ad_hoc' && <Row label="Audit type" value={auditTypeLabel(auditType)} />}
            {mode === 'ad_hoc' && <Row label="Priority" value={priority} />}
            <Row label="Title" value={title} />
            <Row label="Lead auditor" value={userName(leadAuditorId)} />
            <Row label="Audit manager" value={userName(auditManagerId)} />
            <Row label="Main auditee (being audited)" value={userName(auditeeId)} />
            {extraAuditeeIds.length > 0 && <Row label="Other auditees" value={extraAuditeeIds.map(userName).join(', ')} />}
            {extraAreaIds.length > 0 && <Row label="Other areas" value={extraAreaIds.map(entityName).join(', ')} />}
            <Row
              label="Supporting auditors"
              value={supportingIds.length > 0 ? supportingIds.map(userName).join(', ') : 'None'}
            />
            <Row label="Schedule" value={`${start} → ${end} (OLA ${sla})`} />
          </dl>

          {/* Per-engagement checklist controls */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Controls to test{checklistControls.length > 0 ? ` (${checklistControls.length})` : ''}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-2.5 text-xs font-medium text-text-primary hover:bg-surface-alt">
                  <Upload className="h-3.5 w-3.5" />
                  {importFromDocument.isPending ? 'Extracting…' : 'Upload Act / Policy'}
                  <input
                    type="file"
                    accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
                    className="hidden"
                    disabled={importFromDocument.isPending}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importFromDocument.mutate(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                <Button type="button" size="sm" variant="secondary" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addControl}>
                  Add control
                </Button>
              </div>
            </div>
            <p className="mb-2 text-xs text-text-secondary">
              Tick the framework or Act this audit is tested against. Its controls are added to this engagement&apos;s
              checklist. You can tick more than one, upload an Act/Policy that is not in the library yet, or add a
              single control.
              {defaultsApplied && selectedFrameworkIds.length > 0 && (
                <span className="mt-1 block font-medium text-primary">
                  Some are already ticked: they are the defaults set for {auditTypeLabel(effectiveAuditType)}. Untick any that do not apply.
                </span>
              )}
            </p>

            <div className="mb-3 rounded-lg border border-border bg-surface-alt p-2.5">
              <div className="mb-2 flex items-center gap-2">
                <Library className="h-4 w-4 shrink-0 text-text-secondary" />
                <Input
                  value={frameworkSearch}
                  onChange={(e) => setFrameworkSearch(e.target.value)}
                  placeholder="Search frameworks and Acts…"
                  className="h-8 text-xs"
                />
              </div>
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {frameworksQuery.isLoading && <p className="px-1 py-2 text-xs text-text-muted">Loading the Control Library…</p>}
                {!frameworksQuery.isLoading && availableFrameworks.length === 0 && (
                  <p className="px-1 py-2 text-xs text-text-muted">No frameworks match.</p>
                )}
                {availableFrameworks.map((f) => {
                  const checked = selectedFrameworkIds.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-xs ${
                        checked ? 'border-primary bg-white' : 'border-transparent bg-white/60 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[#4F6228]"
                        checked={checked}
                        disabled={loadingFrameworkId !== null}
                        onChange={() => void toggleFramework(f.id)}
                      />
                      <span className="font-mono font-semibold text-primary">{f.code}</span>
                      <span className="min-w-0 flex-1 truncate text-text-primary">{f.name}</span>
                      <span className="shrink-0 text-text-muted">
                        {loadingFrameworkId === f.id ? 'Adding…' : `${f.activeControls} controls`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {checklistControls.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface-alt px-3 py-4 text-center text-xs text-text-secondary">
                {controlsPreview.data
                  ? `Nothing chosen. This audit will use the standard ${auditTypeLabel(effectiveAuditType)} checklist (${controlsPreview.data.length} controls).`
                  : 'Nothing chosen. This audit will use the standard checklist for its type.'}{' '}
                Tick a framework above to test against it instead.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{checklistControls.length} controls</span> will be
                    added to this engagement.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    rightIcon={controlsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    onClick={() => setControlsExpanded((v) => !v)}
                  >
                    {controlsExpanded ? 'Hide controls' : 'View / edit controls'}
                  </Button>
                </div>
                {controlsExpanded && (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                      <Input
                        value={controlSearch}
                        onChange={(e) => setControlSearch(e.target.value)}
                        placeholder="Search controls by reference or wording…"
                        className="pl-8"
                      />
                    </div>
                    {visibleControls.length === 0 && (
                      <p className="rounded-lg border border-dashed border-border bg-surface-alt px-3 py-4 text-center text-xs text-text-muted">
                        No controls match your search.
                      </p>
                    )}
                    {visibleControls.slice(0, 50).map(({ c, idx }) => (
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
                    {visibleControls.length > 50 && (
                      <p className="text-center text-xs text-text-muted">
                        Showing the first 50 of {visibleControls.length}. Use the search box to find a specific control.
                      </p>
                    )}
                  </>
                )}
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

      <ConfirmDialog
        open={confirmMismatch}
        variant="warning"
        title="Start this audit?"
        description={typeMismatch}
        confirmLabel="Yes, start the audit"
        cancelLabel="Go back"
        isLoading={create.isPending}
        onCancel={() => setConfirmMismatch(false)}
        onConfirm={() => {
          setConfirmMismatch(false);
          create.mutate();
        }}
      />
    </SlideOver>
  );
};

const Row = ({ label, value }: { label: string; value: string }): JSX.Element => (
  <div className="flex items-center justify-between border-b border-border pb-2">
    <dt className="text-text-secondary">{label}</dt>
    <dd className="font-medium text-text-primary">{value}</dd>
  </div>
);
