'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Search, Shield, X } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { rolesApi, permissionsApi } from '@/lib/api/settings';
import type { RoleListDto, PermissionDto } from '@/lib/types/domain';
import { getPermissionExplanation } from '@/lib/utils/permission-descriptions';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  role: RoleListDto;
}

type PermissionItem = PermissionDto & { description: string | null };
type StatusFilter = 'all' | 'selected' | 'unselected';

interface IndexedPermission {
  perm: PermissionItem;
  displayName: string;
  summary: string;
  rawSearch: string;
  normalizedSearch: string;
}

interface IndexedModule {
  mod: string;
  label: string;
  items: IndexedPermission[];
}

const humanizeModule = (mod: string): string =>
  mod.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const humanizeAction = (action: string): string =>
  action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const normalizeSeparators = (value: string): string =>
  value.toLowerCase().replace(/[:_-]+/g, ' ');

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildHighlightTerms = (tokens: string[]): string[] => {
  const expanded = new Set<string>();
  for (const token of tokens) {
    if (token.length > 0) expanded.add(token);
    for (const part of token.split(/[:_-]+/)) {
      if (part.length >= 2) expanded.add(part);
    }
  }
  return Array.from(expanded).sort((a, b) => b.length - a.length);
};

const HighlightMatch = ({
  text,
  terms,
}: {
  text: string;
  terms: string[];
}): JSX.Element => {
  if (!terms.length || !text) return <>{text}</>;
  const regex = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, idx) =>
        idx % 2 === 1 ? (
          <mark
            key={idx}
            className="rounded-sm bg-amber-100 px-0.5 font-semibold text-amber-950"
          >
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        ),
      )}
    </>
  );
};

export const EditPermissionsSlideOver = ({ open, onClose, role }: Props): JSX.Element => {
  const qc = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const permsQuery = useQuery({
    queryKey: ['settings', 'permissions'],
    queryFn: permissionsApi.listGrouped,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelected(new Set((role.permissions ?? []).map((p) => p.id)));
      setSearch('');
      setStatusFilter('all');
      setCollapsed(new Set());
    }
  }, [open, role]);

  const saveMut = useMutation({
    mutationFn: () => rolesApi.replacePermissions(role.id, Array.from(selected)),
    onSuccess: () => {
      toast.success('Permissions updated');
      qc.invalidateQueries({ queryKey: ['settings', 'roles'] });
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to update permissions'),
  });

  // Permission changes are batched into one save, so closing early loses them.
  const initialPermissions = role.permissions ?? [];
  const isDirty =
    selected.size !== initialPermissions.length ||
    initialPermissions.some((p) => !selected.has(p.id));

  const togglePerm = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePermissions = (perms: PermissionItem[]) => {
    if (perms.length === 0) return;
    const allSelected = perms.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) perms.forEach((p) => next.delete(p.id));
      else perms.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const toggleCollapsed = (mod: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  // Pre-index all permission text once so keystroke filtering stays instantaneous.
  const indexedModules = useMemo<IndexedModule[]>(() => {
    if (!permsQuery.data) return [];
    return Object.entries(permsQuery.data).map(([mod, perms]) => {
      const label = humanizeModule(mod);
      return {
        mod,
        label,
        items: perms.map((perm) => {
          const displayName = perm.name || humanizeAction(perm.action);
          const exp = getPermissionExplanation(perm.slug);
          const rawSearch = [
            perm.slug,
            displayName,
            perm.action,
            perm.description ?? '',
            exp.what,
            exp.who,
            exp.summary,
            mod,
            label,
          ]
            .join(' ')
            .toLowerCase();
          return {
            perm,
            displayName,
            summary: exp.summary,
            rawSearch,
            normalizedSearch: normalizeSeparators(rawSearch),
          };
        }),
      };
    });
  }, [permsQuery.data]);

  const totalCount = useMemo(
    () => indexedModules.reduce((sum, m) => sum + m.items.length, 0),
    [indexedModules],
  );

  const selectedCatalogCount = useMemo(
    () =>
      indexedModules.reduce(
        (sum, m) => sum + m.items.filter((i) => selected.has(i.perm.id)).length,
        0,
      ),
    [indexedModules, selected],
  );

  const unselectedCatalogCount = Math.max(0, totalCount - selectedCatalogCount);

  const searchTokens = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    return trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  }, [search]);

  const highlightTerms = useMemo(
    () => buildHighlightTerms(searchTokens),
    [searchTokens],
  );

  const hasSearch = searchTokens.length > 0;
  const isFiltered = hasSearch || statusFilter !== 'all';

  const filteredModules = useMemo(() => {
    return indexedModules
      .map((group) => {
        const visibleItems = group.items.filter((item) => {
          if (statusFilter === 'selected' && !selected.has(item.perm.id)) return false;
          if (statusFilter === 'unselected' && selected.has(item.perm.id)) return false;
          if (searchTokens.length === 0) return true;
          return searchTokens.every((token) => {
            const normToken = normalizeSeparators(token);
            return (
              item.rawSearch.includes(token) ||
              (normToken.length > 0 && item.normalizedSearch.includes(normToken))
            );
          });
        });

        const totalSelectedInGroup = group.items.filter((i) =>
          selected.has(i.perm.id),
        ).length;

        return {
          ...group,
          visibleItems,
          totalCount: group.items.length,
          totalSelectedInGroup,
        };
      })
      .filter((group) => group.visibleItems.length > 0);
  }, [indexedModules, selected, statusFilter, searchTokens]);

  const visibleCount = useMemo(
    () => filteredModules.reduce((sum, m) => sum + m.visibleItems.length, 0),
    [filteredModules],
  );

  const allCollapsed =
    filteredModules.length > 0 && filteredModules.every((m) => collapsed.has(m.mod));

  const toggleAllCollapsed = () => {
    if (allCollapsed) {
      setCollapsed(new Set());
    } else {
      setCollapsed(new Set(indexedModules.map((m) => m.mod)));
    }
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    searchInputRef.current?.focus();
  };

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title={`Edit permissions — ${role.name}`}
      description="Search or filter permissions, then check to grant or uncheck to revoke. Changes apply on save."
      width="xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text-secondary">
            {selected.size} permission{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveMut.mutate()}
              isLoading={saveMut.isPending}
            >
              Save permissions
            </Button>
          </div>
        </div>
      }
    >
      {permsQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-alt" />
          ))}
        </div>
      )}

      {permsQuery.isError && (
        <div className="rounded-lg border border-border bg-surface-elevated p-6 text-center">
          <p className="text-sm text-danger">Failed to load permissions.</p>
          <button
            type="button"
            onClick={() => permsQuery.refetch()}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {!permsQuery.isLoading && !permsQuery.isError && (
        <>
          {/* Sticky instant search & filter bar */}
          <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 space-y-2.5 border-b border-border bg-white/95 px-5 py-3 backdrop-blur-sm">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && search) {
                    e.preventDefault();
                    e.nativeEvent.preventDefault();
                    e.stopPropagation();
                    setSearch('');
                  }
                }}
                placeholder="Search permissions (e.g. universe, add, delete, report:approve)..."
                aria-label="Search permissions"
                className={cn(
                  'h-9 w-full rounded-md border border-border bg-white pl-9 pr-8 text-sm text-text-primary placeholder:text-text-muted',
                  'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                )}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear permission search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter permissions by assignment status">
                {(
                  [
                    { key: 'all', label: `All (${totalCount})` },
                    { key: 'selected', label: `Selected (${selectedCatalogCount})` },
                    { key: 'unselected', label: `Not selected (${unselectedCatalogCount})` },
                  ] as const
                ).map((tab) => {
                  const active = statusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                        active
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-surface-alt text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-xs text-text-secondary">
                {isFiltered ? (
                  <span>
                    Showing <strong className="text-text-primary">{visibleCount}</strong> of {totalCount}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={toggleAllCollapsed}
                    className="font-medium text-primary hover:underline"
                  >
                    {allCollapsed ? 'Expand all' : 'Collapse all'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredModules.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface-alt/50 p-8 text-center">
              <p className="text-sm font-medium text-text-primary">
                {search.trim()
                  ? `No permissions match "${search.trim()}"`
                  : statusFilter === 'selected'
                    ? 'No permissions are currently selected on this role'
                    : 'All available permissions are already selected'}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Try another keyword (like &quot;universe&quot;, &quot;plan&quot;, &quot;add&quot;, or &quot;export&quot;) or reset filters.
              </p>
              {isFiltered && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={resetFilters}
                >
                  Reset search &amp; filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredModules.map(
                ({ mod, label, visibleItems, totalCount: groupTotal, totalSelectedInGroup }) => {
                  // Auto-expand when actively searching so every match is immediately visible.
                  const isCollapsed = !hasSearch && collapsed.has(mod);
                  const visiblePerms = visibleItems.map((i) => i.perm);
                  const allVisibleSelected = visiblePerms.every((p) => selected.has(p.id));
                  const allGroupSelected = totalSelectedInGroup === groupTotal;
                  const someGroupSelected = totalSelectedInGroup > 0;

                  return (
                    <div key={mod} className="overflow-hidden rounded-lg border border-border">
                      <div className="flex w-full items-center justify-between gap-2 bg-surface-alt px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => !hasSearch && toggleCollapsed(mod)}
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-2 text-left',
                            !hasSearch && 'cursor-pointer',
                            hasSearch && 'cursor-default',
                          )}
                          aria-expanded={!isCollapsed}
                        >
                          <Shield className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                          <span className="truncate text-sm font-medium text-text-primary">
                            <HighlightMatch text={label} terms={highlightTerms} />
                          </span>
                          <Badge
                            tone={allGroupSelected ? 'green' : someGroupSelected ? 'amber' : 'gray'}
                          >
                            {totalSelectedInGroup}/{groupTotal}
                          </Badge>
                          {isFiltered && (
                            <span className="text-[11px] text-text-muted">
                              ({visibleItems.length} shown)
                            </span>
                          )}
                        </button>

                        <div className="flex shrink-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => togglePermissions(visiblePerms)}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            {allVisibleSelected
                              ? isFiltered
                                ? 'Deselect shown'
                                : 'Deselect all'
                              : isFiltered
                                ? 'Select shown'
                                : 'Select all'}
                          </button>
                          {!hasSearch && (
                            <button
                              type="button"
                              onClick={() => toggleCollapsed(mod)}
                              aria-label={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
                              className="rounded p-0.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="divide-y divide-border">
                          {visibleItems.map(({ perm, displayName, summary }) => (
                            <label
                              key={perm.id}
                              className={cn(
                                'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover',
                                selected.has(perm.id) && 'bg-blue-50/50',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(perm.id)}
                                onChange={() => togglePerm(perm.id)}
                                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-text-primary">
                                    <HighlightMatch text={displayName} terms={highlightTerms} />
                                  </span>
                                  <code className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                                    <HighlightMatch text={perm.slug} terms={highlightTerms} />
                                  </code>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                                  <HighlightMatch text={summary} terms={highlightTerms} />
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          )}
        </>
      )}
    </SlideOver>
  );
};
