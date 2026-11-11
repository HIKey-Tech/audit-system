'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { plansApi } from '@/lib/api/audit';
import { SELECTABLE_AUDIT_TYPES } from '@/lib/audit-domains';
import type { AuditPlan } from '@/lib/types/domain';

const VALID_AUDIT_TYPES = [
  'it',
  'systems',
  'financial',
  'compliance',
  'operational',
  'pension',
  'procurement',
  'hr_payroll',
  'project',
  'special',
] as const;

const Schema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  year: z.coerce.number().int().min(2000).max(2100),
  auditType: z.enum(VALID_AUDIT_TYPES),
  description: z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  plan?: AuditPlan | null;
}

export const PlanFormSlideOver = ({ open, onClose, plan }: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(plan);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { title: '', year: new Date().getFullYear(), auditType: 'it', description: '' },
  });

  useEffect(() => {
    if (open && plan) {
      const initialType = (VALID_AUDIT_TYPES as readonly string[]).includes(plan.auditType)
        ? (plan.auditType as FormValues['auditType'])
        : 'it';
      reset({
        title: plan.title,
        year: plan.year,
        auditType: initialType,
        description: plan.description ?? '',
      });
    } else if (open) {
      reset({ title: '', year: new Date().getFullYear(), auditType: 'it', description: '' });
    }
  }, [open, plan, reset]);

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      plansApi.create({
        title: v.title.trim(),
        year: v.year,
        auditType: v.auditType,
        description: v.description?.trim() || undefined,
      }),
    onSuccess: (created) => {
      toast.success('Programme created');
      // Surfaced, not blocked: a second programme of the same type and year is
      // legitimate, but the creator should know they are making one.
      for (const warning of created.warnings ?? []) {
        toast.warning(warning);
      }
      qc.invalidateQueries({ queryKey: ['plans'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create programme'),
  });

  const update = useMutation({
    mutationFn: (v: FormValues) =>
      plansApi.update(plan!.id, {
        title: v.title.trim(),
        year: v.year,
        description: v.description?.trim() ? v.description.trim() : null,
      }),
    onSuccess: () => {
      toast.success('Programme updated');
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['plans', plan!.id] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update programme'),
  });

  const onSubmit = handleSubmit(
    (v) => {
      if (isEdit) update.mutate(v);
      else create.mutate(v);
    },
    toastOnInvalid,
  );

  const auditType = watch('auditType');

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title={isEdit ? 'Edit Audit Programme' : 'New Audit Programme'}
      description="A programme covers one audit type for a year. Every plan you add under it inherits that type."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={create.isPending || update.isPending} size="sm">
            {isEdit ? 'Save changes' : 'Create programme'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Title" required error={errors.title?.message}>
          <Input placeholder="e.g. FY 2026 Annual Audit Programme" error={errors.title?.message} {...register('title')} />
        </FormField>
        <FormField label="Year" required error={errors.year?.message}>
          <Input type="number" min={2000} max={2100} error={errors.year?.message} {...register('year')} />
        </FormField>
        <FormField
          label="Audit type"
          required
          error={errors.auditType?.message}
          tooltip="Fixed for the life of the programme — every plan under it is of this type."
        >
          <Select error={errors.auditType?.message} value={auditType} disabled={isEdit} {...register('auditType')}>
            {SELECTABLE_AUDIT_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={4} placeholder="Optional programme summary" {...register('description')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
