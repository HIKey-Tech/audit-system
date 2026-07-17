'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { ScoredUserSelect } from '@/components/common/ScoredUserSelect';
import { plansApi } from '@/lib/api/audit';

/** Convert a date-only string (YYYY-MM-DD) to an ISO-8601 datetime string */
function toISODatetime(dateStr: string): string {
  return dateStr ? `${dateStr}T00:00:00.000Z` : dateStr;
}

const Schema = z.object({
  title: z.string().min(2).max(200),
  leadAuditorId: z.string().min(1, 'Lead auditor required'),
  auditManagerId: z.string().min(1, 'Audit manager required'),
  auditeeId: z.string().min(1, 'Auditee required'),
  plannedStartDate: z.string().min(1),
  plannedEndDate: z.string().min(1),
  slaDeadline: z.string().min(1),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  planId: string;
  itemId: string;
  defaultTitle?: string;
}

export const CreateEngagementSlideOver = ({
  open,
  onClose,
  planId,
  itemId,
  defaultTitle,
}: Props): JSX.Element => {
  const qc = useQueryClient();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      title: '',
      leadAuditorId: '',
      auditManagerId: '',
      auditeeId: '',
      plannedStartDate: '',
      plannedEndDate: '',
      slaDeadline: '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        title: defaultTitle ?? '',
        leadAuditorId: '',
        auditManagerId: '',
        auditeeId: '',
        plannedStartDate: '',
        plannedEndDate: '',
        slaDeadline: '',
      });
    }
  }, [open, reset, defaultTitle]);

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      plansApi.createEngagement(itemId, {
        title: v.title,
        leadAuditorId: v.leadAuditorId,
        auditManagerId: v.auditManagerId,
        auditeeId: v.auditeeId,
        plannedStartDate: toISODatetime(v.plannedStartDate),
        plannedEndDate: toISODatetime(v.plannedEndDate),
        slaDeadline: toISODatetime(v.slaDeadline),
      }),
    onSuccess: (eng) => {
      toast.success('Engagement created');
      qc.invalidateQueries({ queryKey: ['plans', planId] });
      qc.invalidateQueries({ queryKey: ['engagements'] });
      onClose();
      router.push(`/audit/engagements/${eng.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const onSubmit = handleSubmit((v) => create.mutate(v), toastOnInvalid);

  const lead = watch('leadAuditorId');
  const manager = watch('auditManagerId');
  const auditee = watch('auditeeId');

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Create engagement from plan item"
      description="The engagement inherits audit type and priority from the plan item."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} isLoading={create.isPending} size="sm">
            Create engagement
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Title" required error={errors.title?.message}>
          <Input error={errors.title?.message} {...register('title')} />
        </FormField>

        <FormField label="Lead auditor" required error={errors.leadAuditorId?.message}>
          <ScoredUserSelect
            role="lead_auditor"
            value={lead}
            onChange={(v) => setValue('leadAuditorId', v, { shouldValidate: true })}
            error={errors.leadAuditorId?.message}
          />
        </FormField>
        <FormField label="Audit manager" required error={errors.auditManagerId?.message}>
          <ScoredUserSelect
            role="audit_manager"
            value={manager}
            onChange={(v) => setValue('auditManagerId', v, { shouldValidate: true })}
            error={errors.auditManagerId?.message}
          />
        </FormField>
        <FormField label="Auditee" required error={errors.auditeeId?.message}>
          <UserSelect
            value={auditee}
            onChange={(v) => setValue('auditeeId', v, { shouldValidate: true })}
            error={errors.auditeeId?.message}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Start" required error={errors.plannedStartDate?.message}>
            <Input type="date" error={errors.plannedStartDate?.message} {...register('plannedStartDate')} />
          </FormField>
          <FormField label="End" required error={errors.plannedEndDate?.message}>
            <Input type="date" error={errors.plannedEndDate?.message} {...register('plannedEndDate')} />
          </FormField>
        </div>
        <FormField label="SLA deadline" required error={errors.slaDeadline?.message}>
          <Input type="date" error={errors.slaDeadline?.message} {...register('slaDeadline')} />
        </FormField>
      </form>
    </SlideOver>
  );
};
