'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Code2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { systemConfigApi } from '@/lib/api/settings';
import type { SystemConfigDto } from '@/lib/types/domain';

const CUSTOMIZATION_KEYS = [
  {
    key: 'audit_lifecycle_rules',
    title: 'Lifecycle Gates',
    description: 'Controls the required evidence before engagement status transitions.',
  },
  {
    key: 'audit_sla_rules',
    title: 'SLA Rules',
    description: 'Default due windows for engagements, findings, and high-priority actions.',
  },
  {
    key: 'checklist_templates',
    title: 'Checklist Templates',
    description: 'Control procedures populated when an engagement enters fieldwork.',
  },
  {
    key: 'approval_matrix',
    title: 'Approval Matrix',
    description: 'Documents approval responsibilities by entity type.',
  },
  {
    key: 'audit_taxonomy',
    title: 'Audit Taxonomy',
    description: 'Admin-maintained audit types, priorities, finding categories, and severities.',
  },
  {
    key: 'dashboard_kpi_visibility',
    title: 'Analytics Visibility',
    description: 'Controls KPI groups shown in analytics and management reporting.',
  },
] as const;

export const AuditCustomizationTab = (): JSX.Element => {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ['settings', 'config'],
    queryFn: systemConfigApi.list,
  });

  const configByKey = useMemo(() => {
    const rows = query.data ?? [];
    return new Map(rows.map((row) => [row.key, row]));
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      systemConfigApi.update(key, value),
    onSuccess: (updated) => {
      toast.success(`${updated.key} updated`);
      qc.setQueryData<SystemConfigDto[]>(['settings', 'config'], (prev) =>
        prev ? prev.map((row) => (row.key === updated.key ? updated : row)) : prev,
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[updated.key];
        return next;
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update setting'),
  });

  const save = (key: string, currentValue: string) => {
    const value = drafts[key] ?? currentValue;
    try {
      JSON.parse(value);
    } catch {
      toast.error('Value must be valid JSON before saving');
      return;
    }
    saveMut.mutate({ key, value: JSON.stringify(JSON.parse(value), null, 2) });
  };

  if (query.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-72" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {CUSTOMIZATION_KEYS.map((item) => {
        const config = configByKey.get(item.key);
        const value = drafts[item.key] ?? config?.value ?? '{}';
        const isDirty = drafts[item.key] !== undefined && drafts[item.key] !== config?.value;
        const isSaving = saveMut.isPending && saveMut.variables?.key === item.key;

        return (
          <Card key={item.key} className="flex min-h-[340px] flex-col">
            <CardHeader
              title={<span className="flex items-center gap-2"><Code2 className="h-4 w-4" />{item.title}</span>}
              subtitle={item.description}
              action={<Badge tone={config?.isPublic ? 'green' : 'gray'}>{config?.isPublic ? 'Public' : 'Private'}</Badge>}
            />
            <textarea
              value={value}
              onChange={(event) => setDrafts((prev) => ({ ...prev, [item.key]: event.target.value }))}
              spellCheck={false}
              className="min-h-[210px] flex-1 resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs leading-5 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-text-secondary">{item.key}</p>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    onClick={() => setDrafts((prev) => {
                      const next = { ...prev };
                      delete next[item.key];
                      return next;
                    })}
                  >
                    Reset
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  leftIcon={<Check className="h-3.5 w-3.5" />}
                  disabled={!config || !isDirty || isSaving}
                  isLoading={isSaving}
                  onClick={() => save(item.key, config?.value ?? '{}')}
                >
                  Save
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
