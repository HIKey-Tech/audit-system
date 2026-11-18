'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { SlideOver } from '@/components/ui/SlideOver';
import { complianceApi } from '@/lib/api/audit';
import { SELECTABLE_AUDIT_TYPES } from '@/lib/audit-domains';

/**
 * Which Control Library frameworks are pre-selected when an audit of each type is started. The auditor can still
 * untick them or add others in the wizard — this only sets the starting point, so a new audit begins with the right
 * controls without every framework in the library being attached.
 */
export const DefaultFrameworksCard = ({ canManage }: { canManage: boolean }): JSX.Element => {
  const qc = useQueryClient();
  const defaults = useQuery({ queryKey: ['compliance', 'default-frameworks'], queryFn: () => complianceApi.getDefaultFrameworks() });
  const coverage = useQuery({ queryKey: ['compliance', 'coverage'], queryFn: () => complianceApi.coverage() });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [type, setType] = useState<string>(SELECTABLE_AUDIT_TYPES[0]?.value ?? 'it');
  const [search, setSearch] = useState('');

  const frameworks = useMemo(
    () => (coverage.data?.frameworks ?? []).filter((f) => f.isActive).sort((a, b) => a.code.localeCompare(b.code)),
    [coverage.data],
  );
  const byId = useMemo(() => new Map(frameworks.map((f) => [f.id, f])), [frameworks]);

  const save = useMutation({
    mutationFn: () => complianceApi.setDefaultFrameworks(draft),
    onSuccess: () => {
      toast.success('Default frameworks saved');
      qc.invalidateQueries({ queryKey: ['compliance', 'default-frameworks'] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save'),
  });

  const configured = SELECTABLE_AUDIT_TYPES.filter((t) => (defaults.data?.[t.value] ?? []).length > 0);
  const visible = frameworks.filter((f) => {
    const q = search.trim().toLowerCase();
    return !q || f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q);
  });
  const chosen = draft[type] ?? [];
  const toggle = (id: string): void =>
    setDraft((prev) => {
      const current = prev[type] ?? [];
      return { ...prev, [type]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] };
    });

  return (
    <Card padded className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Default frameworks for new audits</p>
          <p className="mt-1 text-xs text-text-secondary">
            When an audit of a type is started, these frameworks are ticked for it automatically. Auditors can untick them or
            add others.
          </p>
        </div>
        {canManage && (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => {
              setDraft({ ...(defaults.data ?? {}) });
              setSearch('');
              setOpen(true);
            }}
          >
            Set defaults
          </Button>
        )}
      </div>
      {configured.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border bg-surface-alt px-3 py-3 text-xs text-text-muted">
          None set. A new audit then starts with the standard checklist for its type, and the auditor picks the frameworks.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {configured.map((t) => (
            <li key={t.value} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-32 shrink-0 font-medium text-text-primary">{t.label}</span>
              <span className="flex flex-wrap gap-1.5">
                {(defaults.data?.[t.value] ?? []).map((id) => (
                  <span key={id} className="rounded bg-surface-alt px-1.5 py-0.5 font-mono text-[11px] text-primary">
                    {byId.get(id)?.code ?? '…'}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Default frameworks"
        description="Choose an audit type, then tick the frameworks that should be pre-selected for it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => save.mutate()} isLoading={save.isPending}>
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {SELECTABLE_AUDIT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
                {(draft[t.value] ?? []).length > 0 ? ` (${(draft[t.value] ?? []).length})` : ''}
              </option>
            ))}
          </Select>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search frameworks…" />
          <div className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
            {visible.map((f) => (
              <label
                key={f.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-xs ${
                  chosen.includes(f.id) ? 'border-primary bg-white' : 'border-transparent bg-surface-alt hover:bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#4F6228]"
                  checked={chosen.includes(f.id)}
                  onChange={() => toggle(f.id)}
                />
                <span className="font-mono font-semibold text-primary">{f.code}</span>
                <span className="min-w-0 flex-1 truncate text-text-primary">{f.name}</span>
                <span className="shrink-0 text-text-muted">{f.activeControls} controls</span>
              </label>
            ))}
          </div>
        </div>
      </SlideOver>
    </Card>
  );
};
