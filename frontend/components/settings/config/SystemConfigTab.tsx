'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Check, X, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { systemConfigApi } from '@/lib/api/settings';
import type { SystemConfigDto } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

interface EditState {
  key: string;
  value: string;
}

export const SystemConfigTab = (): JSX.Element => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditState | null>(null);

  const query = useQuery({
    queryKey: ['settings', 'config'],
    queryFn: systemConfigApi.list,
  });

  const saveMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | null }) =>
      systemConfigApi.update(key, value || null),
    onSuccess: (updated) => {
      toast.success(`Config "${updated.key}" updated`);
      qc.setQueryData<SystemConfigDto[]>(['settings', 'config'], (prev) =>
        prev ? prev.map((c) => (c.key === updated.key ? updated : c)) : prev,
      );
      setEditing(null);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to update config'),
  });

  const startEdit = (cfg: SystemConfigDto) => {
    setEditing({ key: cfg.key, value: cfg.value ?? '' });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = () => {
    if (!editing) return;
    saveMut.mutate({ key: editing.key, value: editing.value });
  };

  if (query.isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn('flex items-center gap-4 px-4 py-3', i > 0 && 'border-t border-border')}
          >
            <div className="h-4 w-40 animate-pulse rounded bg-surface-alt" />
            <div className="h-4 w-64 animate-pulse rounded bg-surface-alt" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-surface-alt" />
          </div>
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-lg border border-border bg-surface-elevated p-10 text-center">
        <p className="text-sm text-danger">Failed to load system configuration.</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const configs = query.data ?? [];

  if (configs.length === 0) {
    return (
      <EmptyState
        icon={<SlidersHorizontal className="h-4 w-4" />}
        title="No configuration keys"
        description="System configuration keys will appear here once defined."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-elevated">
      <div className="bg-surface-alt px-4 py-2.5 hidden md:block">
        <div className="grid grid-cols-[180px_1fr_150px_100px_56px] gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Key
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Value
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Description
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Visibility
          </span>
          <span />
        </div>
      </div>

      <div className="divide-y divide-border">
        {configs.map((cfg) => {
          const isEditing = editing?.key === cfg.key;
          const isSaving = saveMut.isPending && editing?.key === cfg.key;

          return (
            <div
              key={cfg.id}
              className={cn(
                'flex flex-col gap-3 p-4 md:grid md:grid-cols-[180px_1fr_150px_100px_56px] md:items-center md:gap-4 md:px-4 md:py-3 transition-colors',
                isEditing && 'bg-blue-50/30',
              )}
            >
              {/* Key */}
              <div className="flex items-center justify-between md:block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary md:hidden">Key</span>
                <code className="truncate rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-text-primary">
                  {cfg.key}
                </code>
              </div>

              {/* Value */}
              <div className="min-w-0 flex flex-col md:block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary md:hidden mb-1">Value</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    autoFocus
                    className="w-full rounded-md border border-primary bg-white px-3 py-1.5 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                ) : (
                  <span
                    className={cn(
                      'block truncate text-sm',
                      cfg.value ? 'text-text-primary' : 'italic text-text-muted',
                    )}
                  >
                    {cfg.value ?? 'Not set'}
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="flex flex-col md:block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary md:hidden mb-1">Description</span>
                <p className="truncate text-xs text-text-secondary">
                  {cfg.description ?? '—'}
                </p>
              </div>

              {/* Visibility */}
              <div className="flex items-center justify-between md:block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary md:hidden">Visibility</span>
                <Badge tone={cfg.isPublic ? 'green' : 'gray'}>
                  {cfg.isPublic ? 'Public' : 'Private'}
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end border-t border-border/40 pt-2 mt-1 md:border-none md:pt-0 md:mt-0 gap-1">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={isSaving}
                      aria-label="Save"
                      className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      aria-label="Cancel"
                      className="rounded p-1.5 text-text-secondary hover:bg-surface-alt transition-colors disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(cfg)}
                    aria-label={`Edit ${cfg.key}`}
                    className="rounded p-1.5 text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
