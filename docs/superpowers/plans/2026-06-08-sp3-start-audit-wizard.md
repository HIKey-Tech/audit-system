# SP3 — Start-Audit Guided Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat new-engagement form with a guided 4-step wizard that creates an engagement and staffs the team in one flow, add a searchable entity picker, surface each engagement's next action, and make "Start audit" a prominent action.

**Architecture:** Frontend-only. The wizard orchestrates existing endpoints — `engagementsApi.createFromPlan`/`createAdhoc` (create), `workflowApi.getCandidates`/`createAssignment` (skill-matched staffing, keyed by the new engagement id), `engagementsApi.updateStatus` (Start now). A new `Combobox` primitive powers the ad-hoc entity picker; skill-matching helpers are extracted into a shared module reused by the existing ManageAssignments dialog.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind, @tanstack/react-query, sonner, SP1 primitives (`FormField`, `InfoHint`, `Select`, `UserSelect`).

**Working dir:** all commands from `audit-system/frontend/`. Windows/PowerShell; git branch `sp3-start-audit-wizard`.

**Per-task verification:** `npx tsc --noEmit` (from `frontend/`) after each task — no errors. Final task also runs `npm run build`. No backend, no DB, no test runner involved.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `components/ui/Combobox.tsx` | create | searchable single-select primitive |
| `components/ui/index.ts` | modify | export `Combobox` |
| `components/audit/engagements/assignment-matching.ts` | create | shared skill-match helpers |
| `components/audit/engagements/ManageAssignmentsSlideOver.tsx` | modify | use the shared helpers (no behavior change) |
| `components/audit/engagements/StartAuditWizard.tsx` | create | the 4-step wizard |
| `app/(app)/audit/engagements/page.tsx` | modify | open the wizard; "Start audit" labels |
| `app/(app)/dashboard/page.tsx` | modify | "Start audit" CTA |
| `components/audit/engagements/OverviewTab.tsx` | modify | next-action nudge |
| `components/audit/engagements/NewEngagementSlideOver.tsx` | delete | superseded by the wizard |

---

## Task 1: `Combobox` primitive

**Files:**
- Create: `frontend/components/ui/Combobox.tsx`
- Modify: `frontend/components/ui/index.ts`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  emptyText?: string;
}

const baseField =
  'w-full rounded-md border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted ' +
  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

export const Combobox = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  error,
  emptyText = 'No matches',
}: ComboboxProps): JSX.Element => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [filter, options]);

  useEffect(() => {
    if (open) {
      setFilter('');
      setActiveIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const choose = (opt: ComboboxOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) choose(opt);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={Boolean(error) || undefined}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          baseField,
          'relative flex h-10 items-center justify-between gap-3 pr-10 text-left shadow-sm hover:border-primary/50',
          open && 'border-primary ring-2 ring-primary/20',
          disabled && 'cursor-not-allowed text-text-muted',
          error ? 'border-danger' : 'border-border',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-text-muted')}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] ring-1 ring-black/5 animate-fade-in motion-reduce:animate-none">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              role="combobox"
              aria-controls={listId}
              aria-expanded={open}
            />
          </div>
          <ul id={listId} role="listbox" className="scrollbar-thin max-h-64 overflow-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">{emptyText}</li>
            ) : (
              filtered.map((opt, index) => {
                const isSelected = opt.value === value;
                const isActive = index === activeIndex;
                return (
                  <li key={opt.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(opt)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                        isActive || isSelected ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-surface-hover',
                        isSelected && 'font-semibold',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{opt.label}</span>
                        {opt.hint && <span className="block truncate text-xs text-text-muted">{opt.hint}</span>}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Export it**

Add to `frontend/components/ui/index.ts`:

```ts
export { Combobox } from './Combobox';
export type { ComboboxOption } from './Combobox';
```

- [ ] **Step 3: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/Combobox.tsx frontend/components/ui/index.ts
git commit -m "feat(ui): add searchable Combobox primitive"
```

---

## Task 2: Extract shared skill-matching helpers

**Files:**
- Create: `frontend/components/audit/engagements/assignment-matching.ts`
- Modify: `frontend/components/audit/engagements/ManageAssignmentsSlideOver.tsx`

Context: `ManageAssignmentsSlideOver` currently defines `AUDIT_TYPE_KEYWORDS` (module-level) and inline `getMatchScore` / `isRelevantSkill` that close over `engagement.auditType`. Extract them into a shared module that takes `auditType` as a parameter, so the wizard (Task 3) and this dialog share one implementation. No behavior change.

- [ ] **Step 1: Create the shared module**

```ts
// Skill-matching helpers shared by ManageAssignmentsSlideOver and StartAuditWizard.

export const AUDIT_TYPE_KEYWORDS: Record<string, string[]> = {
  it: ['it', 'cyber', 'security', 'iso 27001', 'iso27001', 'network', 'system', 'vulnerability', 'firewall', 'cloud', 'itgc', 'sast'],
  financial: ['financial', 'finance', 'ap', 'ledger', 'reconciliation', 'maker', 'checker', 'asset', 'audit', 'tax'],
  compliance: ['compliance', 'regulation', 'standard', 'iso 9001', 'iso9001', 'iso 22301', 'iso22301', 'ndpr', 'privacy', 'dpo', 'policy', 'gdpr'],
  systems: ['systems', 'infrastructure', 'configuration', 'change', 'cab', 'disaster', 'dr', 'replication', 'capacity', 'performance'],
};

/** Total skill-match score for a candidate against an audit type. */
export const getMatchScore = (skills: string[], auditType: string): number => {
  const matchWords = AUDIT_TYPE_KEYWORDS[auditType.toLowerCase()] ?? [];
  let score = 0;
  skills.forEach((skill) => {
    const s = skill.toLowerCase();
    if (matchWords.some((w) => s.includes(w))) score += 2;
  });
  return score;
};

/** Whether a single skill is relevant to the audit type. */
export const isRelevantSkill = (skill: string, auditType: string): boolean => {
  const matchWords = AUDIT_TYPE_KEYWORDS[auditType.toLowerCase()] ?? [];
  const s = skill.toLowerCase();
  return matchWords.some((w) => s.includes(w));
};
```

- [ ] **Step 2: Refactor ManageAssignmentsSlideOver to use it**

In `ManageAssignmentsSlideOver.tsx`:
- Delete the module-level `AUDIT_TYPE_KEYWORDS` constant.
- Delete the inline `getMatchScore` and `isRelevantSkill` function definitions.
- Add the import: `import { getMatchScore, isRelevantSkill } from './assignment-matching';`
- Update the call sites to pass the audit type: replace `getMatchScore(a.skills)` / `getMatchScore(b.skills)` / `getMatchScore(c.skills)` with `getMatchScore(…, engagement.auditType)`, and `isRelevantSkill(s)` with `isRelevantSkill(s, engagement.auditType)`.

- [ ] **Step 3: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/audit/engagements/assignment-matching.ts frontend/components/audit/engagements/ManageAssignmentsSlideOver.tsx
git commit -m "refactor(audit): extract shared skill-matching helpers"
```

---

## Task 3: `StartAuditWizard` component

**Files:**
- Create: `frontend/components/audit/engagements/StartAuditWizard.tsx`

- [ ] **Step 1: Create the wizard**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Award, Check } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { UserSelect } from '@/components/common/UserSelect';
import { engagementsApi, plansApi, universeApi } from '@/lib/api/audit';
import { workflowApi } from '@/lib/api/workflow';
import { initialsFromName } from '@/lib/utils/format';
import { getMatchScore, isRelevantSkill } from './assignment-matching';
import type { AuditEngagement } from '@/lib/types/domain';

type Mode = 'plan' | 'ad_hoc';
type AuditType = 'it' | 'financial' | 'compliance' | 'systems';
type Priority = 'low' | 'medium' | 'high' | 'critical';

const toISO = (d: string): string => (d ? `${d}T00:00:00.000Z` : d);

interface Props {
  open: boolean;
  onClose: () => void;
}

export const StartAuditWizard = ({ open, onClose }: Props): JSX.Element => {
  const qc = useQueryClient();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>('plan');

  // scope
  const [planId, setPlanId] = useState('');
  const [planItemId, setPlanItemId] = useState('');
  const [universeId, setUniverseId] = useState('');
  const [auditType, setAuditType] = useState<AuditType>('compliance');
  const [priority, setPriority] = useState<Priority>('medium');
  const [adhocReason, setAdhocReason] = useState('');
  // team + schedule
  const [title, setTitle] = useState('');
  const [leadAuditorId, setLeadAuditorId] = useState('');
  const [auditManagerId, setAuditManagerId] = useState('');
  const [auditeeId, setAuditeeId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sla, setSla] = useState('');
  const [slaTouched, setSlaTouched] = useState(false);
  // created
  const [created, setCreated] = useState<AuditEngagement | null>(null);
  const [roleByUser, setRoleByUser] = useState<Record<string, 'lead_auditor' | 'supporting_auditor'>>({});

  const reset = () => {
    setStep(1);
    setMode('plan');
    setPlanId('');
    setPlanItemId('');
    setUniverseId('');
    setAuditType('compliance');
    setPriority('medium');
    setAdhocReason('');
    setTitle('');
    setLeadAuditorId('');
    setAuditManagerId('');
    setAuditeeId('');
    setStart('');
    setEnd('');
    setSla('');
    setSlaTouched(false);
    setCreated(null);
    setRoleByUser({});
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

  const create = useMutation({
    mutationFn: async (): Promise<AuditEngagement> => {
      if (mode === 'plan') {
        return engagementsApi.createFromPlan({
          title: title.trim(),
          leadAuditorId,
          auditManagerId,
          auditeeId,
          plannedStartDate: toISO(start),
          plannedEndDate: toISO(end),
          slaDeadline: toISO(sla),
          planItemId,
        });
      }
      return engagementsApi.createAdhoc({
        title: title.trim(),
        leadAuditorId,
        auditManagerId,
        auditeeId,
        plannedStartDate: toISO(start),
        plannedEndDate: toISO(end),
        slaDeadline: toISO(sla),
        universeId,
        auditType,
        priority,
        adhocReason: adhocReason.trim(),
      });
    },
    onSuccess: (eng) => {
      setCreated(eng);
      qc.invalidateQueries({ queryKey: ['engagements'] });
      setStep(4);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create engagement'),
  });

  const candidates = useQuery({
    queryKey: ['engagements', created?.id, 'candidates'],
    queryFn: () => workflowApi.getCandidates(created!.id),
    enabled: Boolean(created?.id),
  });

  const assign = useMutation({
    mutationFn: (dto: { userId: string; role: 'lead_auditor' | 'supporting_auditor' }) =>
      workflowApi.createAssignment({ engagementId: created!.id, userId: dto.userId, role: dto.role }),
    onSuccess: (_, vars) => {
      toast.success('Staff assigned');
      setRoleByUser((prev) => {
        const next = { ...prev };
        delete next[vars.userId];
        return next;
      });
      qc.invalidateQueries({ queryKey: ['engagements', created!.id, 'candidates'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to assign'),
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

  const sortedCandidates = useMemo(() => {
    const at = created?.auditType ?? auditType;
    return [...(candidates.data ?? [])].sort((a, b) => {
      const sa = getMatchScore(a.skills, at);
      const sb = getMatchScore(b.skills, at);
      if (sa !== sb) return sb - sa;
      return a.activeEngagementCount - b.activeEngagementCount;
    });
  }, [candidates.data, created, auditType]);

  const stepLabels = ['Scope', 'Team & schedule', 'Review', 'Assign team'];

  return (
    <SlideOver
      open={open}
      onClose={onClose}
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
              <>
                <Button variant="secondary" size="sm" onClick={finish}>
                  Finish
                </Button>
                <Button size="sm" onClick={() => startNow.mutate()} isLoading={startNow.isPending}>
                  Start audit now
                </Button>
              </>
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
            <FormField label="Lead auditor" required tooltip="Owns fieldwork and day-to-day execution of the engagement.">
              <UserSelect value={leadAuditorId} onChange={setLeadAuditorId} />
            </FormField>
            <FormField label="Audit manager" required tooltip="Reviews and signs off the lead auditor's work.">
              <UserSelect value={auditManagerId} onChange={setAuditManagerId} />
            </FormField>
          </div>
          <FormField label="Auditee" required tooltip="Primary contact in the audited area who provides evidence and management responses.">
            <UserSelect value={auditeeId} onChange={setAuditeeId} />
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
          </div>
          {start && end && new Date(end) < new Date(start) && (
            <p className="text-xs text-danger" role="alert">End date must be on or after the start date.</p>
          )}
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <dl className="space-y-3 text-sm">
          <Row label="Mode" value={mode === 'plan' ? 'From plan item' : 'Ad-hoc'} />
          {mode === 'ad_hoc' && <Row label="Entity" value={selectedEntity?.name ?? '—'} />}
          {mode === 'ad_hoc' && <Row label="Audit type" value={auditType} />}
          {mode === 'ad_hoc' && <Row label="Priority" value={priority} />}
          <Row label="Title" value={title} />
          <Row label="Schedule" value={`${start} → ${end} (SLA ${sla})`} />
        </dl>
      )}

      {/* Step 4 — Assign team */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-text-secondary">
            Engagement <span className="font-semibold text-text-primary">{created?.referenceNumber}</span> created. Add supporting auditors below, then start the audit.
          </p>
          {candidates.isLoading ? (
            <p className="text-xs text-text-muted">Loading candidates…</p>
          ) : sortedCandidates.length === 0 ? (
            <p className="text-xs text-text-muted">No available candidates.</p>
          ) : (
            <ul className="space-y-2">
              {sortedCandidates.map((c) => {
                const at = created?.auditType ?? auditType;
                const matched = getMatchScore(c.skills, at) > 0;
                const role = roleByUser[c.id] ?? 'supporting_auditor';
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={initialsFromName(undefined, undefined, c.displayName)} size="md" tone={matched ? 'navy' : 'slate'} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary">{c.displayName}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <Badge tone={c.activeEngagementCount >= 3 ? 'red' : c.activeEngagementCount > 0 ? 'blue' : 'green'}>
                            {c.activeEngagementCount === 0 ? 'Available' : `${c.activeEngagementCount} active`}
                          </Badge>
                          {matched && <Badge tone="purple" className="flex items-center gap-0.5"><Award className="h-3 w-3" /> Recommended</Badge>}
                          {c.skills.filter((s) => isRelevantSkill(s, at)).slice(0, 3).map((s) => (
                            <span key={s} className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Select className="h-8 text-xs" value={role} onChange={(e) => setRoleByUser((p) => ({ ...p, [c.id]: e.target.value as 'lead_auditor' | 'supporting_auditor' }))}>
                        <option value="supporting_auditor">Supporting</option>
                        <option value="lead_auditor">Lead</option>
                      </Select>
                      <Button size="sm" leftIcon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => assign.mutate({ userId: c.id, role })} isLoading={assign.isPending && assign.variables?.userId === c.id}>
                        Assign
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit` → no errors. (If `plansApi.list`'s filter type or `AuditEngagement.auditType` access needs a tweak to satisfy types, make the minimal fix — these are the existing shapes used by `NewEngagementSlideOver`/`ManageAssignmentsSlideOver`.)

- [ ] **Step 3: Commit**

```bash
git add frontend/components/audit/engagements/StartAuditWizard.tsx
git commit -m "feat(audit): add Start-Audit guided wizard (create + staff in one flow)"
```

---

## Task 4: Open the wizard from the Engagements list

**Files:**
- Modify: `frontend/app/(app)/audit/engagements/page.tsx`

- [ ] **Step 1: Swap the component + relabel triggers**

- Replace the import `import { NewEngagementSlideOver } from '@/components/audit/engagements/NewEngagementSlideOver';` with `import { StartAuditWizard } from '@/components/audit/engagements/StartAuditWizard';`.
- Replace the bottom `<NewEngagementSlideOver open={open} onClose={() => setOpen(false)} />` with `<StartAuditWizard open={open} onClose={() => setOpen(false)} />`.
- Relabel the two trigger buttons from "New Engagement" to "Start audit" (the `PageHeader` actions button and the `EmptyState` action button). Leave the `open`/`setOpen` state and `canWrite` gating unchanged.

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/(app)/audit/engagements/page.tsx
git commit -m "feat(audit): launch Start-Audit wizard from the engagements list"
```

---

## Task 5: "Start audit" CTA on the dashboard

**Files:**
- Modify: `frontend/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add the CTA + wizard**

Make these edits to `dashboard/page.tsx`:
- Add imports:
  ```tsx
  import { useState } from 'react';
  import { Plus } from 'lucide-react';
  import { Button } from '@/components/ui/Button';
  import { StartAuditWizard } from '@/components/audit/engagements/StartAuditWizard';
  ```
- Pull `canManageAuditProgramme` from the existing `usePermissions()` call: `const { dashboard, isAuditee, canManageAuditProgramme } = usePermissions();`
- Add wizard state inside the component: `const [wizardOpen, setWizardOpen] = useState(false);`
- Give the `PageHeader` an `actions` prop:
  ```tsx
  <PageHeader
    title="Home"
    subtitle={subtitle}
    actions={
      canManageAuditProgramme ? (
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setWizardOpen(true)}>
          Start audit
        </Button>
      ) : null
    }
  />
  ```
- Before the final closing `</div>`, render: `<StartAuditWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />`

(If `usePermissions()` does not expose `canManageAuditProgramme`, use the same flag the engagements page uses for `canWrite` — it destructures `canManageAuditProgramme` there, so it is available.)

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/(app)/dashboard/page.tsx
git commit -m "feat(dashboard): add Start-audit entry point"
```

---

## Task 6: Next-action nudge on the engagement overview

**Files:**
- Modify: `frontend/components/audit/engagements/OverviewTab.tsx`

- [ ] **Step 1: Render the nudge banner**

- Add the import: `import { statusMeaning } from '@/lib/utils/status';`
- Just inside the returned root `<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">`, the banner must span all columns, so add it as the FIRST child:

```tsx
{(() => {
  const m = statusMeaning('engagement', engagement.status);
  return (
    <div className="lg:col-span-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <p className="text-sm text-text-primary">
        <span className="font-semibold">{m.label}.</span> {m.meaning}
      </p>
      {m.next && (
        <p className="mt-1 text-xs text-text-secondary">
          <span className="font-semibold text-primary">Next:</span> {m.next}
        </p>
      )}
    </div>
  );
})()}
```

- [ ] **Step 2: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/audit/engagements/OverviewTab.tsx
git commit -m "feat(audit): show next-action nudge on engagement overview"
```

---

## Task 7: Remove the superseded NewEngagementSlideOver

**Files:**
- Delete: `frontend/components/audit/engagements/NewEngagementSlideOver.tsx`

- [ ] **Step 1: Confirm there are no remaining importers**

Run (from `frontend/`): search for any import of `NewEngagementSlideOver`:
```bash
grep -rn "NewEngagementSlideOver" app components
```
Expected: no results (Task 4 repointed the only importer). If any remain, repoint them to `StartAuditWizard` (same `open`/`onClose` props) before deleting — do NOT leave a dangling import.

- [ ] **Step 2: Delete the file**

```bash
git rm frontend/components/audit/engagements/NewEngagementSlideOver.tsx
```

- [ ] **Step 3: Type gate**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(audit): remove NewEngagementSlideOver (superseded by wizard)"
```

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Type + build gate**

Run (from `frontend/`): `npx tsc --noEmit && npm run build`
Expected: type check clean; production build succeeds.

- [ ] **Step 2: Manual smoke (requires running app + DB)**

- Engagements list → "Start audit" → wizard opens at Step 1.
- Plan mode: pick plan + item → Next → fill team + dates (SLA auto-fills to end) → Next → Review → Create → Step 4 lists skill-ranked candidates → assign one → "Start audit now" → lands on the engagement, now `in_progress`.
- Ad-hoc mode: search the entity Combobox, pick one (risk score shows), fill type/priority/reason → through to create.
- Date validation: set end before start → blocked with the inline error.
- Engagement overview shows the next-action nudge.
- Dashboard "Start audit" opens the wizard.
- ManageAssignments dialog still works (shared matching helpers).

- [ ] **Step 3: Commit any verification fixes**

```bash
git add -A
git commit -m "chore(sp3): verification fixes"
```

(Skip if none.)

---

## Self-review notes (author)

- **Spec coverage:** Combobox (T1), shared matching extraction (T2), wizard with 4 steps incl. SLA prefill + date validation + recommender + Start-now (T3), engagements CTA/launch (T4), dashboard CTA (T5), next-action nudge (T6), remove NewEngagementSlideOver (T7), verification (T8). All spec §3–§6 items map to a task.
- **Type consistency:** `getMatchScore(skills, auditType)` / `isRelevantSkill(skill, auditType)` defined in T2 and consumed in both T2 (ManageAssignments) and T3 (wizard); `ComboboxOption` defined in T1 and used in T3; engagement DTOs match `lib/api/audit.ts` (`createFromPlan`/`createAdhoc`/`updateStatus`); `AssignmentCandidateDto` fields (`id/displayName/skills/activeEngagementCount`) match `lib/types/domain.ts`.
- **No placeholders:** complete code for all new units; integration edits (T4–T6) name exact files, imports, and the exact JSX to insert. T3 Step 2 notes that any minor type tweak must use the existing shapes (same ones the superseded form used) — not a placeholder, a guardrail.
- **Frontend-only:** no backend/DB/migration; every endpoint used already exists.
