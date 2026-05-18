'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Shield } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { rolesApi, permissionsApi } from '@/lib/api/settings';
import type { RoleListDto, PermissionDto } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  role: RoleListDto;
}

const humanizeModule = (mod: string): string =>
  mod.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const humanizeAction = (action: string): string =>
  action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const EditPermissionsSlideOver = ({ open, onClose, role }: Props): JSX.Element => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const permsQuery = useQuery({
    queryKey: ['settings', 'permissions'],
    queryFn: permissionsApi.listGrouped,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelected(new Set(role.permissions.map((p) => p.id)));
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

  const togglePerm = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModule = (perms: Array<PermissionDto & { description: string | null }>) => {
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

  const modules = permsQuery.data ? Object.entries(permsQuery.data) : [];

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={`Edit permissions — ${role.name}`}
      description="Check permissions to grant them. Uncheck to revoke. Changes apply on save."
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
        <div className="space-y-2">
          {modules.map(([mod, perms]) => {
            const isCollapsed = collapsed.has(mod);
            const allSelected = perms.every((p) => selected.has(p.id));
            const someSelected = perms.some((p) => selected.has(p.id));

            return (
              <div key={mod} className="overflow-hidden rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(mod)}
                  className="flex w-full items-center justify-between bg-surface-alt px-4 py-2.5 text-left hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-text-secondary" />
                    <span className="text-sm font-medium text-text-primary">
                      {humanizeModule(mod)}
                    </span>
                    <Badge tone={allSelected ? 'green' : someSelected ? 'amber' : 'gray'}>
                      {perms.filter((p) => selected.has(p.id)).length}/{perms.length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleModule(perms);
                      }}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      {allSelected ? 'Deselect all' : 'Select all'}
                    </button>
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-text-secondary" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />
                    )}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {perms.map((perm) => (
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text-primary">
                              {humanizeAction(perm.action)}
                            </span>
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-text-secondary">
                              {perm.name}
                            </code>
                          </div>
                          {perm.description && (
                            <p className="mt-0.5 text-xs text-text-secondary">
                              {perm.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SlideOver>
  );
};
