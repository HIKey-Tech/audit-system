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
import { AUDIT_DOMAINS } from '@/lib/audit-domains';

const Schema = z.object({
  title: z.string().min(2).max(200),
  year: z.coerce.number().int().min(2000).max(2100),
  auditType: z.enum(['it', 'financial', 'compliance']),
  description: z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export const PlanFormSlideOver = ({ open, onClose }: Props): JSX.Element => {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { title: '', year: new Date().getFullYear(), auditType: 'it', description: '' },
  });

  useEffect(() => {
    if (open) reset({ title: '', year: new Date().getFullYear(), auditType: 'it', description: '' });
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      plansApi.create({
        title: v.title,
        year: v.year,
        auditType: v.auditType,
        description: v.description || undefined,
      }),
    onSuccess: (plan) => {
      toast.success('Programme created');
      // Surfaced, not blocked: a second programme of the same type and year is
      // legitimate, but the creator should know they are making one.
      for (const warning of plan.warnings ?? []) {
        toast.warning(warning);
      }
      qc.invalidateQueries({ queryKey: ['plans'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create programme'),
  });

  const onSubmit = handleSubmit((v) => create.mutate(v), toastOnInvalid);

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title="New Audit Programme"
      description="A programme covers one audit type for a year. Every plan you add under it inherits that type."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={create.isPending} size="sm">
            Create programme
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
          <Select error={errors.auditType?.message} {...register('auditType')}>
            {AUDIT_DOMAINS.map((d) => (
              <option key={d.key} value={d.key}>
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
