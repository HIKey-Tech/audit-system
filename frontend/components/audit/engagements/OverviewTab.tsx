'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowRight, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { engagementsApi } from '@/lib/api/audit';
import { workflowApi } from '@/lib/api/workflow';
import { formatDate, initialsFromName } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { statusMeaning } from '@/lib/utils/status';
import { usePermission } from '@/hooks/usePermission';
import type { AuditEngagementDetail } from '@/lib/types/domain';
import { ManageAssignmentsSlideOver } from './ManageAssignmentsSlideOver';

const NEXT_STATUS: Record<string, string | null> = {
  planned: 'in_progress',
  in_progress: 'under_review',
  under_review: 'reported',
  reported: 'closed',
  closed: null,
};

export const OverviewTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const canUpdateEngagement = usePermission('engagement:update');
  const canManageAssignments = usePermission('assignment:create') || usePermission('assignment:delete');
  const [showAssignments, setShowAssignments] = useState(false);

  const assignments = useQuery({
    queryKey: ['engagements', engagement.id, 'assignments'],
    queryFn: () => workflowApi.listByEngagement(engagement.id),
  });

  const next = NEXT_STATUS[engagement.status];

  const update = useMutation({
    mutationFn: (status: string) => engagementsApi.updateStatus(engagement.id, status),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const findingsBySeverity = (engagement.findings ?? []).reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const checklists = engagement.checklists ?? [];
  const passed = checklists.filter((c) => c.result === 'passed').length;
  const failed = checklists.filter((c) => c.result === 'failed').length;
  const tested = checklists.filter((c) => c.result !== 'not_tested').length;
  const total = checklists.length;
  const pct = total === 0 ? 0 : Math.round((tested / total) * 100);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {(() => {
        const m = statusMeaning('engagement', engagement.status);
        return (
          <div className="lg:col-span-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm text-text-primary">
              <span className="font-semibold">{m.label}.</span> {m.meaning}
            </p>
            {m.next && (
              <p className="mt-1 text-xs text-text-secondary">
                <span className="font-semibold text-primary">Next:</span> {m.next}
              </p>
            )}
          </div>
        );
      })()}
      <Card className="lg:col-span-2">
        <CardHeader
          title="Engagement details"
          subtitle={`Reference ${engagement.referenceNumber}`}
          action={
            canUpdateEngagement && next ? (
              <Button
                size="sm"
                leftIcon={<ArrowRight className="h-3.5 w-3.5" />}
                onClick={() => update.mutate(next)}
                isLoading={update.isPending}
              >
                Move to {humanizeStatus(next)}
              </Button>
            ) : null
          }
        />
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {engagement.description && (
            <div className="col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Description</dt>
              <dd className="mt-1 text-sm text-text-primary whitespace-pre-wrap">{engagement.description}</dd>
            </div>
          )}
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Type</dt>
            <dd className="mt-1"><Badge tone="gray">{humanizeStatus(engagement.auditType)}</Badge></dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Priority</dt>
            <dd className="mt-1"><StatusBadge status={engagement.priority} /></dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Status</dt>
            <dd className="mt-1"><StatusBadge status={engagement.status} /></dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Ad-hoc</dt>
            <dd className="mt-1 text-sm text-text-primary">{engagement.isAdhoc ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Lead auditor</dt>
            <dd className="mt-1 text-sm text-text-primary">{engagement.leadAuditorName}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Audit manager</dt>
            <dd className="mt-1 text-sm text-text-primary">{engagement.auditManagerName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Auditee</dt>
            <dd className="mt-1 text-sm text-text-primary">{engagement.auditeeName}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Auditable entity</dt>
            <dd className="mt-1 text-sm text-text-primary">{engagement.universeName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Start</dt>
            <dd className="mt-1 text-sm text-text-primary">{formatDate(engagement.plannedStartDate)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">End</dt>
            <dd className="mt-1 text-sm text-text-primary">{formatDate(engagement.plannedEndDate)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">SLA deadline</dt>
            <dd className="mt-1 text-sm text-text-primary">{formatDate(engagement.slaDeadline)}</dd>
          </div>
          {engagement.adhocReason && (
            <div className="col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Ad-hoc reason</dt>
              <dd className="mt-1 text-sm text-text-primary">{engagement.adhocReason}</dd>
            </div>
          )}
        </dl>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Findings" subtitle="By severity" />
          {(engagement.findings ?? []).length === 0 ? (
            <p className="text-xs text-text-muted">No findings raised yet.</p>
          ) : (
            <ul className="space-y-2">
              {(['critical', 'high', 'medium', 'low', 'informational'] as const).map((sev) => {
                const v = findingsBySeverity[sev] ?? 0;
                return (
                  <li key={sev} className="flex items-center justify-between text-xs">
                    <StatusBadge status={sev} size="xs" withDot />
                    <span className="font-semibold tabular-nums text-text-primary">{v}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Working papers" />
          <p className="text-3xl font-semibold tabular-nums text-text-primary">
            {engagement.workingPapers?.length ?? 0}
          </p>
          <p className="text-xs text-text-secondary mt-1">Total documents on file</p>
        </Card>

        <Card>
          <CardHeader title="Checklist" subtitle={`${tested}/${total} tested`} />
          <div className="flex items-center gap-4">
            <ProgressRing value={pct} />
            <div className="text-xs space-y-0.5">
              <p className="text-success">{passed} passed</p>
              <p className="text-danger">{failed} failed</p>
              <p className="text-text-muted">{total - tested} not tested</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Assigned staff"
            subtitle={`${assignments.data?.length ?? 0} active`}
            action={
              canManageAssignments ? (
                <Button size="sm" variant="secondary" onClick={() => setShowAssignments(true)}>
                  Manage
                </Button>
              ) : null
            }
          />
          {assignments.isLoading ? (
            <p className="text-xs text-text-muted">Loading…</p>
          ) : !assignments.data || assignments.data.length === 0 ? (
            <EmptyState compact icon={<Users className="h-4 w-4" />} title="No assignments yet" />
          ) : (
            <ul className="space-y-2">
              {assignments.data.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  <Avatar
                    initials={initialsFromName(undefined, undefined, a.userName)}
                    size="sm"
                    tone="slate"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{a.userName}</p>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      {humanizeStatus(a.role)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ManageAssignmentsSlideOver
        open={showAssignments}
        onClose={() => setShowAssignments(false)}
        engagement={engagement}
      />
    </div>
  );
};

const ProgressRing = ({ value }: { value: number }): JSX.Element => {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const colour =
    value >= 80 ? '#16A34A' : value >= 50 ? '#D97706' : value >= 1 ? '#2563EB' : '#94A3B8';
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden>
      <circle cx="30" cy="30" r={r} stroke="#E2E8F0" strokeWidth="6" fill="none" />
      <circle
        cx="30"
        cy="30"
        r={r}
        stroke={colour}
        strokeWidth="6"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 30 30)"
      />
      <text x="30" y="34" textAnchor="middle" className="fill-text-primary text-xs font-semibold">
        {value}%
      </text>
    </svg>
  );
};
