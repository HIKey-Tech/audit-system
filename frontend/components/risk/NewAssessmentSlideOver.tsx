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
import { Select, Textarea } from '@/components/ui/Input';
import { riskApi } from '@/lib/api/risk';
import { riskScoreLabel, riskScoreTone } from '@/lib/utils/status';

const Schema = z.object({
  likelihood: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  riskId: string;
}

export const NewAssessmentSlideOver = ({ open, onClose, riskId }: Props): JSX.Element => {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { likelihood: 3, impact: 3, notes: '' },
  });

  useEffect(() => {
    if (open) reset({ likelihood: 3, impact: 3, notes: '' });
  }, [open, reset]);

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      riskApi.createAssessment(riskId, {
        likelihood: v.likelihood,
        impact: v.impact,
        notes: v.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Assessment recorded');
      qc.invalidateQueries({ queryKey: ['risk', riskId] });
      qc.invalidateQueries({ queryKey: ['risk', riskId, 'assessments'] });
      qc.invalidateQueries({ queryKey: ['risk', 'register'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const onSubmit = handleSubmit((v) => create.mutate(v), toastOnInvalid);

  const likelihood = Number(watch('likelihood') || 0);
  const impact = Number(watch('impact') || 0);
  const score = likelihood * impact;
  const t = score > 0 ? riskScoreTone(score) : null;

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title="New assessment"
      description="Assessment snapshots are immutable."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} isLoading={create.isPending}>
            Record assessment
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Likelihood" required error={errors.likelihood?.message}>
            <Select error={errors.likelihood?.message} {...register('likelihood')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Impact" required error={errors.impact?.message}>
            <Select error={errors.impact?.message} {...register('impact')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        {t && (
          <div className="rounded-md border border-border bg-surface-alt p-3 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">New score</p>
            <p className="mt-1 inline-flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold ring-1 ${t.bg} ${t.text} ${t.ring}`}>
                {score}
              </span>
              <span className="font-medium">{riskScoreLabel(score)}</span>
            </p>
          </div>
        )}
        <FormField label="Notes" error={errors.notes?.message}>
          <Textarea rows={4} {...register('notes')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
