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
import { Input, Textarea } from '@/components/ui/Input';
import { rolesApi } from '@/lib/api/settings';

const Schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CreateRoleSlideOver = ({ open, onClose }: Props): JSX.Element => {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (open) reset({ name: '', description: '' });
  }, [open, reset]);

  const createMut = useMutation({
    mutationFn: (values: FormValues) =>
      rolesApi.create({
        name: values.name,
        description: values.description || undefined,
      }),
    onSuccess: () => {
      toast.success('Role created');
      qc.invalidateQueries({ queryKey: ['settings', 'roles'] });
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to create role'),
  });

  const onSubmit = handleSubmit((values) => createMut.mutate(values), toastOnInvalid);

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Create role"
      description="Define a new role and assign permissions to it after creation."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSubmit}
            isLoading={isSubmitting || createMut.isPending}
          >
            Create role
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Name" required error={errors.name?.message}>
          <Input
            placeholder="e.g. Senior Auditor"
            error={errors.name?.message}
            {...register('name')}
          />
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          <Textarea
            rows={3}
            placeholder="Brief description of this role's purpose"
            {...register('description')}
          />
        </FormField>
      </form>
    </SlideOver>
  );
};
