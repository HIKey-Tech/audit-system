'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { engagementsApi } from '@/lib/api/audit';
import { systemAuditApi, type AnalysisException, type AnalysisRunDetail, type RaiseFindingInput } from '@/lib/api/system-audit';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

const inDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Raise one audit finding from the selected exceptions of a run. */
export const RaiseFindingSlideOver = ({
  open,
  onClose,
  run,
  exceptions,
}: {
  open: boolean;
  onClose: () => void;
  run: AnalysisRunDetail;
  exceptions: AnalysisException[];
}): JSX.Element => {
  const qc = useQueryClient();
  const worst = SEVERITY_ORDER.find((s) => exceptions.some((e) => e.severity === s)) ?? 'medium';
  const firstRule = exceptions[0]?.ruleLabel ?? 'Exception';

  const [form, setForm] = useState({
    engagementId: run.engagement?.id ?? '',
    title: '',
    severity: worst as RaiseFindingInput['severity'],
    category: 'it' as RaiseFindingInput['category'],
    description: '',
    rootCause: '',
    riskImplication: '',
    recommendation: '',
    auditeeId: '',
    dueDate: inDays(worst === 'critical' ? 15 : worst === 'high' ? 30 : 60),
  });

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({
      ...f,
      engagementId: run.engagement?.id ?? '',
      title: `${firstRule} — ${run.systemName}`.slice(0, 200),
      severity: worst,
      description: '',
      dueDate: inDays(worst === 'critical' ? 15 : worst === 'high' ? 30 : 60),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const engagements = useQuery({
    queryKey: ['engagements', 'finding-picker'],
    queryFn: () => engagementsApi.list({ pageSize: 100 }),
    enabled: open && !run.engagement,
  });

  const raise = useMutation({
    mutationFn: () =>
      systemAuditApi.raiseFinding(run.id, {
        exceptionIds: exceptions.map((e) => e.id),
        engagementId: run.engagement ? undefined : form.engagementId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        severity: form.severity,
        rootCause: form.rootCause.trim(),
        riskImplication: form.riskImplication.trim(),
        recommendation: form.recommendation.trim(),
        auditeeId: form.auditeeId,
        dueDate: new Date(`${form.dueDate}T17:00:00`).toISOString(),
      }),
    onSuccess: (result) => {
      toast.success(
        <span>
          Finding raised from {result.linkedExceptions} exception(s).{' '}
          <Link href={`/audit/findings/${result.findingId}`} className="font-medium underline">Open finding</Link>
        </span>,
      );
      qc.invalidateQueries({ queryKey: ['system-audit'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not raise the finding'),
  });

  const submit = (): void => {
    const missing = [
      !run.engagement && !form.engagementId && 'engagement',
      !form.title.trim() && 'title',
      !form.rootCause.trim() && 'root cause',
      !form.riskImplication.trim() && 'risk implication',
      !form.recommendation.trim() && 'recommendation',
      !form.auditeeId && 'auditee',
      !form.dueDate && 'due date',
    ].filter(Boolean);
    if (missing.length) return void toast.error(`Complete the ${missing.join(', ')}`);
    raise.mutate();
  };

  const set = (key: keyof typeof form, value: string): void => setForm((f) => ({ ...f, [key]: value }));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Raise audit finding"
      description={`${exceptions.length} exception(s) from ${run.reference} will be listed in the finding and marked confirmed.`}
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} isLoading={raise.isPending}>Raise finding</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary">
          {exceptions.map((e) => (
            <p key={e.id}>• [{e.severity}] {e.title}</p>
          ))}
        </div>
        {!run.engagement && (
          <FormField label="Engagement" required hint="This analysis is organisation-wide; choose the engagement the finding belongs to">
            <Select value={form.engagementId} onChange={(e) => set('engagementId', e.target.value)}>
              <option value="">Select engagement…</option>
              {engagements.data?.items.map((e) => (
                <option key={e.id} value={e.id}>{e.referenceNumber} — {e.title}</option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Title" required>
          <Input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Severity" required>
            <Select value={form.severity} onChange={(e) => set('severity', e.target.value)}>
              {['critical', 'high', 'medium', 'low', 'informational'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </FormField>
          <FormField label="Category" required>
            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="it">IT</option>
              <option value="compliance">Compliance</option>
              <option value="financial">Financial</option>
              <option value="operational">Operational</option>
            </Select>
          </FormField>
          <FormField label="Due date" required>
            <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Condition" optional hint="Leave blank to describe the finding by its exceptions">
          <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </FormField>
        <FormField label="Root cause" required>
          <Textarea rows={2} value={form.rootCause} onChange={(e) => set('rootCause', e.target.value)} />
        </FormField>
        <FormField label="Risk implication" required>
          <Textarea rows={2} value={form.riskImplication} onChange={(e) => set('riskImplication', e.target.value)} />
        </FormField>
        <FormField label="Recommendation" required>
          <Textarea rows={2} value={form.recommendation} onChange={(e) => set('recommendation', e.target.value)} />
        </FormField>
        <FormField label="Auditee (responsible owner)" required>
          <UserSelect value={form.auditeeId} onChange={(v) => set('auditeeId', v)} />
        </FormField>
      </div>
    </SlideOver>
  );
};
