'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { toastOnInvalid } from '@/lib/utils/form';

import { Button } from '@/components/ui/Button';
import { SlideOver } from '@/components/ui/SlideOver';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { checklistsApi, findingsApi, workingPapersApi } from '@/lib/api/audit';
import { riskApi } from '@/lib/api/risk';
import { usersApi } from '@/lib/api/users';
import { usePermission } from '@/hooks/usePermission';
import type { AuditChecklistItem, AuditEngagementDetail } from '@/lib/types/domain';

/** Convert a date-only string (YYYY-MM-DD) to an ISO-8601 datetime string */
function toISODatetime(dateStr: string): string {
  return dateStr ? `${dateStr}T00:00:00.000Z` : dateStr;
}

const Schema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(1),
  category: z.enum(['it', 'financial', 'compliance', 'systems', 'operational']),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'informational']),
  rootCause: z.string().min(1, 'Root cause is required'),
  riskImplication: z.string().min(1, 'Risk implication is required'),
  recommendation: z.string().min(1, 'Recommendation is required'),
  auditeeId: z.string().min(1),
  additionalAuditeeIds: z.array(z.string()).optional(),
  dueDate: z.string().min(1),
  checklistId: z.string().optional().or(z.literal('')),
  workingPaperId: z.string().optional().or(z.literal('')),
  riskId: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof Schema>;

export interface FindingPrefill {
  title?: string;
  description?: string;
  /** Locks the source-control select to this checklist item. */
  checklistId?: string;
}

/**
 * Shared "raise a finding" form. Used from the Findings tab (blank) and from the
 * Checklists tab (prefilled from a failed control test, with checklistId set) so
 * the control-test → finding evidence chain is captured instead of re-typed.
 */
export const NewFindingSlideOver = ({
  engagement,
  open,
  onClose,
  prefill,
}: {
  engagement: AuditEngagementDetail;
  open: boolean;
  onClose: () => void;
  prefill?: FindingPrefill;
}): JSX.Element => {
  const qc = useQueryClient();

  const defaults = (): FormValues => ({
    title: prefill?.title ?? '',
    description: prefill?.description ?? '',
    // Default to the engagement's audit domain so findings stay attributable
    // to the module they were raised in (overridable, e.g. cross-domain "operational").
    category: (engagement.auditType as FormValues['category']) ?? 'compliance',
    severity: 'medium',
    rootCause: '',
    riskImplication: '',
    recommendation: '',
    auditeeId: engagement.auditeeId,
    additionalAuditeeIds: [],
    dueDate: '',
    checklistId: prefill?.checklistId ?? '',
    workingPaperId: '',
    riskId: '',
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(Schema), defaultValues: defaults() });

  // Re-apply the prefill each time the slide-over opens for a (possibly
  // different) source control.
  useEffect(() => {
    if (open) reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.checklistId]);

  // Source linkage options — team-only surfaces; queries stay dormant until opened.
  const checklists = useQuery({
    queryKey: ['engagements', engagement.id, 'checklists'],
    queryFn: () => checklistsApi.listByEngagement(engagement.id),
    enabled: open,
  });
  const checklistItems: AuditChecklistItem[] = checklists.data
    ? Object.values(checklists.data).flat()
    : [];
  const workingPapers = useQuery({
    queryKey: ['engagements', engagement.id, 'working-papers'],
    queryFn: () => workingPapersApi.listByEngagement(engagement.id),
    enabled: open,
  });

  // Related risk — optional link, only offered to users who can read the register.
  const canReadRisk = usePermission('risk:read');
  const risks = useQuery({
    queryKey: ['risks', 'register', 'picker'],
    queryFn: () => riskApi.list({ pageSize: 100 }),
    enabled: open && canReadRisk,
    staleTime: 5 * 60_000,
  });

  // Names for the co-responder chips (directory: gated on user:directory).
  const usersList = useQuery({
    queryKey: ['users', 'directory'],
    queryFn: () => usersApi.directory(),
    staleTime: 5 * 60_000,
  });
  const userName = (id: string): string => {
    const u = usersList.data?.find((x) => x.id === id);
    return u ? u.displayName || `${u.firstName} ${u.lastName}` : id;
  };

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      findingsApi.create(engagement.id, {
        title: v.title,
        description: v.description,
        category: v.category,
        severity: v.severity,
        rootCause: v.rootCause,
        riskImplication: v.riskImplication,
        recommendation: v.recommendation,
        auditeeId: v.auditeeId,
        additionalAuditeeIds: v.additionalAuditeeIds,
        dueDate: toISODatetime(v.dueDate),
        checklistId: v.checklistId || undefined,
        workingPaperId: v.workingPaperId || undefined,
        riskId: v.riskId || undefined,
      }),
    onSuccess: () => {
      toast.success('Finding created');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'findings'] });
      qc.invalidateQueries({ queryKey: ['findings'] });
      onClose();
      reset(defaults());
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const onSubmit = handleSubmit((v) => create.mutate(v), toastOnInvalid);
  const auditeeId = watch('auditeeId');
  const additionalAuditeeIds = watch('additionalAuditeeIds') ?? [];

  const addResponder = (id: string): void => {
    if (!id || id === auditeeId || additionalAuditeeIds.includes(id)) return;
    setValue('additionalAuditeeIds', [...additionalAuditeeIds, id]);
  };
  const removeResponder = (id: string): void => {
    setValue(
      'additionalAuditeeIds',
      additionalAuditeeIds.filter((x) => x !== id),
    );
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="New finding"
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} isLoading={create.isPending}>
            Raise finding
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Title" required error={errors.title?.message}>
          <Input error={errors.title?.message} {...register('title')} />
        </FormField>
        <FormField label="Description" required error={errors.description?.message}>
          <Textarea rows={4} error={errors.description?.message} {...register('description')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Category" required error={errors.category?.message}>
            <Select error={errors.category?.message} {...register('category')}>
              <option value="it">IT</option>
              <option value="financial">Financial</option>
              <option value="compliance">Compliance</option>
              <option value="systems">Systems</option>
              <option value="operational">Operational</option>
            </Select>
          </FormField>
          <FormField label="Severity" required error={errors.severity?.message}>
            <Select error={errors.severity?.message} {...register('severity')}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="informational">Informational</option>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Source control test"
            hint="Which control test surfaced this issue — keeps the evidence chain."
          >
            <Select {...register('checklistId')}>
              <option value="">None</option>
              {checklistItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.controlReference} — {c.controlDescription.slice(0, 60)}
                  {c.result === 'failed' ? ' (failed)' : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Source working paper">
            <Select {...register('workingPaperId')}>
              <option value="">None</option>
              {(workingPapers.data ?? []).map((wp) => (
                <option key={wp.id} value={wp.id}>
                  {wp.title}
                </option>
              ))}
            </Select>
          </FormField>
          {canReadRisk && (
            <FormField
              label="Related risk"
              hint="Link the register risk this finding relates to — closes the risk ↔ finding loop."
            >
              <Select {...register('riskId')}>
                <option value="">None</option>
                {(risks.data?.items ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </div>
        <FormField label="Root cause" required error={errors.rootCause?.message}>
          <Textarea rows={3} {...register('rootCause')} />
        </FormField>
        <FormField label="Risk implication" required error={errors.riskImplication?.message}>
          <Textarea rows={3} {...register('riskImplication')} />
        </FormField>
        <FormField label="Recommendation" required error={errors.recommendation?.message}>
          <Textarea rows={3} {...register('recommendation')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Auditee" required error={errors.auditeeId?.message}>
            <UserSelect value={auditeeId} onChange={(v) => setValue('auditeeId', v, { shouldValidate: true })} />
          </FormField>
          <FormField label="Due date" required error={errors.dueDate?.message}>
            <Input type="date" error={errors.dueDate?.message} {...register('dueDate')} />
          </FormField>
        </div>
        <FormField label="Additional auditees">
          <UserSelect
            value=""
            placeholder="Add a co-responder…"
            excludeIds={[auditeeId, ...additionalAuditeeIds]}
            onChange={addResponder}
          />
          {additionalAuditeeIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {additionalAuditeeIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2.5 py-1 text-xs text-text-primary"
                >
                  {userName(id)}
                  <button
                    type="button"
                    onClick={() => removeResponder(id)}
                    className="text-text-muted hover:text-danger"
                    aria-label={`Remove ${userName(id)}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </FormField>
      </form>
    </SlideOver>
  );
};
