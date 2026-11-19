'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { workflowApi } from '@/lib/api/workflow';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { SELECTABLE_AUDIT_TYPES, auditTypeLabel } from '@/lib/audit-domains';
import type { EscalationPolicy } from '@/lib/types/domain';

const AUDIT_TYPES = [...SELECTABLE_AUDIT_TYPES.map((t) => t.value), 'all'];

// What the server uses when nothing has been saved (escalation.service DEFAULT_THRESHOLDS).
const SYSTEM_DEFAULT = { level1Hours: 24, level2Hours: 72, level3Hours: 120, level4Hours: 168 };

export default function EscalationPoliciesPage(): JSX.Element | null {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const allowed = hasPermission('escalation_policy:read');

  const qc = useQueryClient();
  const policies = useQuery({
    queryKey: ['workflow', 'policies'],
    queryFn: () => workflowApi.listPolicies(),
    enabled: allowed,
  });

  const upsert = useMutation({
    mutationFn: workflowApi.upsertPolicy,
    onSuccess: () => {
      toast.success('Policy saved');
      qc.invalidateQueries({ queryKey: ['workflow', 'policies'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  // Defence in depth: the nav hides this for users without the permission, but
  // guard direct URL access too.
  useEffect(() => {
    if (!allowed) router.replace('/workflow/approvals');
  }, [allowed, router]);

  if (!allowed) return null;

  const findPolicy = (auditType: string): EscalationPolicy | undefined =>
    policies.data?.find((p) => p.auditType === auditType);

  return (
    <div>
      <PageHeader title="Escalation policies" subtitle="Wait times before escalation per audit type." />

      <Card className="mb-4">
        <div className="space-y-2 text-sm text-text-secondary">
          <p className="font-medium text-text-primary">How escalation works</p>
          <p>
            <span className="font-medium text-text-primary">Audit past its OLA deadline.</span> Step 1 goes to the
            people in charge of that audit (its lead auditor and audit manager). Steps 2, 3 and 4 go to the Head of
            Internal Audit. A sole auditor&apos;s audit goes to the Head of Internal Audit at every step. Uses the row
            for the audit&apos;s type; a type with nothing saved uses the All row.
          </p>
          <p>
            <span className="font-medium text-text-primary">Approval waiting in someone&apos;s inbox.</span> Step 1
            reminds the person who has to approve. Steps 2, 3 and 4 go to the Head of Internal Audit. Approvals always
            use the All row.
          </p>
          <p>
            Hours count from the OLA deadline (or from when the approval arrived) for step 1, and from the previous step
            for each step after that. Nothing is sent after step 4.
          </p>
        </div>
      </Card>

      {policies.isLoading ? (
        <Card>
          <Skeleton className="h-12 w-full" />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="px-5 pt-5 pb-3">
            <CardHeader title="Escalation policies" subtitle="Wait times before escalation per audit type" className="mb-0" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-alt">
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-secondary">
                  <th className="px-4 py-3">Audit type</th>
                  <th className="px-4 py-3">L1 (h)</th>
                  <th className="px-4 py-3">L2 (h)</th>
                  <th className="px-4 py-3">L3 (h)</th>
                  <th className="px-4 py-3">L4 (h)</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {AUDIT_TYPES.map((t) => (
                  <PolicyRow
                    key={`${t}-${findPolicy(t)?.updatedAt ?? ''}-${findPolicy('all')?.updatedAt ?? ''}`}
                    auditType={t}
                    policy={findPolicy(t) ?? (t === 'all' ? undefined : findPolicy('all'))}
                    onSave={(dto) => upsert.mutate(dto)}
                    isSaving={upsert.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

const PolicyRow = ({
  auditType,
  policy,
  onSave,
  isSaving,
}: {
  auditType: string;
  policy?: EscalationPolicy;
  onSave: (dto: { auditType: string; level1Hours: number; level2Hours: number; level3Hours: number; level4Hours: number }) => void;
  isSaving: boolean;
}): JSX.Element => {
  const [l1, setL1] = useState(policy?.level1Hours ?? SYSTEM_DEFAULT.level1Hours);
  const [l2, setL2] = useState(policy?.level2Hours ?? SYSTEM_DEFAULT.level2Hours);
  const [l3, setL3] = useState(policy?.level3Hours ?? SYSTEM_DEFAULT.level3Hours);
  const [l4, setL4] = useState(policy?.level4Hours ?? SYSTEM_DEFAULT.level4Hours);

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-text-primary">
        {auditType === 'all' ? 'All (and every approval)' : auditTypeLabel(auditType)}
      </td>
      <td className="px-4 py-3"><Input type="number" value={l1} onChange={(e) => setL1(Number(e.target.value))} className="w-24 h-8" /></td>
      <td className="px-4 py-3"><Input type="number" value={l2} onChange={(e) => setL2(Number(e.target.value))} className="w-24 h-8" /></td>
      <td className="px-4 py-3"><Input type="number" value={l3} onChange={(e) => setL3(Number(e.target.value))} className="w-24 h-8" /></td>
      <td className="px-4 py-3"><Input type="number" value={l4} onChange={(e) => setL4(Number(e.target.value))} className="w-24 h-8" /></td>
      <td className="px-4 py-3 text-right">
        <Button
          size="sm"
          isLoading={isSaving}
          onClick={() =>
            onSave({ auditType, level1Hours: l1, level2Hours: l2, level3Hours: l3, level4Hours: l4 })
          }
        >
          Save
        </Button>
      </td>
    </tr>
  );
};
