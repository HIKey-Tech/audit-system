'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { plansApi } from '@/lib/api/audit';
import { humanizeStatus, riskScoreLabel } from '@/lib/utils/status';
import type { AuditPlanItem, PlanUniverseCandidate } from '@/lib/types/domain';

function toISODatetime(dateStr: string): string {
  return dateStr ? `${dateStr}T00:00:00.000Z` : dateStr;
}

function dueBadgeLabel(c: PlanUniverseCandidate): string | null {
  switch (c.dueStatus) {
    case 'overdue':
      return `Overdue (${humanizeStatus(c.auditFrequency)})`;
    case 'never_audited':
      return 'Never audited';
    case 'due_in_year':
      return 'Due this year';
    case 'on_demand':
      return 'On-Demand';
    default:
      return null;
  }
}

const Schema = z
  .object({
    universeId: z.string().min(1, 'Select an active auditable entity from the Audit Universe'),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    plannedStartDate: z.string().min(1, 'Start date is required'),
    plannedEndDate: z.string().min(1, 'End date is required'),
    notes: z.string().max(5000).optional().or(z.literal('')),
  })
  .refine(
    (d) => !d.plannedStartDate || !d.plannedEndDate || d.plannedStartDate <= d.plannedEndDate,
    { message: 'Planned end date must be on or after start date', path: ['plannedEndDate'] },
  );

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  planId: string;
  planYear?: number;
  item?: AuditPlanItem | null;
}

export const AddPlanItemSlideOver = ({
  open,
  onClose,
  planId,
  planYear,
  item,
}: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(item);
  const [priorityTouched, setPriorityTouched] = useState(false);

  const candidatesQuery = useQuery({
    queryKey: ['plans', planId, 'universe-candidates'],
    queryFn: () => plansApi.universeCandidates(planId),
    enabled: open && Boolean(planId),
  });

  const candidates = candidatesQuery.data ?? [];
  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [c.universeId, c])),
    [candidates],
  );

  const candidateOptions: ComboboxOption[] = useMemo(() => {
    const opts = candidates.map((c) => {
      const dueLabel = dueBadgeLabel(c);
      const coverage =
        c.alreadyInThisPlanCount > 0
          ? `in this programme (${c.alreadyInThisPlanCount})`
          : c.alreadyInYearPlans.length > 0
            ? `in ${c.alreadyInYearPlans.length} other ${planYear ?? 'year'} programme(s)`
            : null;
      return {
        value: c.universeId,
        label: c.name,
        hint: [
          humanizeStatus(c.category),
          `score ${c.score}`,
          `risk ${c.riskScore} (${riskScoreLabel(c.riskScore)})`,
          dueLabel,
          coverage,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    });

    // Preserve the existing entity option when editing an item whose entity was later deactivated.
    if (item && !candidateById.has(item.universeId)) {
      opts.unshift({
        value: item.universeId,
        label: `${item.universeName} (inactive)`,
        hint: 'Existing entity on this plan item',
      });
    }

    return opts;
  }, [candidates, candidateById, item, planYear]);

  const suggested = useMemo(
    () =>
      candidates
        .filter((c) => c.alreadyInThisPlanCount === 0 && (c.reasons.length > 0 || c.dueStatus === 'overdue' || c.dueStatus === 'never_audited'))
        .slice(0, 5),
    [candidates],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      universeId: '',
      priority: 'medium',
      plannedStartDate: '',
      plannedEndDate: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    setPriorityTouched(Boolean(item));
    if (item) {
      reset({
        universeId: item.universeId,
        priority: (['low', 'medium', 'high', 'critical'].includes(item.priority)
          ? item.priority
          : 'medium') as FormValues['priority'],
        plannedStartDate: item.plannedStartDate ? item.plannedStartDate.slice(0, 10) : '',
        plannedEndDate: item.plannedEndDate ? item.plannedEndDate.slice(0, 10) : '',
        notes: item.notes ?? '',
      });
    } else {
      reset({
        universeId: '',
        priority: 'medium',
        plannedStartDate: '',
        plannedEndDate: '',
        notes: '',
      });
    }
  }, [open, item, reset]);

  const selectCandidate = (universeId: string) => {
    setValue('universeId', universeId, { shouldValidate: true, shouldDirty: true });
    if (!isEdit && !priorityTouched) {
      const candidate = candidateById.get(universeId);
      if (candidate?.recommendedPriority) {
        setValue('priority', candidate.recommendedPriority, { shouldValidate: true, shouldDirty: true });
      }
    }
  };

  const invalidateAfterMutation = () => {
    qc.invalidateQueries({ queryKey: ['plans', planId] });
    qc.invalidateQueries({ queryKey: ['plans'] });
    qc.invalidateQueries({ queryKey: ['plans', planId, 'universe-candidates'] });
  };

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      plansApi.addItem(planId, {
        universeId: v.universeId,
        priority: v.priority,
        plannedStartDate: toISODatetime(v.plannedStartDate),
        plannedEndDate: toISODatetime(v.plannedEndDate),
        notes: v.notes?.trim() ? v.notes.trim() : null,
      }),
    onSuccess: () => {
      toast.success('Item added to programme');
      invalidateAfterMutation();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add item'),
  });

  const update = useMutation({
    mutationFn: (v: FormValues) =>
      plansApi.updateItem(planId, item!.id, {
        universeId: v.universeId,
        priority: v.priority,
        plannedStartDate: toISODatetime(v.plannedStartDate),
        plannedEndDate: toISODatetime(v.plannedEndDate),
        notes: v.notes?.trim() ? v.notes.trim() : null,
      }),
    onSuccess: () => {
      toast.success('Plan item updated');
      invalidateAfterMutation();
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update item'),
  });

  const onSubmit = handleSubmit(
    (v) => {
      if (isEdit) update.mutate(v);
      else create.mutate(v);
    },
    (errs) => {
      const first = Object.values(errs).find((e) => e?.message)?.message;
      toast.error(typeof first === 'string' ? first : 'Please fix the highlighted fields');
    },
  );

  const selectedUniverseId = watch('universeId');
  const selectedCandidate = selectedUniverseId ? candidateById.get(selectedUniverseId) : undefined;
  const priorityReg = register('priority');

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title={isEdit ? 'Edit plan item' : 'Add plan item'}
      description="Each item maps to an active entity in the Audit Universe and schedules one engagement."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={create.isPending || update.isPending} size="sm">
            {isEdit ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {!isEdit && suggested.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              Recommended from Audit Universe — composite priority
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {suggested.map((c) => (
                <li key={c.universeId}>
                  <button
                    type="button"
                    onClick={() => selectCandidate(c.universeId)}
                    className="text-left text-xs text-amber-900 hover:underline"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-1.5 rounded bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-bold">
                      {c.score}
                    </span>
                  </button>
                  {c.reasons.length > 0 && (
                    <span className="ml-1.5 text-[11px] text-amber-800/80">
                      {c.reasons.join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <FormField
          label="Auditable entity"
          required
          error={errors.universeId?.message}
          hint="Only active Audit Universe entities appear here, ranked by composite audit priority."
        >
          <Combobox
            value={selectedUniverseId}
            onChange={selectCandidate}
            options={candidateOptions}
            disabled={candidatesQuery.isLoading}
            error={errors.universeId?.message}
            placeholder={candidatesQuery.isLoading ? 'Loading Audit Universe…' : 'Search and select entity…'}
            emptyText="No active entities match your search"
          />
        </FormField>

        {selectedCandidate &&
          (selectedCandidate.alreadyInThisPlanCount > 0 || selectedCandidate.alreadyInYearPlans.length > 0) && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {selectedCandidate.alreadyInThisPlanCount > 0 && (
                <p>
                  Already scheduled <strong>{selectedCandidate.alreadyInThisPlanCount}</strong> time(s) in this programme.
                </p>
              )}
              {selectedCandidate.alreadyInYearPlans.length > 0 && (
                <p className="mt-0.5">
                  Also covered in {planYear ?? 'this year'} by:{' '}
                  {selectedCandidate.alreadyInYearPlans.map((p) => p.planTitle).join(', ')}.
                </p>
              )}
            </div>
          )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Priority"
            required
            error={errors.priority?.message}
            hint={!isEdit ? 'Auto-suggested from entity risk score when selected.' : undefined}
          >
            <Select
              error={errors.priority?.message}
              value={watch('priority')}
              name={priorityReg.name}
              ref={priorityReg.ref}
              onBlur={priorityReg.onBlur}
              onChange={(e) => {
                setPriorityTouched(true);
                priorityReg.onChange(e);
              }}
            >
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
          <Textarea rows={3} placeholder="Scope focus, rationale, or scheduling notes…" {...register('notes')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
