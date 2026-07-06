'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { plansApi, universeApi } from '@/lib/api/audit';
import { riskScoreLabel } from '@/lib/utils/status';
import type { AuditUniverseEntity } from '@/lib/types/domain';

function toISODatetime(dateStr: string): string {
  return dateStr ? `${dateStr}T00:00:00.000Z` : dateStr;
}

const FREQUENCY_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
};

/** "Never audited", "Audit overdue (annual)", or null when the entity is within cycle. */
function auditDueFlag(e: AuditUniverseEntity): string | null {
  if (!e.lastAuditedAt) return 'Never audited';
  const months = FREQUENCY_MONTHS[e.auditFrequency];
  if (!months) return null;
  const due = new Date(e.lastAuditedAt);
  due.setMonth(due.getMonth() + months);
  return due < new Date() ? `Audit overdue (${e.auditFrequency})` : null;
}

const Schema = z.object({
  universeId: z.string().min(1, 'Select an entity'),
  auditType: z.enum(['it', 'financial', 'compliance', 'systems']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  plannedStartDate: z.string().min(1, 'Start date is required'),
  plannedEndDate: z.string().min(1, 'End date is required'),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  planId: string;
}

export const AddPlanItemSlideOver = ({ open, onClose, planId }: Props): JSX.Element => {
  const qc = useQueryClient();

  const universe = useQuery({
    queryKey: ['universe', 'all'],
    queryFn: () => universeApi.list({ pageSize: 100 }),
    enabled: open,
  });

  // Server-side composite priority ranking (risk + open findings + overdue +
  // never audited + staleness, admin-configurable weights). When it fails the
  // client-side risk-score sort below still gives a sensible ordering.
  const recommendations = useQuery({
    queryKey: ['plans', 'recommendations'],
    queryFn: () => plansApi.recommendations(),
    enabled: open,
    retry: false,
  });
  const recByUniverseId = new Map((recommendations.data ?? []).map((r) => [r.universeId, r]));

  // The picker should answer "what most needs auditing", not present an
  // alphabetical list — composite score first, risk score as fallback.
  const rankedEntities = [...(universe.data?.items ?? [])].sort((a, b) => {
    const ra = recByUniverseId.get(a.id)?.score;
    const rb = recByUniverseId.get(b.id)?.score;
    if (ra !== undefined && rb !== undefined) return rb - ra;
    return (b.riskScore ?? 0) - (a.riskScore ?? 0);
  });
  const suggested = recommendations.data
    ? recommendations.data.filter((r) => r.reasons.length > 0).slice(0, 5)
    : null;
  const fallbackSuggested = rankedEntities.filter((e) => auditDueFlag(e) !== null).slice(0, 5);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      universeId: '',
      auditType: 'compliance',
      priority: 'medium',
      plannedStartDate: '',
      plannedEndDate: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        universeId: '',
        auditType: 'compliance',
        priority: 'medium',
        plannedStartDate: '',
        plannedEndDate: '',
        notes: '',
      });
    }
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      plansApi.addItem(planId, {
        universeId: v.universeId,
        auditType: v.auditType,
        priority: v.priority,
        plannedStartDate: toISODatetime(v.plannedStartDate),
        plannedEndDate: toISODatetime(v.plannedEndDate),
        notes: v.notes?.trim() ? v.notes.trim() : null,
      }),
    onSuccess: () => {
      toast.success('Item added to plan');
      qc.invalidateQueries({ queryKey: ['plans', planId] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add item'),
  });

  const onSubmit = handleSubmit((v) => create.mutate(v));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add plan item"
      description="Each item maps to one engagement scheduled within the plan."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={create.isPending} size="sm">
            Add item
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {suggested && suggested.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Recommended — composite priority (weights configurable in Settings)
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {suggested.map((r) => (
                <li key={r.universeId}>
                  <button
                    type="button"
                    onClick={() => setValue('universeId', r.universeId, { shouldValidate: true })}
                    className="text-left text-xs text-amber-900 hover:underline dark:text-amber-200"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-1.5 rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-bold dark:bg-amber-900/60">
                      {r.score}
                    </span>
                  </button>
                  <span className="ml-1 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                    {r.reasons.join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : !suggested && fallbackSuggested.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Suggested — highest risk, audit due
            </p>
            <ul className="mt-1.5 space-y-1">
              {fallbackSuggested.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setValue('universeId', e.id, { shouldValidate: true })}
                    className="text-left text-xs text-amber-900 hover:underline dark:text-amber-200"
                  >
                    <span className="font-medium">{e.name}</span>
                    {' — '}risk {e.riskScore} ({riskScoreLabel(e.riskScore)}) · {auditDueFlag(e)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <FormField
          label="Auditable entity"
          required
          error={errors.universeId?.message}
          hint={
            recommendations.data
              ? 'Sorted by composite audit priority, highest first.'
              : 'Sorted by risk score, highest first.'
          }
        >
          <Select error={errors.universeId?.message} {...register('universeId')}>
            <option value="">Select entity…</option>
            {rankedEntities.map((e) => {
              const rec = recByUniverseId.get(e.id);
              const due = auditDueFlag(e);
              return (
                <option key={e.id} value={e.id}>
                  {e.name} — {rec ? `priority ${rec.score}` : `risk ${e.riskScore} (${riskScoreLabel(e.riskScore)})`}
                  {due ? ` · ${due}` : ''}
                </option>
              );
            })}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Audit type" required error={errors.auditType?.message}>
            <Select error={errors.auditType?.message} {...register('auditType')}>
              <option value="it">IT</option>
              <option value="financial">Financial</option>
              <option value="compliance">Compliance</option>
              <option value="systems">Systems</option>
            </Select>
          </FormField>
          <FormField label="Priority" required error={errors.priority?.message}>
            <Select error={errors.priority?.message} {...register('priority')}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Planned start" required error={errors.plannedStartDate?.message}>
            <Input type="date" error={errors.plannedStartDate?.message} {...register('plannedStartDate')} />
          </FormField>
          <FormField label="Planned end" required error={errors.plannedEndDate?.message}>
            <Input type="date" error={errors.plannedEndDate?.message} {...register('plannedEndDate')} />
          </FormField>
        </div>

        <FormField label="Notes" error={errors.notes?.message}>
          <Textarea rows={3} {...register('notes')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
