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
