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
import type { EscalationPolicy } from '@/lib/types/domain';

const AUDIT_TYPES = ['it', 'financial', 'compliance', 'all'];

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
                    key={t}
                    auditType={t}
                    policy={findPolicy(t)}
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
  const [l1, setL1] = useState(policy?.level1Hours ?? 24);
  const [l2, setL2] = useState(policy?.level2Hours ?? 48);
  const [l3, setL3] = useState(policy?.level3Hours ?? 72);
  const [l4, setL4] = useState(policy?.level4Hours ?? 96);

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-text-primary capitalize">{auditType}</td>
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
