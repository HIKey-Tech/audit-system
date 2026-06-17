'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { checklistsApi } from '@/lib/api/audit';
import type { ChecklistTemplateConfig, ChecklistTemplateControl } from '@/lib/types/domain';

const AUDIT_TYPES: { key: string; label: string }[] = [
  { key: 'it', label: 'IT' },
  { key: 'financial', label: 'Financial' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'systems', label: 'Systems' },
];

const emptyControl = (): ChecklistTemplateControl => ({
  controlReference: '',
  controlDescription: '',
  testProcedure: '',
});

export const ChecklistTemplatesTab = (): JSX.Element => {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<string>('it');
  const [draft, setDraft] = useState<ChecklistTemplateConfig | null>(null);

  const query = useQuery({
    queryKey: ['settings', 'checklist-templates'],
    queryFn: checklistsApi.getTemplates,
  });

  useEffect(() => {
    if (query.data && !draft) setDraft(query.data);
  }, [query.data, draft]);

  const saveMut = useMutation({
    mutationFn: (templates: ChecklistTemplateConfig) => checklistsApi.updateTemplates(templates),
    onSuccess: (updated) => {
      toast.success('Checklist templates saved');
      qc.setQueryData(['settings', 'checklist-templates'], updated);
      setDraft(updated);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save templates'),
  });

  if (query.isLoading || !draft) {
    return <Skeleton className="h-96" />;
  }
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  const controls = draft[activeType] ?? [];
  const isDirty = JSON.stringify(draft) !== JSON.stringify(query.data);

  const updateControl = (index: number, field: keyof ChecklistTemplateControl, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const list = [...(prev[activeType] ?? [])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, [activeType]: list };
    });
  };

  const addControl = () => {
    setDraft((prev) => (prev ? { ...prev, [activeType]: [...(prev[activeType] ?? []), emptyControl()] } : prev));
  };

  const removeControl = (index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const list = (prev[activeType] ?? []).filter((_, i) => i !== index);
      return { ...prev, [activeType]: list };
    });
  };

  const save = () => {
    // Drop blank rows (no reference) before persisting.
    const cleaned: ChecklistTemplateConfig = {};
    for (const { key } of AUDIT_TYPES) {
      cleaned[key] = (draft[key] ?? []).filter((c) => c.controlReference.trim().length > 0);
    }
    saveMut.mutate(cleaned);
  };

  return (
    <Card>
      <CardHeader
        title="Checklist Templates"
        subtitle="Control procedures auto-populated when an engagement of each audit type enters fieldwork."
        action={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                onClick={() => setDraft(query.data ?? null)}
              >
                Reset
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              leftIcon={<Check className="h-3.5 w-3.5" />}
              disabled={!isDirty || saveMut.isPending}
              isLoading={saveMut.isPending}
              onClick={save}
            >
              Save changes
            </Button>
          </div>
        }
      />

      {/* Audit type selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {AUDIT_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveType(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeType === t.key
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary ring-1 ring-border hover:text-text-primary'
            }`}
          >
            {t.label}
            <span className="ml-1.5 opacity-70">{(draft[t.key] ?? []).length}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {controls.length === 0 && (
          <p className="text-xs text-text-muted">No controls for this audit type yet. Add one below.</p>
        )}
        {controls.map((control, index) => (
          <div key={index} className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-start gap-2">
              <input
                value={control.controlReference}
                onChange={(e) => updateControl(index, 'controlReference', e.target.value)}
                placeholder="Control reference (e.g. ISO27001-A.9)"
                className="w-64 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => removeControl(index)}
                className="ml-auto rounded-md p-1.5 text-text-muted transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remove control"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={control.controlDescription}
              onChange={(e) => updateControl(index, 'controlDescription', e.target.value)}
              placeholder="Control description — what the control requires"
              rows={2}
              className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <textarea
              value={control.testProcedure}
              onChange={(e) => updateControl(index, 'testProcedure', e.target.value)}
              placeholder="Test procedure — how the auditor tests it"
              rows={2}
              className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        leftIcon={<Plus className="h-3.5 w-3.5" />}
        onClick={addControl}
        className="mt-4"
      >
        Add control
      </Button>
    </Card>
  );
};
