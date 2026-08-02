'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';
import { Plus, Trash2, GripVertical } from 'lucide-react';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Textarea } from '@/components/ui/Input';
import { reportTemplatesApi } from '@/lib/api/settings';
import type { ReportTemplateDto } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

const SectionSchema = z.object({
  key: z.string().min(1, 'Key required').max(100).regex(/^[a-z][a-z0-9_]*$/, 'Lowercase letters, digits and underscores only'),
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().min(1, 'Description required').max(1000),
  includeFindings: z.boolean(),
});

const VariableSchema = z.object({
  key: z.string().min(1, 'Key required').max(100),
  description: z.string().min(1, 'Description required').max(1000),
  example: z.string().min(1, 'Example required').max(500),
});

const Schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional().or(z.literal('')),
  sections: z.array(SectionSchema).min(1, 'At least one section required'),
  availableVariables: z.array(VariableSchema),
});

type FormValues = z.infer<typeof Schema>;

const DEFAULT_SECTION = { key: '', title: '', description: '', includeFindings: false };
const DEFAULT_VARIABLE = { key: '', description: '', example: '' };

interface Props {
  open: boolean;
  onClose: () => void;
  template?: ReportTemplateDto | null;
}

export const ReportTemplateFormSlideOver = ({ open, onClose, template }: Props): JSX.Element => {
  const qc = useQueryClient();
  const isEdit = Boolean(template);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: '',
      description: '',
      sections: [{ ...DEFAULT_SECTION }],
      availableVariables: [],
    },
  });

  const sections = useFieldArray({ control, name: 'sections' });
  const variables = useFieldArray({ control, name: 'availableVariables' });

  useEffect(() => {
    if (open && template) {
      reset({
        name: template.name,
        description: template.description ?? '',
        sections: template.sections.map((s) => ({ ...s })),
        availableVariables: template.availableVariables.map((v) => ({ ...v })),
      });
    } else if (open && !template) {
      reset({
        name: '',
        description: '',
        sections: [{ ...DEFAULT_SECTION }],
        availableVariables: [],
      });
    }
  }, [open, template, reset]);

  const createMut = useMutation({
    mutationFn: (values: FormValues) =>
      reportTemplatesApi.create({
        name: values.name,
        description: values.description || undefined,
        sections: values.sections,
        availableVariables: values.availableVariables,
      }),
    onSuccess: () => {
      toast.success('Report template created');
      qc.invalidateQueries({ queryKey: ['settings', 'report-templates'] });
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to create template'),
  });

  const updateMut = useMutation({
    mutationFn: (values: FormValues) =>
      reportTemplatesApi.update(template!.id, {
        name: values.name,
        description: values.description || undefined,
        sections: values.sections,
        availableVariables: values.availableVariables,
      }),
    onSuccess: () => {
      toast.success('Report template updated');
      qc.invalidateQueries({ queryKey: ['settings', 'report-templates'] });
      onClose();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Failed to update template'),
  });

  const onSubmit = handleSubmit((values) => {
    if (isEdit) updateMut.mutate(values);
    else createMut.mutate(values);
  }, toastOnInvalid);

  const isPending = isSubmitting || createMut.isPending || updateMut.isPending;

  return (
    <SlideOver
      open={open}
      dirty={isDirty}
      onClose={onClose}
      title={isEdit ? 'Edit report template' : 'New report template'}
      description="Define the structure and available variables for generated audit reports."
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
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <FormField label="Template name" required error={errors.name?.message}>
          <Input
            placeholder="e.g. Standard Audit Report"
            error={errors.name?.message}
            {...register('name')}
          />
        </FormField>

        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={2} placeholder="Optional description" {...register('description')} />
        </FormField>

        {/* Sections */}
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
              onClick={() => sections.append({ ...DEFAULT_SECTION })}
            >
              Add section
            </Button>
          </div>

          {typeof errors.sections?.message === 'string' && (
            <p className="mb-2 text-xs text-danger">{errors.sections.message}</p>
          )}

          <div className="space-y-3">
            {sections.fields.map((field, idx) => (
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
                  {sections.fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => sections.remove(idx)}
                      className="rounded p-1 text-text-secondary hover:bg-red-50 hover:text-danger transition-colors"
                      aria-label="Remove section"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label="Key"
                    required
                    error={errors.sections?.[idx]?.key?.message}
                  >
                    <Input
                      placeholder="e.g. executive_summary"
                      error={errors.sections?.[idx]?.key?.message}
                      {...register(`sections.${idx}.key`)}
                    />
                  </FormField>

                  <FormField
                    label="Title"
                    required
                    error={errors.sections?.[idx]?.title?.message}
                  >
                    <Input
                      placeholder="e.g. Executive Summary"
                      error={errors.sections?.[idx]?.title?.message}
                      {...register(`sections.${idx}.title`)}
                    />
                  </FormField>
                </div>

                <FormField
                  label="Description"
                  required
                  error={errors.sections?.[idx]?.description?.message}
                  className="mt-3"
                >
                  <Textarea
                    rows={2}
                    placeholder="What does this section cover?"
                    {...register(`sections.${idx}.description`)}
                  />
                </FormField>

                <label className="mt-3 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
                    {...register(`sections.${idx}.includeFindings`)}
                  />
                  <span className="text-sm text-text-primary">Include findings in this section</span>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Available Variables */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">
              Available Variables
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => variables.append({ ...DEFAULT_VARIABLE })}
            >
              Add variable
            </Button>
          </div>
          <p className="mb-3 text-xs text-text-secondary">
            Variables can be used in section content as{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">{'{{variable_key}}'}</code>
          </p>

          <div className="space-y-3">
            {variables.fields.map((field, idx) => (
              <div key={field.id} className="rounded-lg border border-border bg-surface-alt p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Variable {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => variables.remove(idx)}
                    className="rounded p-1 text-text-secondary hover:bg-red-50 hover:text-danger transition-colors"
                    aria-label="Remove variable"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField
                    label="Key"
                    required
                    error={errors.availableVariables?.[idx]?.key?.message}
                  >
                    <Input
                      placeholder="e.g. engagement_title"
                      error={errors.availableVariables?.[idx]?.key?.message}
                      {...register(`availableVariables.${idx}.key`)}
                    />
                  </FormField>

                  <FormField
                    label="Example value"
                    required
                    error={errors.availableVariables?.[idx]?.example?.message}
                  >
                    <Input
                      placeholder="e.g. IT Audit 2024 Q3"
                      error={errors.availableVariables?.[idx]?.example?.message}
                      {...register(`availableVariables.${idx}.example`)}
                    />
                  </FormField>
                </div>

                <FormField
                  label="Description"
                  required
                  error={errors.availableVariables?.[idx]?.description?.message}
                  className="mt-3"
                >
                  <Input
                    placeholder="e.g. The title of the audit engagement"
                    error={errors.availableVariables?.[idx]?.description?.message}
                    {...register(`availableVariables.${idx}.description`)}
                  />
                </FormField>
              </div>
            ))}

            {variables.fields.length === 0 && (
              <p className="text-center text-xs text-text-muted py-4">
                No variables defined. Variables enable dynamic content in generated reports.
              </p>
            )}
          </div>
        </div>
      </form>
    </SlideOver>
  );
};
