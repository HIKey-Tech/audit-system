'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { riskApi } from '@/lib/api/risk';
import { universeApi } from '@/lib/api/audit';
import { riskScoreLabel, riskScoreTone } from '@/lib/utils/status';
import type { Risk } from '@/lib/types/domain';

const Schema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().trim().min(1, 'Description required').max(5000),
  categoryId: z.string().min(1, 'Category required'),
  ownerId: z.string().min(1, 'Owner required'),
  likelihood: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  status: z.enum(['open', 'mitigated', 'accepted', 'closed']),
  universeId: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  risk?: Risk | null;
}

export const RiskFormSlideOver = ({ open, onClose, risk }: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(risk);

  const categories = useQuery({
    queryKey: ['risk', 'categories'],
    queryFn: () => riskApi.listCategories({ isActive: true }),
    enabled: open,
  });

  const universeEntities = useQuery({
    queryKey: ['universe', 'list-active-entities'],
    queryFn: () => universeApi.list({ pageSize: 100, status: 'active' }),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
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
      universeId: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (risk) {
        reset({
          title: risk.title,
          description: risk.description ?? '',
          categoryId: risk.categoryId,
          ownerId: risk.ownerId,
          likelihood: risk.currentLikelihood,
          impact: risk.currentImpact,
          status: risk.status as FormValues['status'],
          universeId: risk.universeId ?? '',
        });
      } else {
        reset({
          title: '',
          description: '',
          categoryId: '',
          ownerId: '',
          likelihood: 3,
          impact: 3,
          status: 'open',
          universeId: '',
        });
      }
    }
  }, [open, risk, reset]);

  const createMut = useMutation({
    mutationFn: (v: FormValues) =>
      riskApi.create({
        title: v.title,
        description: v.description,
        categoryId: v.categoryId,
        ownerId: v.ownerId,
        likelihood: v.likelihood,
        impact: v.impact,
        status: v.status,
        universeId: v.universeId || undefined,
      }),
    onSuccess: () => {
      toast.success('Risk added to register');
      qc.invalidateQueries({ queryKey: ['risk'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to add risk'),
  });

  const updateMut = useMutation({
    mutationFn: (v: FormValues) =>
      riskApi.update(risk!.id, {
        title: v.title,
        description: v.description,
        categoryId: v.categoryId,
        ownerId: v.ownerId,
        likelihood: v.likelihood,
        impact: v.impact,
        status: v.status,
        universeId: v.universeId || null,
      }),
    onSuccess: () => {
      toast.success('Risk updated successfully');
      qc.invalidateQueries({ queryKey: ['risk'] });
      qc.invalidateQueries({ queryKey: ['risk', risk!.id] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update risk'),
  });

  const onSubmit = handleSubmit((v) => {
    if (isEdit) {
      updateMut.mutate(v);
    } else {
      createMut.mutate(v);
    }
  }, toastOnInvalid);

  const activeCategories = categories.data ?? [];
  const categoryHelp = categories.isLoading
    ? 'Loading categories...'
    : categories.isError
      ? 'Could not load risk categories. Check that your role has risk category read access.'
      : activeCategories.length === 0
        ? 'No active risk categories exist yet. Create a category before registering a risk.'
        : undefined;
  const categoryDisabled = categories.isLoading || categories.isError || activeCategories.length === 0;

  const ownerId = watch('ownerId');
  const likelihood = Number(watch('likelihood') || 0);
  const impact = Number(watch('impact') || 0);
  const score = likelihood * impact;
  const t = score > 0 ? riskScoreTone(score) : null;

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title={isEdit ? 'Edit risk' : 'New risk'}
      description="Likelihood × impact define the score band."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            isLoading={isSubmitting || createMut.isPending || updateMut.isPending}
            disabled={categoryDisabled}
            size="sm"
          >
            {isEdit ? 'Save changes' : 'Add to register'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Title" required error={errors.title?.message}>
          <Input error={errors.title?.message} {...register('title')} />
        </FormField>
        <FormField label="Description" required error={errors.description?.message}>
          <Textarea rows={3} {...register('description')} />
        </FormField>
        
        <FormField label="Linked Universe Entity" error={errors.universeId?.message}>
          <Select
            error={errors.universeId?.message}
            disabled={universeEntities.isLoading}
            {...register('universeId')}
          >
            <option value="">None (Generic / Unlinked)</option>
            {universeEntities.data?.items?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.category})
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Category" required error={errors.categoryId?.message}>
            <Select error={errors.categoryId?.message} disabled={categoryDisabled} {...register('categoryId')}>
              <option value="">{categories.isLoading ? 'Loading categories...' : 'Select...'}</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {categoryHelp && (
              <p className={categories.isError || activeCategories.length === 0 ? 'mt-1 text-xs text-danger' : 'mt-1 text-xs text-text-muted'}>
                {categoryHelp}
              </p>
            )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
