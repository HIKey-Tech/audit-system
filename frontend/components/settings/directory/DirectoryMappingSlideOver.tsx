'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select } from '@/components/ui/Input';
import { rolesApi } from '@/lib/api/settings';
import { directoryApi, type DirectoryMappingDto } from '@/lib/api/directory';

const Schema = z.object({
  adGroupId: z.string().uuid('Enter the Azure group Object ID (a GUID)'),
  adGroupName: z.string().min(1, 'Group name is required').max(256),
  roleId: z.string().uuid('Select a role'),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  mapping?: DirectoryMappingDto | null;
}

export const DirectoryMappingSlideOver = ({ open, onClose, mapping }: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(mapping);

  const rolesQuery = useQuery({
    queryKey: ['settings', 'roles'],
    queryFn: rolesApi.list,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { adGroupId: '', adGroupName: '', roleId: '', isActive: true },
  });

  useEffect(() => {
    if (open && mapping) {
      reset({
        adGroupId: mapping.adGroupId,
        adGroupName: mapping.adGroupName,
        roleId: mapping.roleId,
        isActive: mapping.isActive,
      });
    } else if (open && !mapping) {
      reset({ adGroupId: '', adGroupName: '', roleId: '', isActive: true });
    }
  }, [open, mapping, reset]);

  const createMut = useMutation({
    mutationFn: (values: FormValues) =>
      directoryApi.create({
        adGroupId: values.adGroupId,
        adGroupName: values.adGroupName,
        roleId: values.roleId,
      }),
    onSuccess: () => {
      toast.success('Mapping created');
      qc.invalidateQueries({ queryKey: ['settings', 'directory-mappings'] });
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to create mapping'),
  });

  const updateMut = useMutation({
    mutationFn: (values: FormValues) =>
      directoryApi.update(mapping!.id, {
        adGroupName: values.adGroupName,
        roleId: values.roleId,
        isActive: values.isActive,
      }),
    onSuccess: () => {
      toast.success('Mapping updated');
      qc.invalidateQueries({ queryKey: ['settings', 'directory-mappings'] });
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to update mapping'),
  });

  const onSubmit = handleSubmit((values) => {
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  }, toastOnInvalid);

  const isPending = isSubmitting || createMut.isPending || updateMut.isPending;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit group mapping' : 'New group mapping'}
      description="Map an Azure AD security group to an IAMS role. Members of the group receive the role automatically on sign-in."
      width="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} isLoading={isPending}>
            {isEdit ? 'Save changes' : 'Create mapping'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormField
          label="Azure group Object ID"
          required
          error={errors.adGroupId?.message}
          hint="The group's Object ID (GUID) from Entra ID — not the display name."
        >
          <Input
            placeholder="e.g. 7b9f1c20-4d3a-4e8b-9c1a-2f5e6d7a8b90"
            error={errors.adGroupId?.message}
            disabled={isEdit}
            {...register('adGroupId')}
          />
        </FormField>

        <FormField
          label="Group display name"
          required
          error={errors.adGroupName?.message}
          hint="Shown in the mappings table for readability."
        >
          <Input
            placeholder="e.g. GBB-Audit-Team"
            error={errors.adGroupName?.message}
            {...register('adGroupName')}
          />
        </FormField>

        <FormField label="IAMS role" required error={errors.roleId?.message}>
          <Select error={errors.roleId?.message} {...register('roleId')}>
            <option value="">Select a role…</option>
            {(rolesQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormField>

        {isEdit && (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
              {...register('isActive')}
            />
            <span className="text-sm text-text-primary">Active</span>
          </label>
        )}
      </form>
    </SlideOver>
  );
};
