'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Select, Textarea } from '@/components/ui/Input';
import { assetsApi } from '@/lib/api/assets';
import { ASSET_ATTESTATION_STATUSES } from '@/lib/utils/assets';

const Schema = z.object({
  status: z.string().min(1),
  notes: z.string().max(3000).optional(),
});

type FormValues = z.infer<typeof Schema>;

export const AssetAttestationSlideOver = ({
  open,
  assetId,
  onClose,
}: {
  open: boolean;
  assetId: string;
  onClose: () => void;
}): JSX.Element => {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { status: 'confirmed', notes: '' },
  });

  const attest = useMutation({
    mutationFn: (values: FormValues) =>
      assetsApi.attest(assetId, {
        status: values.status,
        notes: values.notes?.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Asset attested');
      qc.invalidateQueries({ queryKey: ['asset', assetId] });
      qc.invalidateQueries({ queryKey: ['asset', assetId, 'attestations'] });
      reset();
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to attest asset'),
  });

  const onSubmit = handleSubmit((values) => attest.mutate(values));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Attest asset"
      description="Confirm whether this asset record is accurate for audit reliance."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onSubmit} isLoading={attest.isPending}>Submit attestation</Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Attestation status" required error={errors.status?.message}>
          <Select error={errors.status?.message} {...register('status')}>
            {ASSET_ATTESTATION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </FormField>
        <FormField label="Notes" error={errors.notes?.message}>
          <Textarea rows={5} {...register('notes')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
