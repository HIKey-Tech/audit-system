'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SlideOver } from '@/components/ui/SlideOver';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { UserSelect } from '@/components/common/UserSelect';
import { engagementsApi } from '@/lib/api/audit';
import { systemAuditApi, type SecurityTest, type SecurityTestType } from '@/lib/api/system-audit';
import { SECURITY_TEST_TYPE_LABELS } from '@/lib/system-audit';

const toDateInput = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : '');

const EMPTY = {
  title: '',
  testType: 'penetration_test' as SecurityTestType,
  provider: '',
  providerType: 'external' as 'internal' | 'external',
  scope: '',
  rulesOfEngagement: '',
  plannedStart: '',
  plannedEnd: '',
  coordinatorId: '',
  engagementId: '',
  notes: '',
};

/** Plan a new security test, or edit one (changing agreed terms voids an authorisation). */
export const SecurityTestFormSlideOver = ({
  open,
  onClose,
  test,
}: {
  open: boolean;
  onClose: () => void;
  test?: SecurityTest;
}): JSX.Element => {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      test
        ? {
            title: test.title,
            testType: test.testType,
            provider: test.provider,
            providerType: test.providerType,
            scope: test.scope,
            rulesOfEngagement: test.rulesOfEngagement ?? '',
            plannedStart: toDateInput(test.plannedStart),
            plannedEnd: toDateInput(test.plannedEnd),
            coordinatorId: test.coordinator?.id ?? '',
            engagementId: test.engagement?.id ?? '',
            notes: test.notes ?? '',
          }
        : EMPTY,
    );
  }, [open, test]);

  const engagements = useQuery({
    queryKey: ['engagements', 'sectest-picker'],
    queryFn: () => engagementsApi.list({ pageSize: 100 }),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        testType: form.testType,
        provider: form.provider.trim(),
        providerType: form.providerType,
        scope: form.scope.trim(),
        rulesOfEngagement: form.rulesOfEngagement.trim() || null,
        plannedStart: new Date(`${form.plannedStart}T08:00:00`).toISOString(),
        plannedEnd: new Date(`${form.plannedEnd}T18:00:00`).toISOString(),
        coordinatorId: form.coordinatorId || undefined,
        engagementId: form.engagementId || null,
        notes: form.notes.trim() || null,
      };
      return test ? systemAuditApi.updateSecurityTest(test.id, payload) : systemAuditApi.createSecurityTest(payload);
    },
    onSuccess: (saved) => {
      toast.success(test ? 'Security test updated' : `${saved.reference} planned — it needs authorisation before testing starts`);
      qc.invalidateQueries({ queryKey: ['system-audit'] });
      onClose();
      if (!test) router.push(`/system-audit/security-tests/${saved.id}`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save the security test'),
  });

  const submit = (): void => {
    const missing = [
      !form.title.trim() && 'title',
      !form.provider.trim() && 'provider',
      !form.scope.trim() && 'scope',
      !form.plannedStart && 'start date',
      !form.plannedEnd && 'end date',
    ].filter(Boolean);
    if (missing.length) return void toast.error(`Complete the ${missing.join(', ')}`);
    if (form.plannedEnd < form.plannedStart) return void toast.error('The end date must be on or after the start date');
    save.mutate();
  };

  const set = (key: keyof typeof EMPTY, value: string): void => setForm((f) => ({ ...f, [key]: value }));

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={test ? `Edit ${test.reference}` : 'Plan security test'}
      description={test?.status === 'authorised' ? 'Changing the scope, schedule, provider, or rules of engagement voids the current authorisation.' : 'Vulnerability assessments and penetration tests must be authorised before they start.'}
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} isLoading={save.isPending}>{test ? 'Save changes' : 'Plan test'}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Title" required>
          <Input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="e.g. External penetration test — internet perimeter" />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Test type" required>
            <Select value={form.testType} onChange={(e) => set('testType', e.target.value)}>
              {Object.entries(SECURITY_TEST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </FormField>
          <FormField label="Performed by" required>
            <Select value={form.providerType} onChange={(e) => set('providerType', e.target.value)}>
              <option value="external">External provider</option>
              <option value="internal">Internal team</option>
            </Select>
          </FormField>
          <FormField label="Provider / team" required>
            <Input value={form.provider} maxLength={200} onChange={(e) => set('provider', e.target.value)} />
          </FormField>
          <FormField label="Coordinator" optional hint="Defaults to you">
            <UserSelect value={form.coordinatorId} onChange={(v) => set('coordinatorId', v)} placeholder="Me" />
          </FormField>
          <FormField label="Planned start" required>
            <Input type="date" value={form.plannedStart} onChange={(e) => set('plannedStart', e.target.value)} />
          </FormField>
          <FormField label="Planned end" required>
            <Input type="date" value={form.plannedEnd} onChange={(e) => set('plannedEnd', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Scope" required hint="Systems, IP ranges, applications in scope — and anything explicitly out of scope">
          <Textarea rows={4} value={form.scope} onChange={(e) => set('scope', e.target.value)} />
        </FormField>
        <FormField label="Rules of engagement" optional hint="Testing windows, prohibited techniques, contacts, stop conditions">
          <Textarea rows={4} value={form.rulesOfEngagement} onChange={(e) => set('rulesOfEngagement', e.target.value)} />
        </FormField>
        <FormField label="Engagement" optional>
          <Select value={form.engagementId} onChange={(e) => set('engagementId', e.target.value)}>
            <option value="">Not linked to an engagement</option>
            {engagements.data?.items.map((e) => <option key={e.id} value={e.id}>{e.referenceNumber} — {e.title}</option>)}
          </Select>
        </FormField>
        <FormField label="Notes" optional>
          <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </FormField>
      </div>
    </SlideOver>
  );
};
