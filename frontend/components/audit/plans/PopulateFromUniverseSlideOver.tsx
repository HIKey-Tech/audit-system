'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, CheckSquare, Square, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { plansApi, type AddPlanItemDto } from '@/lib/api/audit';
import { humanizeStatus, riskScoreLabel } from '@/lib/utils/status';
import type { PlanUniverseCandidate, PlanUniverseDueStatus } from '@/lib/types/domain';

type FilterMode = 'due' | 'unscheduled' | 'all' | 'on_demand';
type PriorityValue = 'critical' | 'high' | 'medium' | 'low';

interface DraftSelection {
  universeId: string;
  priority: PriorityValue;
  plannedStartDate: string;
  plannedEndDate: string;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  planId: string;
  planTitle: string;
  planYear: number;
}

const toISODatetime = (dateStr: string): string => (dateStr ? `${dateStr}T00:00:00.000Z` : dateStr);

const isDueCandidate = (dueStatus: PlanUniverseDueStatus): boolean =>
  dueStatus === 'overdue' || dueStatus === 'never_audited' || dueStatus === 'due_in_year';

const DUE_BADGE: Record<
  PlanUniverseDueStatus,
  { label: string; tone: 'red' | 'amber' | 'blue' | 'green' | 'gray' }
> = {
  overdue: { label: 'Overdue', tone: 'red' },
  never_audited: { label: 'Never audited', tone: 'amber' },
  due_in_year: { label: 'Due this year', tone: 'blue' },
  on_track: { label: 'On track', tone: 'green' },
  on_demand: { label: 'On-Demand', tone: 'gray' },
};

export const PopulateFromUniverseSlideOver = ({
  open,
  onClose,
  planId,
  planTitle,
  planYear,
}: Props): JSX.Element => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('due');
  const [defaultStart, setDefaultStart] = useState(`${planYear}-01-01`);
  const [defaultEnd, setDefaultEnd] = useState(`${planYear}-03-31`);
  const [selected, setSelected] = useState<Record<string, DraftSelection>>({});

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setFilter('due');
    setDefaultStart(`${planYear}-01-01`);
    setDefaultEnd(`${planYear}-03-31`);
    setSelected({});
  }, [open, planYear]);

  const candidatesQuery = useQuery({
    queryKey: ['plans', planId, 'universe-candidates'],
    queryFn: () => plansApi.universeCandidates(planId),
    enabled: open && Boolean(planId),
  });

  const candidates = candidatesQuery.data ?? [];

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (filter === 'due' && !isDueCandidate(c.dueStatus)) return false;
      if (filter === 'unscheduled' && (c.alreadyInThisPlanCount > 0 || c.alreadyInYearPlans.length > 0)) {
        return false;
      }
      if (filter === 'on_demand' && c.dueStatus !== 'on_demand') return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.ownerName ?? '').toLowerCase().includes(q)
      );
    });
  }, [candidates, filter, search]);

  const dueUnscheduled = useMemo(
    () => candidates.filter((c) => isDueCandidate(c.dueStatus) && c.alreadyInThisPlanCount === 0),
    [candidates],
  );

  const selectedList = Object.values(selected);
  const selectedCount = selectedList.length;

  const toggleCandidate = (c: PlanUniverseCandidate) => {
    setSelected((prev) => {
      if (prev[c.universeId]) {
        const next = { ...prev };
        delete next[c.universeId];
        return next;
      }
      return {
        ...prev,
        [c.universeId]: {
          universeId: c.universeId,
          priority: c.recommendedPriority,
          plannedStartDate: defaultStart,
          plannedEndDate: defaultEnd,
          notes: '',
        },
      };
    });
  };

  const selectAllDue = () => {
    if (dueUnscheduled.length === 0) return;
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of dueUnscheduled) {
        if (!next[c.universeId]) {
          next[c.universeId] = {
            universeId: c.universeId,
            priority: c.recommendedPriority,
            plannedStartDate: defaultStart,
            plannedEndDate: defaultEnd,
            notes: '',
          };
        }
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = { ...prev };
      for (const c of filteredCandidates) {
        if (!next[c.universeId]) {
          next[c.universeId] = {
            universeId: c.universeId,
            priority: c.recommendedPriority,
            plannedStartDate: defaultStart,
            plannedEndDate: defaultEnd,
            notes: '',
          };
        }
      }
      return next;
    });
  };

  const applyDefaultsToSelected = () => {
    if (!defaultStart || !defaultEnd || defaultStart > defaultEnd) {
      toast.error('Enter a valid default date range first');
      return;
    }
    setSelected((prev) => {
      const next: Record<string, DraftSelection> = {};
      for (const [id, entry] of Object.entries(prev)) {
        next[id] = {
          ...entry,
          plannedStartDate: defaultStart,
          plannedEndDate: defaultEnd,
        };
      }
      return next;
    });
    toast.success('Applied default dates to selected entities');
  };

  const updateRow = <K extends keyof DraftSelection>(
    universeId: string,
    field: K,
    value: DraftSelection[K],
  ) => {
    setSelected((prev) => {
      const current = prev[universeId];
      if (!current) return prev;
      return { ...prev, [universeId]: { ...current, [field]: value } };
    });
  };

  const populateMut = useMutation({
    mutationFn: async (rows: DraftSelection[]) => {
      const payload: AddPlanItemDto[] = rows.map((r) => ({
        universeId: r.universeId,
        priority: r.priority,
        plannedStartDate: toISODatetime(r.plannedStartDate),
        plannedEndDate: toISODatetime(r.plannedEndDate),
        notes: r.notes.trim() ? r.notes.trim() : null,
      }));
      // Backend bulk endpoint accepts up to 100 items per call; chunk safely if more are picked.
      for (let i = 0; i < payload.length; i += 100) {
        await plansApi.bulkAddItems(planId, payload.slice(i, i + 100));
      }
    },
    onSuccess: (_res, rows) => {
      toast.success(`Added ${rows.length} item${rows.length === 1 ? '' : 's'} from Audit Universe`);
      qc.invalidateQueries({ queryKey: ['plans', planId] });
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['plans', planId, 'universe-candidates'] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to populate programme');
    },
  });

  const handleSubmit = () => {
    if (selectedList.length === 0) {
      toast.error('Select at least one entity from the Audit Universe');
      return;
    }
    for (const row of selectedList) {
      if (!row.plannedStartDate || !row.plannedEndDate) {
        toast.error('Every selected entity must have both start and end dates');
        return;
      }
      if (row.plannedStartDate > row.plannedEndDate) {
        toast.error('Planned end date must be on or after start date for all selected entities');
        return;
      }
    }
    populateMut.mutate(selectedList);
  };

  const tabItems: Array<{ key: FilterMode; label: string }> = [
    { key: 'due', label: 'Due / Recommended' },
    { key: 'unscheduled', label: `Not in ${planYear} Programmes` },
    { key: 'all', label: 'All Active' },
    { key: 'on_demand', label: 'On-Demand' },
  ];

  return (
    <SlideOver
      open={open}
      dirty={selectedCount > 0}
      onClose={onClose}
      width="xl"
      title="Populate from Audit Universe"
      description={`Select active entities from the Audit Universe to feed into "${planTitle}" (${planYear}). Priorities default from each entity's risk score.`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-text-secondary">
            {selectedCount === 0
              ? 'No entities selected yet'
              : `${selectedCount} entit${selectedCount === 1 ? 'y' : 'ies'} queued to add`}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              leftIcon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={handleSubmit}
              disabled={selectedCount === 0}
              isLoading={populateMut.isPending}
            >
              Add selected ({selectedCount})
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Default Schedule Window */}
        <div className="rounded-lg border border-border bg-surface-alt p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Default start date
              </label>
              <Input
                type="date"
                value={defaultStart}
                onChange={(e) => setDefaultStart(e.target.value)}
              />
            </div>
            <div className="min-w-[140px] flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Default end date
              </label>
              <Input
                type="date"
                value={defaultEnd}
                onChange={(e) => setDefaultEnd(e.target.value)}
              />
            </div>
            {selectedCount > 0 && (
              <Button type="button" size="sm" variant="secondary" onClick={applyDefaultsToSelected}>
                Apply to selected
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-text-secondary">
            Newly checked entities inherit these dates automatically; expand any selected entity below to customise its dates, priority, or notes.
          </p>
        </div>

        {/* Search + Filter Pills + Bulk Quick Select */}
        <div className="space-y-2.5">
          <Input
            placeholder="Search Audit Universe by name, category, or owner…"
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {tabItems.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    filter === tab.key
                      ? 'bg-primary text-white'
                      : 'bg-surface-alt text-text-secondary hover:bg-slate-200/70'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {dueUnscheduled.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllDue}
                  className="font-medium text-primary hover:underline"
                >
                  Select all due ({dueUnscheduled.length})
                </button>
              )}
              {filteredCandidates.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="font-medium text-text-secondary hover:text-text-primary hover:underline"
                >
                  Select visible ({filteredCandidates.length})
                </button>
              )}
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected({})}
                  className="font-medium text-danger hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Candidate Rows */}
        {candidatesQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : candidatesQuery.isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            Could not load Audit Universe entities.{' '}
            <button
              type="button"
              onClick={() => candidatesQuery.refetch()}
              className="font-semibold underline"
            >
              Retry
            </button>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-secondary">
            {candidates.length === 0
              ? 'No active entities exist in the Audit Universe yet.'
              : 'No entities match the active filter. Try switching to "All Active".'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCandidates.map((c) => {
              const draft = selected[c.universeId];
              const isChecked = Boolean(draft);
              const badge = DUE_BADGE[c.dueStatus];
              const extraOwners = Math.max(0, (c.owners?.length ?? 1) - 1);

              return (
                <div
                  key={c.universeId}
                  className={`rounded-lg border p-3 transition-colors ${
                    isChecked ? 'border-primary bg-primary/5' : 'border-border bg-white'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleCandidate(c)}
                      className="mt-0.5 text-primary focus:outline-none"
                      aria-label={isChecked ? `Deselect ${c.name}` : `Select ${c.name}`}
                    >
                      {isChecked ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4 text-text-muted" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleCandidate(c)}
                          className="text-left text-sm font-medium text-text-primary hover:text-primary"
                        >
                          {c.name}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                          <Badge tone="gray">Score {c.score}</Badge>
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-text-secondary">
                        {humanizeStatus(c.category)} · Risk {c.riskScore} ({riskScoreLabel(c.riskScore)}) ·{' '}
                        {humanizeStatus(c.auditFrequency)}
                        {c.ownerName ? ` · Owner: ${c.ownerName}` : ''}
                        {extraOwners > 0 ? ` (+${extraOwners})` : ''}
                        {c.openFindingsCount > 0 ? ` · ${c.openFindingsCount} open finding(s)` : ''}
                      </p>

                      {(c.alreadyInThisPlanCount > 0 || c.alreadyInYearPlans.length > 0) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.alreadyInThisPlanCount > 0 && (
                            <Badge tone="purple">
                              In this programme ({c.alreadyInThisPlanCount})
                            </Badge>
                          )}
                          {c.alreadyInYearPlans.map((p) => (
                            <Badge key={p.planId} tone="blue">
                              In {p.planTitle}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {draft && (
                        <div className="mt-3 grid grid-cols-1 gap-2 rounded-md border border-border bg-white p-2.5 sm:grid-cols-4">
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                              Priority
                            </label>
                            <Select
                              value={draft.priority}
                              onChange={(e) =>
                                updateRow(
                                  c.universeId,
                                  'priority',
                                  e.target.value as PriorityValue,
                                )
                              }
                            >
                              <option value="critical">Critical</option>
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                              Start date
                            </label>
                            <Input
                              type="date"
                              value={draft.plannedStartDate}
                              onChange={(e) =>
                                updateRow(c.universeId, 'plannedStartDate', e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                              End date
                            </label>
                            <Input
                              type="date"
                              value={draft.plannedEndDate}
                              onChange={(e) =>
                                updateRow(c.universeId, 'plannedEndDate', e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                              Notes
                            </label>
                            <Input
                              placeholder="Optional note…"
                              value={draft.notes}
                              onChange={(e) => updateRow(c.universeId, 'notes', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SlideOver>
  );
};

