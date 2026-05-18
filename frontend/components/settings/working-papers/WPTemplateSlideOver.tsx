'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { wpTemplatesApi } from '@/lib/api/settings';
import type { WorkingPaperTemplateDto, SettingsAuditType } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

const SectionSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().min(1, 'Description required').max(1000),
  placeholder: z.string().min(1, 'Placeholder required').max(2000),
  required: z.boolean(),
});

const Schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
  auditType: z.enum(['it', 'financial', 'compliance', 'systems', 'all'] as const),
  sections: z.array(SectionSchema).min(1, 'At least one section required'),
});

type FormValues = z.infer<typeof Schema>;

const DEFAULT_SECTION = {
  title: '',
  description: '',
  placeholder: '',
  required: false,
};

interface Props {
  open: boolean;
  onClose: () => void;
  template?: WorkingPaperTemplateDto | null;
}

export const WPTemplateSlideOver = ({ open, onClose, template }: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(template);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: '',
      description: '',
      auditType: 'all',
      sections: [{ ...DEFAULT_SECTION }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'sections' });

  useEffect(() => {
    if (open && template) {
      reset({
        name: template.name,
        description: template.description ?? '',
        auditType: template.auditType,
        sections: template.sections.map((s) => ({ ...s })),
      });
    } else if (open && !template) {
      reset({
        name: '',
        description: '',
        auditType: 'all',
        sections: [{ ...DEFAULT_SECTION }],
      });
    }
  }, [open, template, reset]);

  const createMut = useMutation({
    mutationFn: (values: FormValues) =>
      wpTemplatesApi.create({
        name: values.name,
        description: values.description || undefined,
        auditType: values.auditType as SettingsAuditType,
        sections: values.sections,
      }),
    onSuccess: () => {
      toast.success('Template created');
      qc.invalidateQueries({ queryKey: ['settings', 'wp-templates'] });
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to create template'),
  });

  const updateMut = useMutation({
    mutationFn: (values: FormValues) =>
      wpTemplatesApi.update(template!.id, {
        name: values.name,
        description: values.description || undefined,
        auditType: values.auditType as SettingsAuditType,
        sections: values.sections,
      }),
    onSuccess: () => {
      toast.success('Template updated');
      qc.invalidateQueries({ queryKey: ['settings', 'wp-templates'] });
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to update template'),
  });

  const onSubmit = handleSubmit((values) => {
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  });

  const isPending = isSubmitting || createMut.isPending || updateMut.isPending;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit template' : 'New working paper template'}
      description="Sections define the structure auditors follow when writing working papers."
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} isLoading={isPending}>
            {isEdit ? 'Save changes' : 'Create template'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormField label="Template name" required error={errors.name?.message}>
          <Input
            placeholder="e.g. IT Audit Working Paper"
            error={errors.name?.message}
            {...register('name')}
          />
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={2} placeholder="Optional description" {...register('description')} />
        </FormField>

        <FormField label="Audit type" required error={errors.auditType?.message}>
          <Select error={errors.auditType?.message} {...register('auditType')}>
            <option value="all">All types</option>
            <option value="it">IT</option>
            <option value="financial">Financial</option>
            <option value="compliance">Compliance</option>
            <option value="systems">Systems</option>
          </Select>
        </FormField>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">
              Sections <span className="text-danger">*</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => append({ ...DEFAULT_SECTION })}
            >
              Add section
            </Button>
          </div>

          {errors.sections?.root && (
            <p className="mb-2 text-xs text-danger">{errors.sections.root.message}</p>
          )}
          {typeof errors.sections?.message === 'string' && (
            <p className="mb-2 text-xs text-danger">{errors.sections.message}</p>
          )}

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div
                key={field.id}
                className={cn(
                  'rounded-lg border border-border bg-surface-alt p-4',
                  errors.sections?.[idx] && 'border-danger',
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-text-muted" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Section {idx + 1}
                    </span>
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="rounded p-1 text-text-secondary hover:bg-red-50 hover:text-danger transition-colors"
                      aria-label="Remove section"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <FormField
                    label="Title"
                    required
                    error={errors.sections?.[idx]?.title?.message}
                  >
                    <Input
                      placeholder="e.g. Audit Objective"
                      error={errors.sections?.[idx]?.title?.message}
                      {...register(`sections.${idx}.title`)}
                    />
                  </FormField>

                  <FormField
                    label="Description"
                    required
                    error={errors.sections?.[idx]?.description?.message}
                  >
                    <Textarea
                      rows={2}
                      placeholder="What should the auditor document here?"
                      {...register(`sections.${idx}.description`)}
                    />
                  </FormField>

                  <FormField
                    label="Placeholder text"
                    required
                    error={errors.sections?.[idx]?.placeholder?.message}
                  >
                    <Textarea
                      rows={2}
                      placeholder="Hint shown inside the text area when empty"
                      {...register(`sections.${idx}.placeholder`)}
                    />
                  </FormField>

                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
                      {...register(`sections.${idx}.required`)}
                    />
                    <span className="text-sm text-text-primary">Required section</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </SlideOver>
  );
};
