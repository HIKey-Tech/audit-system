'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Textarea } from '@/components/ui/Input';
import { plansApi } from '@/lib/api/audit';

const Schema = z.object({
  title: z.string().min(2).max(200),
  year: z.coerce.number().int().min(2000).max(2100),
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
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { title: '', year: new Date().getFullYear(), description: '' },
  });

  useEffect(() => {
    if (open) reset({ title: '', year: new Date().getFullYear(), description: '' });
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      plansApi.create({ title: v.title, year: v.year, description: v.description || undefined }),
    onSuccess: () => {
      toast.success('Plan created');
      qc.invalidateQueries({ queryKey: ['plans'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create plan'),
  });

  const onSubmit = handleSubmit((v) => create.mutate(v));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="New Audit Plan"
      description="Annual plan headers organise the engagements scheduled for a fiscal year."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={create.isPending} size="sm">
            Create plan
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Title" required error={errors.title?.message}>
          <Input placeholder="e.g. FY 2026 Annual Audit Plan" error={errors.title?.message} {...register('title')} />
        </FormField>
        <FormField label="Year" required error={errors.year?.message}>
          <Input type="number" min={2000} max={2100} error={errors.year?.message} {...register('year')} />
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={4} placeholder="Optional plan summary" {...register('description')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
