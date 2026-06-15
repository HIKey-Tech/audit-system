'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { assetsApi } from '@/lib/api/assets';
import { ASSET_RELATIONSHIP_TYPES } from '@/lib/utils/assets';

const Schema = z.object({
  targetAssetId: z.string().min(1, 'Target asset required'),
  relationshipType: z.string().min(1),
  description: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof Schema>;

export const AssetRelationshipSlideOver = ({
  open,
  assetId,
  onClose,
}: {
  open: boolean;
  assetId: string;
  onClose: () => void;
}): JSX.Element => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const targets = useQuery({
    queryKey: ['assets', 'relationship-targets', search],
    queryFn: () => assetsApi.list({ pageSize: 50, search: search || undefined }),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { targetAssetId: '', relationshipType: 'depends_on', description: '' },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      assetsApi.createRelationship(assetId, {
        targetAssetId: values.targetAssetId,
        relationshipType: values.relationshipType,
        description: values.description?.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Asset relationship added');
      qc.invalidateQueries({ queryKey: ['asset', assetId, 'relationships'] });
      reset();
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add relationship'),
  });

  const onSubmit = handleSubmit((values) => create.mutate(values));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add relationship"
      description="Record dependency, hosting, integration, or support relationships."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onSubmit} isLoading={create.isPending}>Add relationship</Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Find target asset">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets…" />
        </FormField>
        <FormField label="Target asset" required error={errors.targetAssetId?.message}>
          <Select error={errors.targetAssetId?.message} {...register('targetAssetId')}>
            <option value="">Select asset…</option>
            {targets.data?.items
              .filter((asset) => asset.id !== assetId)
              .map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetTag} — {asset.name}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="Relationship" required error={errors.relationshipType?.message}>
          <Select error={errors.relationshipType?.message} {...register('relationshipType')}>
            {ASSET_RELATIONSHIP_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={4} {...register('description')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
