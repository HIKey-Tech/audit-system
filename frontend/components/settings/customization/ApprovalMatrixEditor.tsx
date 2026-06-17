'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, Trash2, UserCheck } from 'lucide-react';

import { permissionsApi } from '@/lib/api/settings';
import type { JsonValue } from './StructuredConfigEditor';

/** Sentinel that the approval engine resolves to the entity's assigned engagement manager. */
const ENGAGEMENT_MANAGER = 'engagement_manager';

/** The entity chains the approval matrix configures, in display order. */
const ENTITIES: { key: string; label: string; hint: string }[] = [
  { key: 'auditPlan', label: 'Audit Plan', hint: 'Sign-off chain when an audit plan is submitted.' },
  { key: 'workingPaper', label: 'Working Paper', hint: 'Sign-off chain when a working paper is submitted.' },
  { key: 'auditReport', label: 'Audit Report', hint: 'Sign-off chain when an audit report is submitted.' },
  { key: 'findingClosure', label: 'Finding Closure', hint: 'Sign-off chain before a verified finding is closed.' },
];

interface LevelOption {
  value: string;
  label: string;
}

const selectClass =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

const isRecord = (v: JsonValue): v is { [key: string]: JsonValue } =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const toLevels = (raw: JsonValue | undefined): string[] =>
  Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];

export const ApprovalMatrixEditor = ({
  value,
  onChange,
}: {
  value: JsonValue;
  onChange: (v: JsonValue) => void;
}): JSX.Element => {
  const matrix = isRecord(value) ? value : {};

  const permissionsQuery = useQuery({
    queryKey: ['settings', 'permissions'],
    queryFn: permissionsApi.listGrouped,
  });

  // Approver levels are either the engagement-manager sentinel or a narrow
  // permission slug used by approval/closure workflows.
  const baseOptions = useMemo<LevelOption[]>(() => {
    const grouped = permissionsQuery.data ?? {};
    const perms = Object.values(grouped)
      .flat()
      .filter((p) => p.slug.includes('approve') || p.slug === 'finding:close')
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((p) => ({ value: p.slug, label: `${p.name} (${p.slug})` }));
    return [{ value: ENGAGEMENT_MANAGER, label: 'Engagement Manager (assigned)' }, ...perms];
  }, [permissionsQuery.data]);

  /** Options for a single select, guaranteeing the current value is always present. */
  const optionsFor = (current: string): LevelOption[] => {
    if (current && !baseOptions.some((o) => o.value === current)) {
      return [...baseOptions, { value: current, label: current }];
    }
    return baseOptions;
  };

  const setLevels = (entityKey: string, levels: string[]) => {
    onChange({ ...matrix, [entityKey]: levels });
  };

  const updateLevel = (entityKey: string, index: number, next: string) => {
    const levels = toLevels(matrix[entityKey]);
    setLevels(entityKey, levels.map((l, i) => (i === index ? next : l)));
  };

  const removeLevel = (entityKey: string, index: number) => {
    const levels = toLevels(matrix[entityKey]);
    setLevels(entityKey, levels.filter((_, i) => i !== index));
  };

  const moveLevel = (entityKey: string, index: number, dir: -1 | 1) => {
    const levels = toLevels(matrix[entityKey]);
    const target = index + dir;
    if (target < 0 || target >= levels.length) return;
    const next = [...levels];
    [next[index], next[target]] = [next[target], next[index]];
    setLevels(entityKey, next);
  };

  const addLevel = (entityKey: string) => {
    const levels = toLevels(matrix[entityKey]);
    setLevels(entityKey, [...levels, ENGAGEMENT_MANAGER]);
  };

  return (
    <div className="space-y-5">
      {permissionsQuery.isError && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Could not load the permission list — you can still pick the engagement manager, but other
          approver permissions won&apos;t appear until permissions load.
        </p>
      )}

      {ENTITIES.map((entity) => {
        const levels = toLevels(matrix[entity.key]);
        return (
          <div key={entity.key} className="rounded-md border border-border bg-surface-alt/40 p-3">
            <div className="mb-2">
              <p className="text-sm font-semibold text-text-primary">{entity.label}</p>
              <p className="text-xs text-text-muted">{entity.hint}</p>
            </div>

            {levels.length === 0 ? (
              <p className="mb-2 text-xs text-text-muted">No approval levels — submissions cannot be approved.</p>
            ) : (
              <ol className="space-y-2">
                {levels.map((level, index) => (
                  <li key={index} className="flex items-center gap-1.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveLevel(entity.key, index, -1)}
                        className="text-text-muted transition hover:text-text-primary disabled:opacity-30"
                        aria-label="Move level up"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === levels.length - 1}
                        onClick={() => moveLevel(entity.key, index, 1)}
                        className="text-text-muted transition hover:text-text-primary disabled:opacity-30"
                        aria-label="Move level down"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="relative flex-1">
                      {level === ENGAGEMENT_MANAGER && (
                        <UserCheck className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
                      )}
                      <select
                        value={level}
                        onChange={(e) => updateLevel(entity.key, index, e.target.value)}
                        className={`${selectClass} ${level === ENGAGEMENT_MANAGER ? 'pl-7' : ''}`}
                      >
                        {optionsFor(level).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLevel(entity.key, index)}
                      className="rounded-md p-1.5 text-text-muted transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove level"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <button
              type="button"
              onClick={() => addLevel(entity.key)}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add level
            </button>
          </div>
        );
      })}

      <p className="text-xs text-text-muted">
        Each level is actioned in order. &ldquo;Engagement Manager&rdquo; pins the level to the entity&apos;s
        assigned manager; any other entry is a permission — any active holder can approve it.
      </p>
    </div>
  );
};
