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
      {data.levels.map((lvl) => {
        const approver = lvl.resolvedApprover || (lvl.candidates.length === 1 ? lvl.candidates[0] : null);
        return (
          <li key={lvl.level} className="flex items-center gap-2 text-sm">
            <span className="shrink-0">{statusIcon(lvl.status)}</span>
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
              {approver ? (
                <>
                  <span className="font-semibold text-text-primary">{approver.displayName}</span>
                  {approver.jobTitle && (
                    <span className="text-xs text-text-secondary">({approver.jobTitle})</span>
                  )}
                </>
              ) : (
                <span className="font-medium text-text-primary">{peopleLabel(lvl)}</span>
              )}
            </div>
            {lvl.status === 'pending' && <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-primary">· awaiting</span>}
            {lvl.status === 'approved' && <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-emerald-600">· signed</span>}
            {lvl.status === 'rejected' && <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-danger">· rejected</span>}
          </li>
        );
      })}
    </ol>
  );
};
