'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Users } from 'lucide-react';

import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { workflowApi } from '@/lib/api/workflow';
import { formatDate, initialsFromName } from '@/lib/utils/format';
import { humanizeStatus } from '@/lib/utils/status';
import { statusMeaning } from '@/lib/utils/status';
import { usePermission } from '@/hooks/usePermission';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { AuditEngagementDetail } from '@/lib/types/domain';
import { ManageAssignmentsSlideOver } from './ManageAssignmentsSlideOver';
import { TimeTrackingCard } from './TimeTrackingCard';

export const OverviewTab = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const { user } = usePermissions();
  const canManageAssignments = usePermission('assignment:create') || usePermission('assignment:delete');
  const [showAssignments, setShowAssignments] = useState(false);

  const assignments = useQuery({
    queryKey: ['engagements', engagement.id, 'assignments'],
    queryFn: () => workflowApi.listByEngagement(engagement.id),
  });

  const myAssignment = assignments.data?.find((a) => a.userId === user.id);
  const isOnlyAssigned =
    myAssignment != null &&
    engagement.leadAuditorId !== user.id &&
    engagement.auditManagerId !== user.id &&
    engagement.auditeeId !== user.id;

  // Metrics come from aggregates on the detail payload — the full arrays are
  // fetched lazily per-tab and are not present here.
  const findingsBySeverity = (engagement.findingCounts ?? []).reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + f.count;
      return acc;
    },
    {} as Record<string, number>,
  );
  const hasFindings = (engagement.findingStats?.total ?? 0) > 0;

  const progress = engagement.checklistProgress;
  const passed = progress?.passed ?? 0;
  const failed = progress?.failed ?? 0;
  const total = progress?.total ?? 0;
  const tested = total - (progress?.notTested ?? 0);
  const pct = total === 0 ? 0 : Math.round((tested / total) * 100);
  const workingPaperTotal = engagement.workingPaperStats?.total ?? engagement.workingPaperCount ?? 0;

  // Unified team: the three core roles plus any supporting assignees (deduped).
  const coreIds = new Set(
    [engagement.leadAuditorId, engagement.auditManagerId, engagement.auditeeId].filter(Boolean),
  );
  const team: { key: string; name: string; role: string }[] = [
    ...(engagement.leadAuditorName ? [{ key: 'lead', name: engagement.leadAuditorName, role: 'Lead Auditor' }] : []),
    ...(engagement.auditManagerName ? [{ key: 'manager', name: engagement.auditManagerName, role: 'Audit Manager' }] : []),
    ...(engagement.auditeeName ? [{ key: 'auditee', name: engagement.auditeeName, role: 'Auditee' }] : []),
    ...(assignments.data ?? [])
      .filter((a) => !coreIds.has(a.userId))
      .map((a) => ({ key: a.id, name: a.userName, role: humanizeStatus(a.role) })),
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {isOnlyAssigned && myAssignment && (
        <div className="col-span-full rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            You are assigned as{' '}
            <span className="font-semibold">
              {humanizeStatus(myAssignment.role)}
            </span>{' '}
            on this engagement.
          </p>
        </div>
      )}
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
          {!hasFindings ? (
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
            {workingPaperTotal}
          </p>
          <p className="text-xs text-text-secondary mt-1">Total documents on file</p>
        </Card>

        {engagement.viewerContext?.role !== 'auditee' && (
          <TimeTrackingCard
            engagementId={engagement.id}
            isClosed={engagement.status === 'closed'}
          />
        )}

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
            title="Team"
            subtitle={`${team.length} ${team.length === 1 ? 'member' : 'members'}`}
            action={
              canManageAssignments ? (
                <Button size="sm" variant="secondary" onClick={() => setShowAssignments(true)}>
                  Manage
                </Button>
              ) : null
            }
          />
          {team.length === 0 ? (
            <EmptyState compact icon={<Users className="h-4 w-4" />} title="No team assigned yet" />
          ) : (
            <ul className="space-y-2">
              {team.map((m) => (
                <li key={m.key} className="flex items-center gap-2 text-xs">
                  <Avatar
                    initials={initialsFromName(undefined, undefined, m.name)}
                    size="sm"
                    tone="slate"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text-primary">{m.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      {m.role}
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
