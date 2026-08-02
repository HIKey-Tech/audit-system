'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, FolderTree, Plus, Power, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { SlideOver } from '@/components/ui/SlideOver';
import { Table, type Column } from '@/components/ui/Table';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { riskApi } from '@/lib/api/risk';
import { formatDate } from '@/lib/utils/format';
import type { RiskCategory } from '@/lib/types/domain';

const CategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  isActive: z.boolean(),
});
type CategoryFormValues = z.infer<typeof CategorySchema>;

export const RiskCategoriesTab = (): JSX.Element => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission('risk_category:write');
  const canDelete = hasPermission('risk_category:delete');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<RiskCategory | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const qc = useQueryClient();

  const categories = useQuery({
    queryKey: ['risk', 'categories', status],
    queryFn: () =>
      riskApi.listCategories(
        status === 'active' ? { isActive: true } : status === 'inactive' ? { isActive: false } : undefined,
      ),
  });

  const visibleCategories = categories.data ?? [];
  const activeCount = useMemo(
    () => visibleCategories.filter((category) => category.isActive).length,
    [visibleCategories],
  );

  const deactivate = useMutation({
    mutationFn: (category: RiskCategory) => riskApi.deactivateCategory(category.id),
    onSuccess: () => {
      toast.success('Risk category deactivated');
      qc.invalidateQueries({ queryKey: ['risk'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to deactivate category'),
  });

  const reactivate = useMutation({
    mutationFn: (category: RiskCategory) => riskApi.updateCategory(category.id, { isActive: true }),
    onSuccess: () => {
      toast.success('Risk category reactivated');
      qc.invalidateQueries({ queryKey: ['risk'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to reactivate category'),
  });

  const openCreate = (): void => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const openEdit = (category: RiskCategory): void => {
    setEditing(category);
    setIsFormOpen(true);
  };

  const columns: Column<RiskCategory>[] = [
    {
      key: 'name',
      header: 'Category',
      render: (category) => (
        <div className="min-w-0">
          <p className="font-medium text-text-primary">{category.name}</p>
          <p className="mt-0.5 max-w-xl truncate text-xs text-text-secondary">
            {category.description || 'No description provided'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (category) => (
        <Badge tone={category.isActive ? 'green' : 'gray'} withDot>
          {category.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      width: '130px',
      render: (category) => <span className="text-xs text-text-secondary">{formatDate(category.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: '190px',
      align: 'right',
      render: (category) => (
        <div className="flex justify-end gap-2">
          {canWrite && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit2 className="h-3.5 w-3.5" />}
              onClick={() => openEdit(category)}
            >
              Edit
            </Button>
          )}
          {canDelete && category.isActive && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Power className="h-3.5 w-3.5" />}
              isLoading={deactivate.isPending}
              onClick={() => deactivate.mutate(category)}
            >
              Deactivate
            </Button>
          )}
          {canWrite && !category.isActive && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              isLoading={reactivate.isPending}
              onClick={() => reactivate.mutate(category)}
            >
              Activate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardHeader
            title="Risk categories"
            subtitle={`${activeCount} active in the current view. Active categories are available when registering risks.`}
            className="mb-0"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="sm:w-36">
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </Select>
            {canWrite && (
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                New category
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Table<RiskCategory>
        columns={columns}
        data={visibleCategories}
        rowKey={(category) => category.id}
        isLoading={categories.isLoading}
        isError={categories.isError}
        onRetry={() => categories.refetch()}
        emptyState={
          <EmptyState
            icon={<FolderTree className="h-4 w-4" />}
            title="No risk categories found"
            description="Create at least one active category before registering enterprise risks."
            action={
              canWrite ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
                  New category
                </Button>
              ) : undefined
            }
          />
        }
      />

      <RiskCategorySlideOver
        open={isFormOpen}
        category={editing}
        onClose={() => setIsFormOpen(false)}
      />
    </div>
  );
};

const RiskCategorySlideOver = ({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: RiskCategory | null;
  onClose: () => void;
}): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(category);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(CategorySchema),
    defaultValues: {
      name: '',
      description: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: category?.name ?? '',
      description: category?.description ?? '',
      isActive: category?.isActive ?? true,
    });
  }, [category, open, reset]);

  const save = useMutation({
    mutationFn: (values: CategoryFormValues) => {
      const dto = {
        name: values.name,
        description: values.description || undefined,
        isActive: values.isActive,
      };
      return category ? riskApi.updateCategory(category.id, dto) : riskApi.createCategory(dto);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Risk category updated' : 'Risk category created');
      qc.invalidateQueries({ queryKey: ['risk'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save category'),
  });

  const onSubmit = handleSubmit((values) => save.mutate(values), toastOnInvalid);

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title={isEdit ? 'Edit risk category' : 'New risk category'}
      description="Categories group risk register entries and control the category dropdown."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} isLoading={save.isPending}>
            {isEdit ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Name" required error={errors.name?.message}>
          <Input error={errors.name?.message} {...register('name')} />
        </FormField>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={4} error={errors.description?.message} {...register('description')} />
        </FormField>
        {isEdit && (
          <FormField label="Status">
            <Select {...register('isActive', { setValueAs: (value) => value === 'true' })}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FormField>
        )}
      </form>
    </SlideOver>
  );
};