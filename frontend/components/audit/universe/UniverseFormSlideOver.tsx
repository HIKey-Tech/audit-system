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
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { universeApi } from '@/lib/api/audit';
import type { AuditUniverseEntity } from '@/lib/types/domain';

const Schema = z.object({
  name: z.string().min(2, 'Name is required').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  category: z.enum(['department', 'system', 'process', 'asset', 'project']),
  ownerId: z.string().min(1, 'Owner is required'),
  auditFrequency: z.enum(['monthly', 'quarterly', 'biannual', 'annual']),
  status: z.enum(['active', 'inactive']),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  entity?: AuditUniverseEntity | null;
}

export const UniverseFormSlideOver = ({ open, onClose, entity }: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(entity);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: '',
      description: '',
      category: 'department',
      ownerId: '',
      auditFrequency: 'annual',
      status: 'active',
    },
  });

  useEffect(() => {
    if (open && entity) {
      reset({
        name: entity.name,
        description: entity.description ?? '',
        category: entity.category as FormValues['category'],
        ownerId: entity.ownerId,
        auditFrequency: entity.auditFrequency as FormValues['auditFrequency'],
        status: entity.status as FormValues['status'],
      });
    } else if (open && !entity) {
      reset({
        name: '',
        description: '',
        category: 'department',
        ownerId: '',
        auditFrequency: 'annual',
        status: 'active',
      });
    }
  }, [open, entity, reset]);

  const createMut = useMutation({
    mutationFn: (values: FormValues) =>
      universeApi.create({
        name: values.name,
        description: values.description || undefined,
        category: values.category,
        ownerId: values.ownerId,
        auditFrequency: values.auditFrequency,
      }),
    onSuccess: () => {
      toast.success('Auditable entity created');
      qc.invalidateQueries({ queryKey: ['universe'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create entity'),
  });

  const updateMut = useMutation({
    mutationFn: (values: FormValues) =>
      universeApi.update(entity!.id, {
        name: values.name,
        description: values.description || undefined,
        category: values.category,
        ownerId: values.ownerId,
        auditFrequency: values.auditFrequency,
        status: values.status,
      }),
    onSuccess: () => {
      toast.success('Entity updated');
      qc.invalidateQueries({ queryKey: ['universe'] });
      qc.invalidateQueries({ queryKey: ['universe', entity!.id] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update entity'),
  });

  const onSubmit = handleSubmit((values) => {
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  });

  const ownerId = watch('ownerId');

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit auditable entity' : 'New auditable entity'}
      description="Auditable entities form the universe scoped under the GBB audit plan."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            isLoading={isSubmitting || createMut.isPending || updateMut.isPending}
            size="sm"
          >
            {isEdit ? 'Save changes' : 'Create entity'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Name" required error={errors.name?.message}>
          <Input placeholder="e.g. Treasury Department" error={errors.name?.message} {...register('name')} />
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={3} placeholder="Short description of the entity" {...register('description')} />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category" required error={errors.category?.message}>
            <Select error={errors.category?.message} {...register('category')}>
              <option value="department">Department</option>
              <option value="system">System</option>
              <option value="process">Process</option>
              <option value="asset">Asset</option>
              <option value="project">Project</option>
            </Select>
          </FormField>
          <FormField label="Status" required error={errors.status?.message}>
            <Select error={errors.status?.message} {...register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        </div>

        <FormField label="Owner" required error={errors.ownerId?.message}>
          <UserSelect
            value={ownerId}
            onChange={(v) => setValue('ownerId', v, { shouldValidate: true })}
            error={errors.ownerId?.message}
            placeholder="Select owner"
          />
        </FormField>

        <FormField label="Audit Frequency" required error={errors.auditFrequency?.message}>
          <Select error={errors.auditFrequency?.message} {...register('auditFrequency')}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="biannual">Bi-annual</option>
            <option value="annual">Annual</option>
          </Select>
        </FormField>
      </form>
    </SlideOver>
  );
};
