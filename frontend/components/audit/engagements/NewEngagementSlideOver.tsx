'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { engagementsApi, plansApi, universeApi } from '@/lib/api/audit';

type Mode = 'plan' | 'ad_hoc';

/** Convert a date-only string (YYYY-MM-DD) to an ISO-8601 datetime string */
function toISODatetime(dateStr: string): string {
  return dateStr ? `${dateStr}T00:00:00.000Z` : dateStr;
}

const Schema = z.object({
  mode: z.enum(['plan', 'ad_hoc']),
  planId: z.string().optional().or(z.literal('')),
  planItemId: z.string().optional().or(z.literal('')),
  universeId: z.string().optional().or(z.literal('')),
  auditType: z.enum(['it', 'financial', 'compliance', 'systems']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  adhocReason: z.string().optional().or(z.literal('')),
  title: z.string().min(2).max(200),
  leadAuditorId: z.string().min(1, 'Lead auditor required'),
  auditManagerId: z.string().min(1, 'Audit manager required'),
  auditeeId: z.string().min(1, 'Auditee required'),
  plannedStartDate: z.string().min(1),
  plannedEndDate: z.string().min(1),
  slaDeadline: z.string().min(1),
}).superRefine((v, ctx) => {
  if (v.mode === 'plan') {
    if (!v.planItemId) ctx.addIssue({ code: 'custom', path: ['planItemId'], message: 'Plan item required' });
  } else {
    if (!v.universeId) ctx.addIssue({ code: 'custom', path: ['universeId'], message: 'Auditable entity required' });
    if (!v.adhocReason || v.adhocReason.trim().length < 5) {
      ctx.addIssue({ code: 'custom', path: ['adhocReason'], message: 'Provide an ad-hoc reason' });
    }
  }
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export const NewEngagementSlideOver = ({ open, onClose }: Props): JSX.Element => {
  const qc = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('plan');

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
      mode: 'plan',
      auditType: 'compliance',
      priority: 'medium',
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
      setMode('plan');
      reset({
        mode: 'plan',
        auditType: 'compliance',
        priority: 'medium',
        title: '',
        leadAuditorId: '',
        auditManagerId: '',
        auditeeId: '',
        plannedStartDate: '',
        plannedEndDate: '',
        slaDeadline: '',
      });
    }
  }, [open, reset]);

  const plans = useQuery({
    queryKey: ['plans', 'approved'],
    queryFn: () => plansApi.list({ pageSize: 50, status: 'approved' }),
    enabled: open && mode === 'plan',
  });

  const planId = watch('planId');
  const planDetail = useQuery({
    queryKey: ['plans', planId],
    queryFn: () => plansApi.get(planId!),
    enabled: Boolean(planId) && mode === 'plan',
  });

  const universeOptions = useQuery({
    queryKey: ['universe', 'all'],
    queryFn: () => universeApi.list({ pageSize: 100, status: 'active' }),
    enabled: open && mode === 'ad_hoc',
  });

  const lead = watch('leadAuditorId');
  const manager = watch('auditManagerId');
  const auditee = watch('auditeeId');

  const create = useMutation({
    mutationFn: async (v: FormValues) => {
      if (v.mode === 'plan' && v.planItemId) {
        // POST /audit/engagements — CreateEngagementFromPlanRequestSchema
        return engagementsApi.createFromPlan({
          title: v.title,
          leadAuditorId: v.leadAuditorId,
          auditManagerId: v.auditManagerId,
          auditeeId: v.auditeeId,
          plannedStartDate: toISODatetime(v.plannedStartDate),
          plannedEndDate: toISODatetime(v.plannedEndDate),
          slaDeadline: toISODatetime(v.slaDeadline),
          planItemId: v.planItemId,
        });
      }
      // POST /audit/engagements/adhoc — CreateAdhocEngagementRequestSchema
      return engagementsApi.createAdhoc({
        title: v.title,
        leadAuditorId: v.leadAuditorId,
        auditManagerId: v.auditManagerId,
        auditeeId: v.auditeeId,
        plannedStartDate: toISODatetime(v.plannedStartDate),
        plannedEndDate: toISODatetime(v.plannedEndDate),
        slaDeadline: toISODatetime(v.slaDeadline),
        universeId: v.universeId!,
        auditType: v.auditType,
        priority: v.priority,
        adhocReason: v.adhocReason!,
      });
    },
    onSuccess: (eng) => {
      toast.success('Engagement created');
      qc.invalidateQueries({ queryKey: ['engagements'] });
      onClose();
      router.push(`/audit/engagements/${eng.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create engagement'),
  });

  const onSubmit = handleSubmit((v) => create.mutate({ ...v, mode }));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="New engagement"
      description="From a plan item or ad-hoc."
      width="xl"
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
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="inline-flex rounded-md border border-border bg-surface-alt p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('plan');
              setValue('mode', 'plan');
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === 'plan' ? 'bg-white text-primary shadow-card' : 'text-text-secondary'}`}
          >
            From plan item
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('ad_hoc');
              setValue('mode', 'ad_hoc');
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === 'ad_hoc' ? 'bg-white text-primary shadow-card' : 'text-text-secondary'}`}
          >
            Ad-hoc
          </button>
        </div>

        {mode === 'plan' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Plan" required error={errors.planId?.message}>
              <Select {...register('planId')}>
                <option value="">Select plan…</option>
                {plans.data?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.year})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Plan item" required error={errors.planItemId?.message}>
              <Select {...register('planItemId')} disabled={!planId || planDetail.isLoading}>
                <option value="">Select item…</option>
                {(planDetail.data?.items ?? []).filter((i) => !i.engagementCreated).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.universeName} ({it.auditType})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        ) : (
          <>
            <FormField label="Auditable entity" required error={errors.universeId?.message}>
              <Select {...register('universeId')}>
                <option value="">Select entity…</option>
                {universeOptions.data?.items.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Audit type" required error={errors.auditType?.message}>
                <Select {...register('auditType')}>
                  <option value="it">IT</option>
                  <option value="financial">Financial</option>
                  <option value="compliance">Compliance</option>
                  <option value="systems">Systems</option>
                </Select>
              </FormField>
              <FormField label="Priority" required error={errors.priority?.message}>
                <Select {...register('priority')}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </FormField>
            </div>
            <FormField label="Ad-hoc reason" required error={errors.adhocReason?.message}>
              <Textarea rows={3} placeholder="Why outside the approved plan?" {...register('adhocReason')} />
            </FormField>
          </>
        )}

        <FormField label="Title" required error={errors.title?.message}>
          <Input error={errors.title?.message} {...register('title')} />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Lead auditor" required error={errors.leadAuditorId?.message}>
            <UserSelect value={lead} onChange={(v) => setValue('leadAuditorId', v, { shouldValidate: true })} />
          </FormField>
          <FormField label="Audit manager" required error={errors.auditManagerId?.message}>
            <UserSelect value={manager} onChange={(v) => setValue('auditManagerId', v, { shouldValidate: true })} />
          </FormField>
        </div>
        <FormField label="Auditee" required error={errors.auditeeId?.message}>
          <UserSelect value={auditee} onChange={(v) => setValue('auditeeId', v, { shouldValidate: true })} />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Start" required error={errors.plannedStartDate?.message}>
            <Input type="date" {...register('plannedStartDate')} />
          </FormField>
          <FormField label="End" required error={errors.plannedEndDate?.message}>
            <Input type="date" {...register('plannedEndDate')} />
          </FormField>
          <FormField label="SLA deadline" required error={errors.slaDeadline?.message}>
            <Input type="date" {...register('slaDeadline')} />
          </FormField>
        </div>
      </form>
    </SlideOver>
  );
};
