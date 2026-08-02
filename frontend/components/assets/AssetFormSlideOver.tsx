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
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { assetsApi, type AssetPayload } from '@/lib/api/assets';
import type { Asset } from '@/lib/types/domain';
import {
  ASSET_LIFECYCLES,
  ASSET_RATINGS,
  ASSET_SOURCE_SYSTEMS,
  ASSET_STATUSES,
  ASSET_TYPES,
  DATA_CLASSIFICATIONS,
} from '@/lib/utils/assets';

const Schema = z.object({
  assetTag: z.string().min(1, 'Asset tag required').max(100),
  name: z.string().min(1, 'Name required').max(200),
  description: z.string().max(5000).optional(),
  assetType: z.string().min(1, 'Asset type required'),
  category: z.string().max(100).optional(),
  status: z.string().min(1),
  lifecycleState: z.string().min(1),
  criticality: z.string().min(1),
  dataClassification: z.string().min(1),
  confidentialityRating: z.string().min(1),
  integrityRating: z.string().min(1),
  availabilityRating: z.string().min(1),
  ownerId: z.string().min(1, 'Owner required'),
  custodianId: z.string().optional(),
  department: z.string().max(150).optional(),
  location: z.string().max(200).optional(),
  environment: z.string().max(100).optional(),
  hostname: z.string().max(255).optional(),
  ipAddress: z.string().max(100).optional(),
  serialNumber: z.string().max(150).optional(),
  manufacturer: z.string().max(150).optional(),
  model: z.string().max(150).optional(),
  osName: z.string().max(150).optional(),
  osVersion: z.string().max(150).optional(),
  supplier: z.string().max(150).optional(),
  sourceSystem: z.string().min(1),
  sourceId: z.string().max(255).optional(),
  lastSeenAt: z.string().optional(),
  metadata: z.string().optional(),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  asset?: Asset | null;
  canAdmin: boolean;
  onClose: () => void;
}

const emptyToNull = (value?: string): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
};

const toLocalDateTime = (value: string | null | undefined): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

const toIsoOrNull = (value?: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const parseMetadata = (value?: string): Record<string, unknown> | null => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  return JSON.parse(trimmed) as Record<string, unknown>;
};

const defaultsFor = (asset?: Asset | null): FormValues => ({
  assetTag: asset?.assetTag ?? '',
  name: asset?.name ?? '',
  description: asset?.description ?? '',
  assetType: asset?.assetType ?? 'server',
  category: asset?.category ?? '',
  status: asset?.status ?? 'active',
  lifecycleState: asset?.lifecycleState ?? 'active',
  criticality: asset?.criticality ?? 'medium',
  dataClassification: asset?.dataClassification ?? 'internal',
  confidentialityRating: asset?.confidentialityRating ?? 'medium',
  integrityRating: asset?.integrityRating ?? 'medium',
  availabilityRating: asset?.availabilityRating ?? 'medium',
  ownerId: asset?.ownerId ?? '',
  custodianId: asset?.custodianId ?? '',
  department: asset?.department ?? '',
  location: asset?.location ?? '',
  environment: asset?.environment ?? '',
  hostname: asset?.hostname ?? '',
  ipAddress: asset?.ipAddress ?? '',
  serialNumber: asset?.serialNumber ?? '',
  manufacturer: asset?.manufacturer ?? '',
  model: asset?.model ?? '',
  osName: asset?.osName ?? '',
  osVersion: asset?.osVersion ?? '',
  supplier: asset?.supplier ?? '',
  sourceSystem: asset?.sourceSystem ?? 'manual',
  sourceId: asset?.sourceId ?? '',
  lastSeenAt: toLocalDateTime(asset?.lastSeenAt),
  metadata: asset?.metadata ? JSON.stringify(asset.metadata, null, 2) : '',
});

const buildPayload = (v: FormValues, canAdmin: boolean): AssetPayload => {
  let metadata: Record<string, unknown> | null = null;
  try {
    metadata = parseMetadata(v.metadata);
  } catch {
    throw new Error('Metadata must be valid JSON');
  }

  const base: AssetPayload = {
    assetTag: v.assetTag.trim(),
    name: v.name.trim(),
    description: emptyToNull(v.description),
    assetType: v.assetType,
    category: emptyToNull(v.category),
    status: v.status,
    ownerId: v.ownerId,
    custodianId: emptyToNull(v.custodianId),
    department: emptyToNull(v.department),
    location: emptyToNull(v.location),
    environment: emptyToNull(v.environment),
    hostname: emptyToNull(v.hostname),
    ipAddress: emptyToNull(v.ipAddress),
    serialNumber: emptyToNull(v.serialNumber),
    manufacturer: emptyToNull(v.manufacturer),
    model: emptyToNull(v.model),
    osName: emptyToNull(v.osName),
    osVersion: emptyToNull(v.osVersion),
    supplier: emptyToNull(v.supplier),
    lastSeenAt: toIsoOrNull(v.lastSeenAt),
    metadata,
  };

  if (canAdmin) {
    base.lifecycleState = v.lifecycleState;
    base.criticality = v.criticality;
    base.dataClassification = v.dataClassification;
    base.confidentialityRating = v.confidentialityRating;
    base.integrityRating = v.integrityRating;
    base.availabilityRating = v.availabilityRating;
    base.sourceSystem = v.sourceSystem;
    base.sourceId = emptyToNull(v.sourceId);
  }

  return base;
};

export const AssetFormSlideOver = ({ open, asset, canAdmin, onClose }: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(asset);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: defaultsFor(asset),
  });

  useEffect(() => {
    if (open) reset(defaultsFor(asset));
  }, [asset, open, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = buildPayload(values, canAdmin);
      return asset ? assetsApi.update(asset.id, payload) : assetsApi.create(payload);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Asset updated' : 'Asset created');
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['asset', saved.id] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save asset'),
  });

  const onSubmit = handleSubmit((values) => save.mutate(values), toastOnInvalid);

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title={isEdit ? 'Edit asset' : 'New asset'}
      description="Register ownership, classification, lifecycle, and source context."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} isLoading={save.isPending}>
            {isEdit ? 'Save changes' : 'Create asset'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Identity</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Asset tag" required error={errors.assetTag?.message}>
              <Input error={errors.assetTag?.message} {...register('assetTag')} />
            </FormField>
            <FormField label="Name" required error={errors.name?.message}>
              <Input error={errors.name?.message} {...register('name')} />
            </FormField>
          </div>
          <FormField label="Description" error={errors.description?.message}>
            <Textarea rows={3} {...register('description')} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Type" required error={errors.assetType?.message}>
              <Select error={errors.assetType?.message} {...register('assetType')}>
                {ASSET_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </FormField>
            <FormField label="Category" error={errors.category?.message}>
              <Input error={errors.category?.message} {...register('category')} />
            </FormField>
            <FormField label="Status" required error={errors.status?.message}>
              <Select error={errors.status?.message} {...register('status')}>
                {ASSET_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </FormField>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Accountability</p>
          <FormField label="Owner" required error={errors.ownerId?.message}>
            <UserSelect value={watch('ownerId')} onChange={(value) => setValue('ownerId', value, { shouldValidate: true })} />
          </FormField>
          <FormField label="Custodian" error={errors.custodianId?.message}>
            <UserSelect value={watch('custodianId') ?? ''} onChange={(value) => setValue('custodianId', value, { shouldValidate: true })} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="Department" error={errors.department?.message}>
              <Input error={errors.department?.message} {...register('department')} />
            </FormField>
            <FormField label="Location" error={errors.location?.message}>
              <Input error={errors.location?.message} {...register('location')} />
            </FormField>
            <FormField label="Environment" error={errors.environment?.message}>
              <Input error={errors.environment?.message} {...register('environment')} />
            </FormField>
          </div>
        </section>

        {canAdmin && (
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Classification</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Lifecycle" required error={errors.lifecycleState?.message}>
                <Select error={errors.lifecycleState?.message} {...register('lifecycleState')}>
                  {ASSET_LIFECYCLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </FormField>
              <FormField label="Data classification" required error={errors.dataClassification?.message}>
                <Select error={errors.dataClassification?.message} {...register('dataClassification')}>
                  {DATA_CLASSIFICATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              {[
                ['criticality', 'Criticality'],
                ['confidentialityRating', 'Confidentiality'],
                ['integrityRating', 'Integrity'],
                ['availabilityRating', 'Availability'],
              ].map(([field, label]) => (
                <FormField key={field} label={label}>
                  <Select {...register(field as keyof FormValues)}>
                    {ASSET_RATINGS.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                  </Select>
                </FormField>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Technical details</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Hostname" error={errors.hostname?.message}>
              <Input error={errors.hostname?.message} {...register('hostname')} />
            </FormField>
            <FormField label="IP address" error={errors.ipAddress?.message}>
              <Input error={errors.ipAddress?.message} {...register('ipAddress')} />
            </FormField>
            <FormField label="Serial number" error={errors.serialNumber?.message}>
              <Input error={errors.serialNumber?.message} {...register('serialNumber')} />
            </FormField>
            <FormField label="Supplier" error={errors.supplier?.message}>
              <Input error={errors.supplier?.message} {...register('supplier')} />
            </FormField>
            <FormField label="Manufacturer" error={errors.manufacturer?.message}>
              <Input error={errors.manufacturer?.message} {...register('manufacturer')} />
            </FormField>
            <FormField label="Model" error={errors.model?.message}>
              <Input error={errors.model?.message} {...register('model')} />
            </FormField>
            <FormField label="OS name" error={errors.osName?.message}>
              <Input error={errors.osName?.message} {...register('osName')} />
            </FormField>
            <FormField label="OS version" error={errors.osVersion?.message}>
              <Input error={errors.osVersion?.message} {...register('osVersion')} />
            </FormField>
          </div>
        </section>

        {canAdmin && (
          <section className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Source and freshness</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Source system" required error={errors.sourceSystem?.message}>
                <Select error={errors.sourceSystem?.message} {...register('sourceSystem')}>
                  {ASSET_SOURCE_SYSTEMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </FormField>
              <FormField label="Source ID" error={errors.sourceId?.message}>
                <Input error={errors.sourceId?.message} {...register('sourceId')} />
              </FormField>
              <FormField label="Last seen" error={errors.lastSeenAt?.message}>
                <Input type="datetime-local" error={errors.lastSeenAt?.message} {...register('lastSeenAt')} />
              </FormField>
            </div>
          </section>
        )}

        <FormField label="Metadata JSON" error={errors.metadata?.message}>
          <Textarea rows={5} spellCheck={false} className="font-mono text-xs" {...register('metadata')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
