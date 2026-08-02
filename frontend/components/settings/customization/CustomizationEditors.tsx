'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';

import { Input, Textarea } from '@/components/ui/Input';
import { ApprovalMatrixEditor } from './ApprovalMatrixEditor';
import { ConfigValueEditor, humanizeKey, type JsonValue } from './StructuredConfigEditor';

// ───────────────────────── shared helpers ─────────────────────────

const isRecord = (v: JsonValue): v is { [key: string]: JsonValue } =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const inputClass =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): JSX.Element => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
      checked ? 'bg-primary' : 'bg-slate-300'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`}
    />
  </button>
);

interface FieldMeta {
  label: string;
  description?: string;
}

// ───────────────────────── boolean toggle rules ─────────────────────────
// Used for both lifecycle gates and KPI visibility (objects of booleans).

const BooleanRulesEditor = ({
  value,
  onChange,
  labels,
}: {
  value: JsonValue;
  onChange: (v: JsonValue) => void;
  labels: Record<string, FieldMeta>;
}): JSX.Element => {
  const obj = isRecord(value) ? value : {};
  const knownKeys = Object.keys(labels);
  const extraKeys = Object.keys(obj).filter((k) => !(k in labels) && typeof obj[k] === 'boolean');
  const keys = [...knownKeys, ...extraKeys];

  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {keys.map((key) => {
        const meta = labels[key] ?? { label: humanizeKey(key) };
        const checked = obj[key] === true;
        return (
          <div key={key} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{meta.label}</p>
              {meta.description && <p className="mt-0.5 text-xs text-text-muted">{meta.description}</p>}
            </div>
            <Toggle checked={checked} onChange={(v) => onChange({ ...obj, [key]: v })} />
          </div>
        );
      })}
    </div>
  );
};

const LIFECYCLE_LABELS: Record<string, FieldMeta> = {
  requireAllChecklistsTestedBeforeUnderReview: {
    label: 'Require all checklists tested',
    description: 'Every checklist must be tested before an engagement can move to Under Review.',
  },
  requireApprovedWorkingPaperBeforeUnderReview: {
    label: 'Require approved working paper',
    description: 'An approved working paper is needed before an engagement reaches Under Review.',
  },
  requireReportIssuedBeforeReported: {
    label: 'Require issued report',
    description: 'The audit report must be issued before an engagement is marked Reported.',
  },
  requireClosedFindingsBeforeClose: {
    label: 'Require closed findings',
    description: 'All findings must be closed before an engagement can be Closed.',
  },
};

const KPI_LABELS: Record<string, FieldMeta> = {
  lifecycle: { label: 'Engagement lifecycle', description: 'Status and progress KPIs.' },
  findings: { label: 'Findings', description: 'Findings by severity, status, and ageing.' },
  riskCoverage: { label: 'Risk coverage', description: 'How much of the risk universe is audited.' },
  auditorWorkload: { label: 'Auditor workload', description: 'Assignments and capacity per auditor.' },
  reporting: { label: 'Reporting', description: 'Report turnaround and issuance metrics.' },
  followUp: { label: 'Follow-up', description: 'Remediation and verification progress.' },
};

// ───────────────────────── SLA numeric rules ─────────────────────────

const SLA_LABELS: Record<string, FieldMeta> = {
  defaultEngagementSlaDays: { label: 'Default engagement turnaround', description: 'Target time to complete an engagement.' },
  defaultFindingDueDays: { label: 'Default finding due window', description: 'Standard time given to remediate a finding.' },
  highRiskFindingDueDays: { label: 'High-risk finding due window', description: 'Tighter window for high-risk findings.' },
  criticalFindingDueDays: { label: 'Critical finding due window', description: 'Shortest window for critical findings.' },
};

const SlaRulesEditor = ({
  value,
  onChange,
}: {
  value: JsonValue;
  onChange: (v: JsonValue) => void;
}): JSX.Element => {
  const obj = isRecord(value) ? value : {};
  const knownKeys = Object.keys(SLA_LABELS);
  const extraKeys = Object.keys(obj).filter((k) => !(k in SLA_LABELS) && typeof obj[k] === 'number');
  const keys = [...knownKeys, ...extraKeys];

  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const meta = SLA_LABELS[key] ?? { label: humanizeKey(key) };
        const current = typeof obj[key] === 'number' ? (obj[key] as number) : '';
        return (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{meta.label}</p>
              {meta.description && <p className="mt-0.5 text-xs text-text-muted">{meta.description}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="w-24">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={String(current)}
                  onChange={(e) =>
                    onChange({ ...obj, [key]: e.target.value === '' ? 0 : Number(e.target.value) })
                  }
                />
              </div>
              <span className="text-sm text-text-secondary">days</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────── taxonomy chip lists ─────────────────────────

const TAXONOMY_LABELS: Record<string, FieldMeta> = {
  auditTypes: { label: 'Audit types', description: 'Kinds of audit engagements you run.' },
  priorities: { label: 'Priorities', description: 'Priority levels for engagements.' },
  findingSeverities: { label: 'Finding severities', description: 'Severity ratings applied to findings.' },
  findingCategories: { label: 'Finding categories', description: 'Categories used to classify findings.' },
};

const ChipList = ({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}): JSX.Element => {
  const [draft, setDraft] = useState('');
  const trimmed = draft.trim().toLowerCase();
  const duplicate = trimmed.length > 0 && values.includes(trimmed);

  const add = () => {
    if (!trimmed || duplicate) return;
    onChange([...values, trimmed]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.length === 0 && <span className="text-xs text-text-muted">None yet.</span>}
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-alt px-2.5 py-0.5 text-xs font-medium text-text-primary"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="text-text-muted transition hover:text-red-600"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add value…"
          className={`${inputClass} flex-1`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!trimmed || duplicate}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {duplicate && <p className="text-[11px] text-red-600">Already in the list.</p>}
    </div>
  );
};

const TaxonomyEditor = ({
  value,
  onChange,
}: {
  value: JsonValue;
  onChange: (v: JsonValue) => void;
}): JSX.Element => {
  const obj = isRecord(value) ? value : {};
  const knownKeys = Object.keys(TAXONOMY_LABELS);
  const extraKeys = Object.keys(obj).filter((k) => !(k in TAXONOMY_LABELS) && Array.isArray(obj[k]));
  const keys = [...knownKeys, ...extraKeys];

  return (
    <div className="space-y-4">
      {keys.map((key) => {
        const meta = TAXONOMY_LABELS[key] ?? { label: humanizeKey(key) };
        const list = Array.isArray(obj[key])
          ? (obj[key] as JsonValue[]).filter((v): v is string => typeof v === 'string')
          : [];
        return (
          <div key={key} className="rounded-md border border-border bg-surface-alt/40 p-3">
            <p className="text-sm font-semibold text-text-primary">{meta.label}</p>
            {meta.description && <p className="mb-2 text-xs text-text-muted">{meta.description}</p>}
            <ChipList values={list} onChange={(next) => onChange({ ...obj, [key]: next })} />
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────── checklist templates ─────────────────────────

interface Control {
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
}

const AUDIT_TYPE_LABELS: Record<string, string> = {
  it: 'IT',
  financial: 'Financial',
  compliance: 'Compliance',
  systems: 'Systems',
  operational: 'Operational',
};

const toControl = (v: JsonValue): Control => {
  const r = isRecord(v) ? v : {};
  return {
    controlReference: typeof r.controlReference === 'string' ? r.controlReference : '',
    controlDescription: typeof r.controlDescription === 'string' ? r.controlDescription : '',
    testProcedure: typeof r.testProcedure === 'string' ? r.testProcedure : '',
  };
};

const ChecklistTemplatesEditor = ({
  value,
  onChange,
}: {
  value: JsonValue;
  onChange: (v: JsonValue) => void;
}): JSX.Element => {
  const obj = isRecord(value) ? value : {};
  const types = Object.keys(obj);
  const [openType, setOpenType] = useState<string | null>(types[0] ?? null);

  const controlsFor = (type: string): Control[] =>
    Array.isArray(obj[type]) ? (obj[type] as JsonValue[]).map(toControl) : [];

  const setControls = (type: string, controls: Control[]) => {
    onChange({ ...obj, [type]: controls as unknown as JsonValue });
  };

  if (types.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-text-muted">
        No checklist templates configured. Add audit types under Audit Taxonomy first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {types.map((type) => {
        const controls = controlsFor(type);
        const isOpen = openType === type;
        const update = (index: number, patch: Partial<Control>) =>
          setControls(type, controls.map((c, i) => (i === index ? { ...c, ...patch } : c)));
        const remove = (index: number) => setControls(type, controls.filter((_, i) => i !== index));
        const move = (index: number, dir: -1 | 1) => {
          const target = index + dir;
          if (target < 0 || target >= controls.length) return;
          const next = [...controls];
          [next[index], next[target]] = [next[target], next[index]];
          setControls(type, next);
        };
        const add = () =>
          setControls(type, [...controls, { controlReference: '', controlDescription: '', testProcedure: '' }]);

        return (
          <div key={type} className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setOpenType(isOpen ? null : type)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="text-sm font-semibold text-text-primary">
                {AUDIT_TYPE_LABELS[type] ?? humanizeKey(type)} Audit
                <span className="ml-2 text-xs font-normal text-text-muted">
                  {controls.length} control{controls.length === 1 ? '' : 's'}
                </span>
              </span>
              {isOpen ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />}
            </button>

            {isOpen && (
              <div className="space-y-3 border-t border-border p-3">
                {controls.map((control, index) => (
                  <div key={index} className="rounded-md border border-border bg-surface-alt/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary">Control {index + 1}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          className="text-text-muted transition hover:text-text-primary disabled:opacity-30"
                          aria-label="Move control up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === controls.length - 1}
                          onClick={() => move(index, 1)}
                          className="text-text-muted transition hover:text-text-primary disabled:opacity-30"
                          aria-label="Move control down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded p-1 text-text-muted transition hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove control"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-secondary">Control reference</label>
                        <Input
                          value={control.controlReference}
                          placeholder="e.g. ISO27001-A.5.15"
                          onChange={(e) => update(index, { controlReference: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-secondary">Control description</label>
                        <Textarea
                          rows={2}
                          value={control.controlDescription}
                          onChange={(e) => update(index, { controlDescription: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-text-secondary">Test procedure</label>
                        <Textarea
                          rows={2}
                          value={control.testProcedure}
                          onChange={(e) => update(index, { testProcedure: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={add}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-primary hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Add control
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ───────────────────────── dispatcher ─────────────────────────

/** Routes each customization key to its friendly editor, falling back to the generic tree editor. */
export const KeyedConfigEditor = ({
  configKey,
  value,
  onChange,
}: {
  configKey: string;
  value: JsonValue;
  onChange: (v: JsonValue) => void;
}): JSX.Element => {
  switch (configKey) {
    case 'audit_lifecycle_rules':
      return <BooleanRulesEditor value={value} onChange={onChange} labels={LIFECYCLE_LABELS} />;
    case 'dashboard_kpi_visibility':
      return <BooleanRulesEditor value={value} onChange={onChange} labels={KPI_LABELS} />;
    case 'audit_sla_rules':
      return <SlaRulesEditor value={value} onChange={onChange} />;
    case 'audit_taxonomy':
      return <TaxonomyEditor value={value} onChange={onChange} />;
    case 'approval_matrix':
      return <ApprovalMatrixEditor value={value} onChange={onChange} />;
    case 'checklist_templates':
      return <ChecklistTemplatesEditor value={value} onChange={onChange} />;
    default:
      return <ConfigValueEditor value={value} onChange={onChange} />;
  }
};
