'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { assetsApi } from '@/lib/api/assets';
import { ASSET_SOURCE_SYSTEMS, ASSET_SYNC_STATUSES } from '@/lib/utils/assets';

const Schema = z.object({
  sourceSystem: z.string().min(1),
  sourceId: z.string().min(1, 'Source ID required').max(255),
  syncStatus: z.string().min(1),
  lastSyncedAt: z.string().optional(),
  rawPayload: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

const toIsoOrNull = (value?: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const parseJsonOrNull = (value?: string): Record<string, unknown> | null => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  return JSON.parse(trimmed) as Record<string, unknown>;
};

export const AssetSourceSlideOver = ({
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
    defaultValues: { sourceSystem: 'manual', sourceId: '', syncStatus: 'synced', lastSyncedAt: '', rawPayload: '' },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      let rawPayload: Record<string, unknown> | null = null;
      try {
        rawPayload = parseJsonOrNull(values.rawPayload);
      } catch {
        throw new Error('Raw payload must be valid JSON');
      }

      return assetsApi.createSource(assetId, {
        sourceSystem: values.sourceSystem,
        sourceId: values.sourceId,
        syncStatus: values.syncStatus,
        lastSyncedAt: toIsoOrNull(values.lastSyncedAt),
        rawPayload,
      });
    },
    onSuccess: () => {
      toast.success('Asset source saved');
      qc.invalidateQueries({ queryKey: ['asset', assetId, 'sources'] });
      reset();
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save source'),
  });

  const onSubmit = handleSubmit((values) => save.mutate(values), toastOnInvalid);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add source record"
      description="Record provenance from manual entry or approved read-only systems."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onSubmit} isLoading={save.isPending}>Save source</Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Source system" required error={errors.sourceSystem?.message}>
            <Select error={errors.sourceSystem?.message} {...register('sourceSystem')}>
              {ASSET_SOURCE_SYSTEMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
          <FormField label="Sync status" required error={errors.syncStatus?.message}>
            <Select error={errors.syncStatus?.message} {...register('syncStatus')}>
              {ASSET_SYNC_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="Source ID" required error={errors.sourceId?.message}>
          <Input error={errors.sourceId?.message} {...register('sourceId')} />
        </FormField>
        <FormField label="Last synced" error={errors.lastSyncedAt?.message}>
          <Input type="datetime-local" error={errors.lastSyncedAt?.message} {...register('lastSyncedAt')} />
        </FormField>
        <FormField label="Raw payload JSON" error={errors.rawPayload?.message}>
          <Textarea rows={7} spellCheck={false} className="font-mono text-xs" {...register('rawPayload')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
