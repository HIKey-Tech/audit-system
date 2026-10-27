'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, Trash2, UserCheck, Users, Shield } from 'lucide-react';

import { permissionsApi } from '@/lib/api/settings';
import { usersApi } from '@/lib/api/users';
import type { UserDto } from '@/lib/types/domain';
import { getPermissionExplanation } from '@/lib/utils/permission-descriptions';
import type { JsonValue } from './StructuredConfigEditor';

/** Sentinel that the approval engine resolves to the entity's assigned engagement manager. */
const ENGAGEMENT_MANAGER = 'engagement_manager';

/** The entity chains the approval matrix configures, in display order. */
const ENTITIES: { key: string; label: string; hint: string }[] = [
  { key: 'auditReport', label: 'Audit Review', hint: 'Sign-off chain when an audit review is submitted.' },
  { key: 'auditPlan', label: 'Audit Programme', hint: 'Sign-off chain when an audit programme is submitted.' },
  { key: 'workingPaper', label: 'Working Paper', hint: 'Sign-off chain when a working paper is submitted.' },
  { key: 'findingClosure', label: 'Finding Closure', hint: 'Sign-off chain before a verified finding is closed.' },
];

interface LevelOption {
  value: string;
  label: string;
}

interface ParsedLevel {
  isEngagementManager: boolean;
  userId: string | null;
  permission: string | null;
}

const selectClass =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

const isRecord = (v: JsonValue): v is { [key: string]: JsonValue } =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const toLevels = (raw: JsonValue | undefined): string[] =>
  Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];

const parseLevelEntry = (entry: string): ParsedLevel => {
  if (entry === ENGAGEMENT_MANAGER) {
    return { isEngagementManager: true, userId: null, permission: null };
  }
  if (entry.startsWith('user:')) {
    const parts = entry.split(':');
    const userId = parts[1] || null;
    const permission = parts.slice(2).join(':') || null;
    return { isEngagementManager: false, userId, permission };
  }
  return { isEngagementManager: false, userId: null, permission: entry };
};

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

  const usersQuery = useQuery({
    queryKey: ['users', 'approval-matrix-staff'],
    queryFn: async () => {
      const res = await usersApi.list({ pageSize: 100, isActive: true });
      return res.items ?? [];
    },
  });

  const allUsers = usersQuery.data ?? [];

  // Approver levels are either the engagement-manager sentinel or a narrow
  // permission slug used by approval/closure workflows.
  const baseOptions = useMemo<LevelOption[]>(() => {
    const grouped = permissionsQuery.data ?? {};
    const perms = Object.values(grouped)
      .flat()
      .filter((p) => p.slug.includes('approve') || p.slug === 'finding:close')
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((p) => {
        const exp = getPermissionExplanation(p.slug);
        return { value: p.slug, label: `${p.name} (${p.slug}) — ${exp.what}` };
      });
    return [
      { value: ENGAGEMENT_MANAGER, label: 'Engagement Manager — The lead manager assigned to oversee this specific engagement' },
      ...perms,
    ];
  }, [permissionsQuery.data]);

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

  // Find staff holding a given permission slug
  const userHasPermissionSlug = (u: UserDto, perm: string): boolean => {
    if (u.permissions?.includes(perm) || u.permissions?.includes('*')) return true;
    return Boolean(u.roles?.some((r) => r.permissions?.some((p) => p.slug === perm || p.slug === '*')));
  };

  const getStaffWithPermission = (perm: string | null): UserDto[] => {
    if (!perm) return [];
    return allUsers.filter((u) => userHasPermissionSlug(u, perm));
  };

  return (
    <div className="space-y-6">
      {permissionsQuery.isError && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Could not load the permission list — you can still pick the engagement manager, but other
          approver permissions won&apos;t appear until permissions load.
        </p>
      )}

      {ENTITIES.map((entity) => {
        const levels = toLevels(matrix[entity.key]);
        return (
          <div key={entity.key} className="rounded-lg border border-border bg-surface-alt/40 p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-text-primary">{entity.label}</p>
              <p className="text-xs text-text-muted">{entity.hint}</p>
            </div>

            {levels.length === 0 ? (
              <p className="mb-2 text-xs text-text-muted">No approval levels — submissions cannot be approved.</p>
            ) : (
              <ol className="space-y-3">
                {levels.map((level, index) => {
                  const parsed = parseLevelEntry(level);
                  const currentPerm = parsed.permission || (parsed.isEngagementManager ? null : 'report:approve:final');
                  const eligibleStaff = getStaffWithPermission(currentPerm);
                  const selectedStaff = parsed.userId
                    ? allUsers.find((u) => u.id === parsed.userId)
                    : null;

                  return (
                    <li
                      key={index}
                      className="rounded-md border border-border bg-white p-3 shadow-sm transition hover:border-slate-300"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </span>

                        <div className="flex flex-col pt-0.5">
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

                        <div className="min-w-0 flex-1 space-y-2">
                          {/* Top: Requirement / Stage selector */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-text-secondary">Stage / Permission:</span>
                            <div className="relative flex-1 min-w-[200px]">
                              {parsed.isEngagementManager && (
                                <UserCheck className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
                              )}
                              <select
                                value={parsed.isEngagementManager ? ENGAGEMENT_MANAGER : (currentPerm ?? '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === ENGAGEMENT_MANAGER) {
                                    updateLevel(entity.key, index, ENGAGEMENT_MANAGER);
                                  } else {
                                    // If staff was previously selected, check if they hold the new permission
                                    const staff = parsed.userId ? allUsers.find((u) => u.id === parsed.userId) : null;
                                    const holdsNew = staff && userHasPermissionSlug(staff, val);
                                    if (holdsNew) {
                                      updateLevel(entity.key, index, `user:${staff.id}:${val}`);
                                    } else {
                                      updateLevel(entity.key, index, val);
                                    }
                                  }
                                }}
                                className={`${selectClass} ${parsed.isEngagementManager ? 'pl-7' : ''}`}
                              >
                                {baseOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Permission explanation: what it allows and who should have it */}
                          {currentPerm && !parsed.isEngagementManager && (
                            <div className="rounded border border-blue-100 bg-blue-50/60 p-2.5 text-xs text-slate-700 space-y-1">
                              <div className="flex items-center gap-2">
                                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold text-blue-800 border border-blue-200">
                                  {currentPerm}
                                </code>
                                <span className="font-semibold text-blue-950">Capability & Scope:</span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed pl-0.5">
                                {getPermissionExplanation(currentPerm).summary}
                              </p>
                            </div>
                          )}

                          {/* Bottom: Staff dropdown for specific approver */}
                          {!parsed.isEngagementManager && (
                            <div className="rounded bg-slate-50 border border-slate-200/70 p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                                  <Users className="h-3.5 w-3.5 text-primary" />
                                  Select Staff Member (Designated Approver):
                                </label>
                                {selectedStaff && (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                    <UserCheck className="h-3 w-3" /> Designated: {selectedStaff.displayName || selectedStaff.firstName}
                                  </span>
                                )}
                              </div>

                              <select
                                value={parsed.userId ? `user:${parsed.userId}` : ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) {
                                    // Fallback to permission pool
                                    updateLevel(entity.key, index, currentPerm || 'report:approve:final');
                                  } else {
                                    const selectedId = val.replace(/^user:/, '');
                                    updateLevel(entity.key, index, `user:${selectedId}:${currentPerm || 'report:approve:final'}`);
                                  }
                                }}
                                className={selectClass}
                              >
                                <option value="">
                                  (Any qualified staff holding this permission — Unassigned Pool)
                                </option>
                                {eligibleStaff.map((u) => {
                                  const name = u.displayName || `${u.firstName} ${u.lastName}`.trim();
                                  const detail = u.jobTitle || u.department || u.email;
                                  return (
                                    <option key={u.id} value={`user:${u.id}`}>
                                      {name} — {detail}
                                    </option>
                                  );
                                })}
                              </select>

                              {selectedStaff ? (
                                <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                  <UserCheck className="h-3 w-3 shrink-0" />
                                  <span>
                                    <strong>{selectedStaff.displayName || `${selectedStaff.firstName} ${selectedStaff.lastName}`.trim()}</strong>
                                    {selectedStaff.jobTitle ? ` (${selectedStaff.jobTitle})` : ''} is set straight up as this level&apos;s approver.
                                  </span>
                                </p>
                              ) : eligibleStaff.length === 0 ? (
                                <p className="text-[11px] text-amber-600">
                                  No active staff members currently hold this permission. (Will default to unassigned pool)
                                </p>
                              ) : (
                                <p className="text-[11px] text-text-muted">
                                  Choose a specific staff member above to see their name straight up in the approval chain.
                                </p>
                              )}
                            </div>
                          )}

                          {parsed.isEngagementManager && (
                            <p className="text-xs text-text-muted italic pl-1">
                              Automatically resolves to the Lead Engagement Manager assigned to this specific engagement.
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeLevel(entity.key, index)}
                          className="rounded-md p-1.5 text-text-muted transition hover:bg-red-50 hover:text-red-600 ml-1"
                          aria-label="Remove level"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <button
              type="button"
              onClick={() => addLevel(entity.key)}
              className="mt-3 inline-flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add approval level
            </button>
          </div>
        );
      })}

      <p className="text-xs text-text-muted">
        Each level is actioned in order. When a specific staff member (such as the Director-General or Director)
        is selected, their name is displayed directly across all review and approval chains.
      </p>
    </div>
  );
};
