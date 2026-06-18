'use client';

import Link from 'next/link';
import { Check, ArrowRight, Info } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { engagementsApi } from '@/lib/api/audit';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { AuditEngagementDetail } from '@/lib/types/domain';

interface Blocker {
  text: string;
  /** When true, this row is the current viewer's own action. */
  mine?: boolean;
  action?: React.ReactNode;
}

export const WhatsNextPanel = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('engagement:update');

  const startFieldwork = useMutation({
    mutationFn: () => engagementsApi.updateStatus(engagement.id, 'in_progress'),
    onSuccess: () => {
      toast.success('Fieldwork started');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to start fieldwork'),
  });

  const blockers = buildBlockers(engagement, { canManage, startFieldwork });

  return (
    <Card className="p-0 border-0 shadow-none bg-transparent">
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
        <Info className="h-3.5 w-3.5 text-primary" /> What&apos;s next
      </h4>
      {blockers.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Nothing is blocking this engagement — it advances automatically as work completes.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {blockers.map((b, i) => (
            <li
              key={i}
              className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm ${
                b.mine ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface'
              }`}
            >
              <span className="flex items-center gap-2 text-text-primary">
                <ArrowRight className="h-3.5 w-3.5 text-text-muted" /> {b.text}
              </span>
              {b.action}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

function buildBlockers(
  e: AuditEngagementDetail,
  ctx: { canManage: boolean; startFieldwork: { mutate: () => void; isPending: boolean } },
): Blocker[] {
  const lead = e.leadAuditorName ?? 'the lead auditor';
  const manager = e.auditManagerName ?? 'the audit manager';

  switch (e.status) {
    case 'planned':
      return [
        {
          text: `Fieldwork hasn't started yet — ${lead} starts it when the team is ready.`,
          mine: ctx.canManage,
          action: ctx.canManage ? (
            <Button size="sm" onClick={() => ctx.startFieldwork.mutate()} isLoading={ctx.startFieldwork.isPending}>
              Start fieldwork
            </Button>
          ) : undefined,
        },
      ];
    case 'in_progress': {
      const cp = e.checklistProgress;
      const tested = (cp?.total ?? 0) - (cp?.notTested ?? 0);
      const wp = e.workingPaperStats;
      const out: Blocker[] = [];
      if ((cp?.total ?? 0) === 0 || (cp?.notTested ?? 0) > 0) {
        out.push({ text: `${lead} to finish testing controls (${tested}/${cp?.total ?? 0} done).` });
      }
      if ((wp?.total ?? 0) === 0) {
        out.push({ text: `${lead} to create at least one working paper.` });
      } else if ((wp?.approved ?? 0) < (wp?.total ?? 0)) {
        out.push({ text: `${manager} to approve working papers (${wp?.approved ?? 0}/${wp?.total ?? 0} approved).` });
      }
      if (out.length === 0) out.push({ text: 'Fieldwork complete — moving to Quality Review.' });
      return out;
    }
    case 'under_review': {
      const rs = e.reportStatus ?? null;
      if (!rs) return [{ text: `${lead} to draft the audit report.` }];
      if (rs === 'draft' || rs === 'rejected') return [{ text: `${lead} to submit the report for sign-off.` }];
      if (rs === 'submitted') return [{ text: `Report awaiting sign-off — see the approval chain on the Report tab.` }];
      if (rs === 'approved') {
        return [
          {
            text: 'Report approved and ready to issue to the auditee.',
            action: (
              <Link href={`/audit/engagements/${e.id}?tab=report`}>
                <Button size="sm" variant="secondary">Go to report</Button>
              </Link>
            ),
          },
        ];
      }
      return [{ text: 'Report issued — moving to Reporting.' }];
    }
    case 'reported': {
      const fs = e.findingStats;
      const unresolved = fs?.unresolved ?? 0;
      if ((fs?.total ?? 0) === 0) return [{ text: 'No findings to remediate.' }];
      if (unresolved > 0) {
        return [{ text: `${unresolved} of ${fs?.total} findings still need remediation and closure sign-off.` }];
      }
      return [{ text: 'All findings closed — engagement is closing.' }];
    }
    case 'closed':
    default:
      return [];
  }
}
