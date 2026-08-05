'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { systemConfigApi } from '@/lib/api/settings';
import type { SystemConfigDto } from '@/lib/types/domain';
import { type JsonValue } from './StructuredConfigEditor';
import { KeyedConfigEditor } from './CustomizationEditors';

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
    key: 'approval_matrix',
    title: 'Approval Matrix',
    description: 'Ordered approver chain per entity type.',
  },
  {
    key: 'audit_taxonomy',
    title: 'Audit Taxonomy',
    description: 'Admin-maintained audit types, priorities, finding categories, and severities.',
  },
  {
    key: 'dashboard_kpi_visibility',
    title: 'Analytics Visibility',
    description: 'Controls KPI groups shown in analytics and management reviews.',
  },
  {
    key: 'planning_priority_weights',
    title: 'Planning Priority Weights',
    description:
      'Relative importance of risk score, unresolved findings, audit overdue, never audited, and time since last audit in the recommended-audit ranking. Any scale — weights are normalized by their sum.',
  },
] as const;

const tryParse = (raw: string | null | undefined): JsonValue => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return {};
  }
};

export const AuditCustomizationTab = (): JSX.Element => {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, JsonValue>>({});

  const query = useQuery({
    queryKey: ['settings', 'config'],
    queryFn: systemConfigApi.list,
  });

  const configByKey = useMemo(() => {
    const rows = query.data ?? [];
    return new Map(rows.map((row) => [row.key, row]));
  }, [query.data]);

  const saveMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => systemConfigApi.update(key, value),
    onSuccess: (updated) => {
      toast.success('Settings saved');
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
    <div className="grid items-start gap-4 xl:grid-cols-2">
      {CUSTOMIZATION_KEYS.map((item) => {
        const config = configByKey.get(item.key);
        const original = tryParse(config?.value);
        const draft = item.key in drafts ? drafts[item.key] : original;

        const isDirty = JSON.stringify(draft) !== JSON.stringify(original);
        const isSaving = saveMut.isPending && saveMut.variables?.key === item.key;

        const reset = () =>
          setDrafts((prev) => {
            const next = { ...prev };
            delete next[item.key];
            return next;
          });

        const save = () => saveMut.mutate({ key: item.key, value: JSON.stringify(draft, null, 2) });

        return (
          <Card key={item.key} className="flex flex-col">
            <CardHeader title={item.title} subtitle={item.description} />

            <div className="flex-1">
              <KeyedConfigEditor
                configKey={item.key}
                value={draft}
                onChange={(next) => setDrafts((prev) => ({ ...prev, [item.key]: next }))}
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
              {isDirty && (
                <Button type="button" variant="secondary" size="sm" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={reset}>
                  Discard
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                leftIcon={<Check className="h-3.5 w-3.5" />}
                disabled={!config || !isDirty || isSaving}
                isLoading={isSaving}
                onClick={save}
              >
                Save changes
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
