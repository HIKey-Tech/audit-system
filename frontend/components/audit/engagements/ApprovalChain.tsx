'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, X, Clock } from 'lucide-react';
import { workflowApi } from '@/lib/api/workflow';
import type { ResolvedApprovalLevel } from '@/lib/types/domain';

const peopleLabel = (lvl: ResolvedApprovalLevel): string => {
  if (lvl.resolvedApprover) return lvl.resolvedApprover.displayName;
  if (lvl.candidates.length === 0) return 'No eligible approver configured';
  if (lvl.candidates.length === 1) return lvl.candidates[0].displayName;
  return `any of ${lvl.candidates.map((c) => c.displayName).join(', ')}`;
};

const statusIcon = (s: ResolvedApprovalLevel['status']): JSX.Element => {
  if (s === 'approved') return <Check className="h-3.5 w-3.5 text-emerald-600" />;
  if (s === 'rejected') return <X className="h-3.5 w-3.5 text-danger" />;
  if (s === 'pending') return <Clock className="h-3.5 w-3.5 text-primary" />;
  return <Clock className="h-3.5 w-3.5 text-text-muted" />;
};

export const ApprovalChain = ({ entityType, entityId }: { entityType: string; entityId: string }): JSX.Element => {
  const { data, isLoading } = useQuery({
    queryKey: ['approval-chain', entityType, entityId],
    queryFn: () => workflowApi.getApprovalChain(entityType, entityId),
    enabled: Boolean(entityId),
  });

  if (isLoading || !data) return <p className="text-xs text-text-muted">Loading approval chain…</p>;
  if (data.levels.length === 0) return <p className="text-xs text-text-muted">No approval chain configured.</p>;

  return (
    <ol className="space-y-1.5">
      {data.levels.map((lvl) => (
        <li key={lvl.level} className="flex items-center gap-2 text-sm">
          {statusIcon(lvl.status)}
          <span className="font-medium text-text-primary">{peopleLabel(lvl)}</span>
          {lvl.status === 'pending' && <span className="text-[11px] text-primary">· awaiting</span>}
          {lvl.status === 'approved' && <span className="text-[11px] text-emerald-600">· signed</span>}
          {lvl.status === 'rejected' && <span className="text-[11px] text-danger">· rejected</span>}
        </li>
      ))}
    </ol>
  );
};
