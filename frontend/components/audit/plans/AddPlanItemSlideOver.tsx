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

function toISODatetime(dateStr: string): string {
  return dateStr ? `${dateStr}T00:00:00.000Z` : dateStr;
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

  const {
    register,
    handleSubmit,
    reset,
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
        <FormField label="Auditable entity" required error={errors.universeId?.message}>
          <Select error={errors.universeId?.message} {...register('universeId')}>
            <option value="">Select entity…</option>
            {universe.data?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
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
