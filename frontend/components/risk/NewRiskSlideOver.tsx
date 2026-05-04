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
import { UserSelect } from '@/components/common/UserSelect';
import { riskApi } from '@/lib/api/risk';
import { riskScoreLabel, riskScoreTone } from '@/lib/utils/status';

const Schema = z.object({
  title: z.string().min(2).max(300),
  description: z.string().max(2000).optional().or(z.literal('')),
  categoryId: z.string().min(1, 'Category required'),
  ownerId: z.string().min(1, 'Owner required'),
  likelihood: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  status: z.enum(['open', 'mitigated', 'accepted', 'closed']),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export const NewRiskSlideOver = ({ open, onClose }: Props): JSX.Element => {
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: ['risk', 'categories'],
    queryFn: () => riskApi.listCategories(),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      title: '',
      description: '',
      categoryId: '',
      ownerId: '',
      likelihood: 3,
      impact: 3,
      status: 'open',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        title: '',
        description: '',
        categoryId: '',
        ownerId: '',
        likelihood: 3,
        impact: 3,
        status: 'open',
      });
    }
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      riskApi.create({
        title: v.title,
        description: v.description || undefined,
        categoryId: v.categoryId,
        ownerId: v.ownerId,
        likelihood: v.likelihood,
        impact: v.impact,
        status: v.status,
      }),
    onSuccess: () => {
      toast.success('Risk added to register');
      qc.invalidateQueries({ queryKey: ['risk'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const onSubmit = handleSubmit((v) => create.mutate(v));

  const ownerId = watch('ownerId');
  const likelihood = Number(watch('likelihood') || 0);
  const impact = Number(watch('impact') || 0);
  const score = likelihood * impact;
  const t = score > 0 ? riskScoreTone(score) : null;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="New risk"
      description="Likelihood × impact define the score band."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={create.isPending} size="sm">
            Add to register
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Title" required error={errors.title?.message}>
          <Input error={errors.title?.message} {...register('title')} />
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={3} {...register('description')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category" required error={errors.categoryId?.message}>
            <Select error={errors.categoryId?.message} {...register('categoryId')}>
              <option value="">Select…</option>
              {categories.data?.filter((c) => c.isActive).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" required error={errors.status?.message}>
            <Select error={errors.status?.message} {...register('status')}>
              <option value="open">Open</option>
              <option value="mitigated">Mitigated</option>
              <option value="accepted">Accepted</option>
              <option value="closed">Closed</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Owner" required error={errors.ownerId?.message}>
          <UserSelect value={ownerId} onChange={(v) => setValue('ownerId', v, { shouldValidate: true })} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Likelihood" required error={errors.likelihood?.message}>
            <Select error={errors.likelihood?.message} {...register('likelihood')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} — {['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'][n - 1]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Impact" required error={errors.impact?.message}>
            <Select error={errors.impact?.message} {...register('impact')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} — {['Minor', 'Low', 'Moderate', 'Major', 'Severe'][n - 1]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        {t && (
          <div className="rounded-md border border-border bg-surface-alt p-3 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Calculated score</p>
            <p className="mt-1 inline-flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}>
                {score}
              </span>
              <span className="font-medium">{riskScoreLabel(score)}</span>
            </p>
          </div>
        )}
      </form>
    </SlideOver>
  );
};
