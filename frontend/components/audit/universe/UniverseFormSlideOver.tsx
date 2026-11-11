'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { UserSelect } from '@/components/common/UserSelect';
import { universeApi } from '@/lib/api/audit';
import { usersApi } from '@/lib/api/users';
import type { AuditUniverseEntity } from '@/lib/types/domain';

const VALID_CATEGORIES = ['department', 'system', 'process', 'asset', 'project'] as const;
const VALID_FREQUENCIES = ['monthly', 'quarterly', 'biannual', 'annual', 'on_demand'] as const;

const Schema = z.object({
  name: z.string().min(2, 'Name is required').max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  category: z.enum(VALID_CATEGORIES),
  ownerIds: z.array(z.string().min(1)).min(1, 'At least one owner is required').max(25),
  auditFrequency: z.enum(VALID_FREQUENCIES),
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

  const usersList = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: () => usersApi.directory(),
    enabled: open,
    staleTime: 5 * 60_000,
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
      name: '',
      description: '',
      category: 'department',
      ownerIds: [],
      auditFrequency: 'annual',
      status: 'active',
    },
  });

  useEffect(() => {
    if (open && entity) {
      const initialOwners =
        entity.ownerIds && entity.ownerIds.length > 0
          ? entity.ownerIds
          : entity.ownerId
            ? [entity.ownerId]
            : [];
      const initialCategory = (VALID_CATEGORIES as readonly string[]).includes(entity.category)
        ? (entity.category as FormValues['category'])
        : 'department';
      const initialFreq = (VALID_FREQUENCIES as readonly string[]).includes(entity.auditFrequency)
        ? (entity.auditFrequency as FormValues['auditFrequency'])
        : 'annual';

      reset({
        name: entity.name,
        description: entity.description ?? '',
        category: initialCategory,
        ownerIds: initialOwners,
        auditFrequency: initialFreq,
        status: entity.status === 'inactive' ? 'inactive' : 'active',
      });
    } else if (open && !entity) {
      reset({
        name: '',
        description: '',
        category: 'department',
        ownerIds: [],
        auditFrequency: 'annual',
        status: 'active',
      });
    }
  }, [open, entity, reset]);

  const invalidateUniverse = () => {
    qc.invalidateQueries({ queryKey: ['universe'] });
    if (entity) {
      qc.invalidateQueries({ queryKey: ['universe', entity.id] });
    }
    qc.invalidateQueries({ queryKey: ['plans', 'recommendations'] });
    qc.invalidateQueries({ queryKey: ['plans'] });
  };

  const createMut = useMutation({
    mutationFn: (values: FormValues) =>
      universeApi.create({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        category: values.category,
        ownerId: values.ownerIds[0],
        ownerIds: values.ownerIds,
        auditFrequency: values.auditFrequency,
      }),
    onSuccess: () => {
      toast.success('Auditable entity created');
      invalidateUniverse();
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create entity'),
  });

  const updateMut = useMutation({
    mutationFn: (values: FormValues) =>
      universeApi.update(entity!.id, {
        name: values.name.trim(),
        description: values.description?.trim() ? values.description.trim() : null,
        category: values.category,
        ownerId: values.ownerIds[0],
        ownerIds: values.ownerIds,
        auditFrequency: values.auditFrequency,
        status: values.status,
      }),
    onSuccess: () => {
      toast.success('Entity updated');
      invalidateUniverse();
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update entity'),
  });

  const onSubmit = handleSubmit((values) => {
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  }, toastOnInvalid);

  const ownerIds = watch('ownerIds');
  const category = watch('category');
  const status = watch('status');
  const auditFrequency = watch('auditFrequency');

  const resolveOwnerName = (id: string): string => {
    const u = usersList.data?.find((x) => x.id === id);
    if (u) return u.displayName || `${u.firstName} ${u.lastName}`.trim() || id;
    const fromEntity = entity?.owners?.find((o) => o.id === id);
    if (fromEntity?.name) return fromEntity.name;
    if (entity && entity.ownerId === id && entity.ownerName) return entity.ownerName;
    return id;
  };

  const addOwner = (id: string): void => {
    if (!id || ownerIds.includes(id)) return;
    setValue('ownerIds', [...ownerIds, id], { shouldValidate: true, shouldDirty: true });
  };

  const removeOwner = (id: string): void => {
    setValue(
      'ownerIds',
      ownerIds.filter((x) => x !== id),
      { shouldValidate: true, shouldDirty: true },
    );
  };

  const makePrimaryOwner = (id: string): void => {
    setValue('ownerIds', [id, ...ownerIds.filter((x) => x !== id)], {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title={isEdit ? 'Edit auditable entity' : 'New auditable entity'}
      description="Auditable entities form the universe scoped under the GBB audit programme."
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Category" required error={errors.category?.message}>
            <Select error={errors.category?.message} value={category} {...register('category')}>
              <option value="department">Department</option>
              <option value="system">System</option>
              <option value="process">Process</option>
              <option value="asset">Asset</option>
              <option value="project">Project</option>
            </Select>
          </FormField>
          <FormField
            label="Status"
            required
            error={errors.status?.message}
            hint={!isEdit ? 'New entities start active.' : undefined}
          >
            <Select error={errors.status?.message} value={status} disabled={!isEdit} {...register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        </div>

        <FormField
          label="Owners"
          required
          error={errors.ownerIds?.message}
          hint="Select one or more owners responsible for this entity. The first owner is the primary owner."
        >
          <UserSelect
            value=""
            excludeIds={ownerIds}
            onChange={addOwner}
            error={errors.ownerIds?.message}
            placeholder={ownerIds.length === 0 ? 'Select primary owner…' : 'Add another owner…'}
          />
          {ownerIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ownerIds.map((id, idx) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-primary ring-1 ring-border"
                >
                  <span className="font-medium">{resolveOwnerName(id)}</span>
                  {idx === 0 ? (
                    <Badge tone="blue" className="text-[10px] py-0 px-1.5">
                      Primary
                    </Badge>
                  ) : (
                    <button
                      type="button"
                      onClick={() => makePrimaryOwner(id)}
                      className="text-[10px] font-medium text-primary hover:underline"
                    >
                      Make primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeOwner(id)}
                    className="text-text-muted hover:text-danger"
                    aria-label={`Remove ${resolveOwnerName(id)}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </FormField>

        <FormField
          label="Audit Frequency"
          required
          error={errors.auditFrequency?.message}
          hint="Periodic cycles generate overdue reminders; On-Demand entities are audited only when triggered."
        >
          <Select error={errors.auditFrequency?.message} value={auditFrequency} {...register('auditFrequency')}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="biannual">Bi-annual</option>
            <option value="annual">Annual</option>
            <option value="on_demand">On-Demand</option>
          </Select>
        </FormField>
      </form>
    </SlideOver>
  );
};
