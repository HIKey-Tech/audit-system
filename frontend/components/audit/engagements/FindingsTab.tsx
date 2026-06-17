'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { SlideOver } from '@/components/ui/SlideOver';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { findingsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { usePermission } from '@/hooks/usePermission';
import type { AuditEngagementDetail } from '@/lib/types/domain';
import { cn } from '@/lib/utils/cn';

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
  dueDate: z.string().min(1),
});

type FormValues = z.infer<typeof Schema>;

export const FindingsTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const canWrite = usePermission('finding:create');

  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ['engagements', engagement.id, 'findings'],
    queryFn: () => findingsApi.listByEngagement(engagement.id),
  });

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
      description: '',
      // Default to the engagement's audit domain so findings stay attributable
      // to the module they were raised in (overridable, e.g. cross-domain "operational").
      category: (engagement.auditType as FormValues['category']) ?? 'compliance',
      severity: 'medium',
      rootCause: '',
      riskImplication: '',
      recommendation: '',
      auditeeId: engagement.auditeeId,
      dueDate: '',
    },
  });

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
        dueDate: toISODatetime(v.dueDate),
      }),
    onSuccess: () => {
      toast.success('Finding created');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id, 'findings'] });
      qc.invalidateQueries({ queryKey: ['findings'] });
      setOpen(false);
      reset();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const onSubmit = handleSubmit((v) => create.mutate(v));
  const auditeeId = watch('auditeeId');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Findings</h2>
          <p className="text-xs text-text-secondary">Issues raised against this engagement.</p>
        </div>
        {canWrite && (
          <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
            New finding
          </Button>
        )}
      </div>

      <Card padded={false}>
        {list.isLoading ? (
          <div className="p-5 space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-4 w-4" />}
            title="No findings yet"
            description="Document control deficiencies, risks and recommendations as you progress."
            action={
              canWrite ? (
                <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
                  New finding
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {list.data.map((f) => {
              const overdue =
                new Date(f.dueDate) < new Date() && !['verified', 'pending_closure', 'closed'].includes(f.status);
              return (
                <li key={f.id}>
                  <Link
                    href={`/audit/findings/${f.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-alt/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{f.title}</p>
                      <p className="text-[11px] text-text-muted">{f.auditeeName}</p>
                    </div>
                    <Badge tone="gray">{humanizeStatus(f.category)}</Badge>
                    <StatusBadge status={f.severity} />
                    <StatusBadge status={f.status} />
                    <span
                      className={cn(
                        'text-xs',
                        overdue ? 'text-danger font-medium' : 'text-text-secondary',
                      )}
                    >
                      Due {formatDate(f.dueDate)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="New finding"
        width="xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
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
        </form>
      </SlideOver>
    </div>
  );
};
