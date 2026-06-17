'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Timer,
  FileText,
  Check,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Textarea } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { systemConfigApi } from '@/lib/api/settings';
import type { SystemConfigDto } from '@/lib/types/domain';

type FieldType = 'text' | 'email' | 'tel' | 'url' | 'number' | 'textarea';

interface FieldDef {
  key: string;
  label: string;
  help?: string;
  type: FieldType;
  placeholder?: string;
  suffix?: string;
}

interface GroupDef {
  title: string;
  subtitle: string;
  icon: ReactNode;
  fields: FieldDef[];
}

// Friendly, grouped presentation of the plain-text/number config keys.
// The structured JSON keys are handled in the Audit Customization tab.
const GROUPS: GroupDef[] = [
  {
    title: 'Organisation',
    subtitle: 'Details shown across the app and printed on audit reports.',
    icon: <Building2 className="h-4 w-4" />,
    fields: [
      { key: 'org_name', label: 'Organisation name', type: 'text', help: 'Full legal name shown on reports.' },
      { key: 'org_short_name', label: 'Short name', type: 'text', help: 'Abbreviation used in compact places.' },
      { key: 'audit_dept_name', label: 'Audit department name', type: 'text' },
      { key: 'org_email', label: 'Contact email', type: 'email', placeholder: 'name@example.com' },
      { key: 'org_phone', label: 'Contact phone', type: 'tel', placeholder: '+234 ...' },
      { key: 'org_website', label: 'Website', type: 'url', placeholder: 'https://...' },
      { key: 'org_address', label: 'Address', type: 'textarea', help: 'Appears in report headers.' },
    ],
  },
  {
    title: 'Service levels',
    subtitle: 'Default timeframes applied to new audit work.',
    icon: <Timer className="h-4 w-4" />,
    fields: [
      { key: 'default_sla_days', label: 'Default engagement turnaround', type: 'number', suffix: 'days', help: 'Target time to complete an engagement.' },
      { key: 'finding_due_days', label: 'Default finding due window', type: 'number', suffix: 'days', help: 'Time given to remediate a finding.' },
    ],
  },
  {
    title: 'Reporting',
    subtitle: 'Wording printed on generated audit reports.',
    icon: <FileText className="h-4 w-4" />,
    fields: [
      { key: 'report_footer_notice', label: 'Report footer notice', type: 'textarea', help: 'Confidentiality line printed at the foot of every report.' },
    ],
  },
];

// Structured settings that live in the Audit Customization tab — never shown as raw JSON here.
const STRUCTURED_KEYS = new Set([
  'audit_lifecycle_rules',
  'audit_sla_rules',
  'dashboard_kpi_visibility',
  'audit_taxonomy',
  'approval_matrix',
  'checklist_templates',
]);

const KNOWN_KEYS = new Set(GROUPS.flatMap((g) => g.fields.map((f) => f.key)));

const humanize = (key: string): string =>
  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const SystemConfigTab = (): JSX.Element => {
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
    mutationFn: async (keys: string[]) =>
      Promise.all(keys.map((key) => systemConfigApi.update(key, drafts[key] ?? ''))),
    onSuccess: (updatedRows) => {
      qc.setQueryData<SystemConfigDto[]>(['settings', 'config'], (prev) =>
        prev ? prev.map((row) => updatedRows.find((u) => u.key === row.key) ?? row) : prev,
      );
      setDrafts((prev) => {
        const next = { ...prev };
        updatedRows.forEach((u) => delete next[u.key]);
        return next;
      });
      toast.success('Settings saved');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save settings'),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  // Any scalar key the backend exposes that we don't explicitly group — show it so
  // nothing silently disappears, but keep it out of the structured-JSON bucket.
  const extraFields: FieldDef[] = (query.data ?? [])
    .filter((row) => !KNOWN_KEYS.has(row.key) && !STRUCTURED_KEYS.has(row.key))
    .map((row) => ({
      key: row.key,
      label: humanize(row.key),
      help: row.description ?? undefined,
      type: (row.value?.length ?? 0) > 80 ? 'textarea' : 'text',
    }));

  const groups: GroupDef[] = extraFields.length
    ? [
        ...GROUPS,
        {
          title: 'Additional settings',
          subtitle: 'Other configuration values.',
          icon: <SlidersHorizontal className="h-4 w-4" />,
          fields: extraFields,
        },
      ]
    : GROUPS;

  const valueOf = (key: string): string => drafts[key] ?? configByKey.get(key)?.value ?? '';
  const isDirty = (key: string): boolean =>
    key in drafts && drafts[key] !== (configByKey.get(key)?.value ?? '');

  const setDraft = (key: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [key]: value }));

  const isStructuredSaving = (keys: string[]) =>
    saveMut.isPending && keys.some((k) => (saveMut.variables ?? []).includes(k));

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-alt/50 px-4 py-3">
        <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
        <p className="text-xs leading-relaxed text-text-secondary">
          Edit your organisation details and default timeframes below. Advanced rules — approval
          chains, lifecycle gates, SLA matrices, audit taxonomy, and checklist templates — are
          managed in the{' '}
          <span className="inline-flex items-center gap-0.5 font-medium text-text-primary">
            Audit Customization <ArrowRight className="h-3 w-3" />
          </span>{' '}
          tab.
        </p>
      </div>

      {groups.map((group) => {
        const dirtyKeys = group.fields.map((f) => f.key).filter(isDirty);
        const groupDirty = dirtyKeys.length > 0;
        const groupSaving = isStructuredSaving(group.fields.map((f) => f.key));

        return (
          <Card key={group.title}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {group.icon}
                  </span>
                  {group.title}
                </span>
              }
              subtitle={group.subtitle}
            />

            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {group.fields.map((field) => {
                const isWide = field.type === 'textarea';
                return (
                  <div key={field.key} className={isWide ? 'sm:col-span-2' : undefined}>
                    <FormField label={field.label} hint={field.help}>
                      {field.type === 'textarea' ? (
                        <Textarea
                          rows={3}
                          value={valueOf(field.key)}
                          placeholder={field.placeholder}
                          onChange={(e) => setDraft(field.key, e.target.value)}
                        />
                      ) : field.type === 'number' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-32">
                            <Input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={valueOf(field.key)}
                              placeholder={field.placeholder}
                              onChange={(e) => setDraft(field.key, e.target.value)}
                            />
                          </div>
                          {field.suffix && (
                            <span className="text-sm text-text-secondary">{field.suffix}</span>
                          )}
                        </div>
                      ) : (
                        <Input
                          type={field.type}
                          autoComplete="off"
                          value={valueOf(field.key)}
                          placeholder={field.placeholder}
                          onChange={(e) => setDraft(field.key, e.target.value)}
                        />
                      )}
                    </FormField>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
              {groupDirty && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={() =>
                    setDrafts((prev) => {
                      const next = { ...prev };
                      dirtyKeys.forEach((k) => delete next[k]);
                      return next;
                    })
                  }
                >
                  Discard
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                leftIcon={<Check className="h-3.5 w-3.5" />}
                disabled={!groupDirty || groupSaving}
                isLoading={groupSaving}
                onClick={() => saveMut.mutate(dirtyKeys)}
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
