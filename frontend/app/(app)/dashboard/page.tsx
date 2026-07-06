'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { evidenceRequestsApi } from '@/lib/api/audit';
import { formatDate } from '@/lib/utils/format';
import { StartAuditWizard } from '@/components/audit/engagements/StartAuditWizard';
import { PageHeader } from '@/components/ui/PageHeader';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { StatCards } from '@/components/dashboard/StatCards';
import { ProgrammeHealth } from '@/components/dashboard/ProgrammeHealth';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { FindingsBySeverity } from '@/components/dashboard/FindingsBySeverity';
import { MyWorkPanel } from '@/components/dashboard/MyWorkPanel';
import { TopRisksTable } from '@/components/dashboard/TopRisksTable';
import { RiskHeatMap } from '@/components/dashboard/RiskHeatMap';
import { EscalationsCard } from '@/components/dashboard/EscalationsCard';
import { usePermissions } from '@/lib/hooks/usePermissions';

export default function DashboardPage(): JSX.Element {
  const { dashboard, quickActions, isAuditee, canManageAuditProgramme } = usePermissions();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Outstanding documents the audit team is waiting on from this user.
  const myRequests = useQuery({
    queryKey: ['evidence-requests', 'mine'],
    queryFn: () => evidenceRequestsApi.mine(),
  });
  const outstanding = myRequests.data ?? [];

  const subtitle = isAuditee
    ? 'Your assigned findings and follow-up items.'
    : 'Start with what needs you — then the wider audit programme.';

  return (
    <div>
      <PageHeader
        title="Home"
        subtitle={subtitle}
        actions={
          canManageAuditProgramme ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setWizardOpen(true)}>
              Start audit
            </Button>
          ) : null
        }
      />

      <section className="space-y-6">
        {/* Auditees log in rarely — spell out what is expected of them. */}
        {isAuditee && (
          <Card padded>
            <p className="text-sm font-semibold text-text-primary">What you need to do here</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text-secondary">
              <li>
                Review any{' '}
                <Link href="/audit/findings" className="text-primary hover:underline">
                  findings
                </Link>{' '}
                assigned to you and submit your management response with a remediation plan.
              </li>
              <li>
                When you have fixed an issue, open the finding and upload your remediation evidence
                under Follow-up — the auditor will verify it.
              </li>
              <li>
                Upload any documents the audit team has requested from you — outstanding requests
                appear at the top of this page.
              </li>
              <li>
                Watch your{' '}
                <Link href="/notifications" className="text-primary hover:underline">
                  notifications
                </Link>{' '}
                for issued reports and deadlines.
              </li>
            </ol>
            <p className="mt-2 text-xs text-text-muted">
              New to the process?{' '}
              <Link href="/help" className="text-primary hover:underline">
                See how IAMS works
              </Link>
              .
            </p>
          </Card>
        )}

        {/* Documents the audit team has requested from this user */}
        {outstanding.length > 0 && (
          <Card padded>
            <div className="flex items-center gap-2">
              <FileUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-text-primary">
                Documents requested from you ({outstanding.length})
              </p>
            </div>
            <ul className="mt-2 divide-y divide-border">
              {outstanding.slice(0, 5).map((r) => {
                const overdue = r.dueDate && new Date(r.dueDate) < new Date();
                return (
                  <li key={r.id} className="py-2">
                    <Link
                      href={`/audit/engagements/${r.engagementId}?tab=requests`}
                      className="group flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text-primary group-hover:text-primary">
                          {r.title}
                        </span>
                        <span className="text-xs text-text-muted">
                          {r.engagementReference} — {r.engagementTitle}
                        </span>
                      </span>
                      <span className={overdue ? 'text-xs font-semibold text-danger' : 'text-xs text-text-secondary'}>
                        {r.dueDate ? `Due ${formatDate(r.dueDate)}${overdue ? ' — overdue' : ''}` : 'No deadline'}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {/* Quick actions — permission-gated shortcuts */}
        {quickActions.length > 0 && (
          <QuickActions onStartAudit={() => setWizardOpen(true)} />
        )}

        {/* Task-first: what needs you right now */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={dashboard.findingsBySeverity ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <MyWorkPanel />
          </div>
          {dashboard.findingsBySeverity && (
            <div className="lg:col-span-1">
              <FindingsBySeverity />
            </div>
          )}
        </div>

        {/* Programme overview — oversight roles only */}
        {dashboard.statCards && <StatCards />}
        {dashboard.programmeHealth && <ProgrammeHealth />}

        {/* Risk posture — heat map + top risks */}
        {(dashboard.riskHeatMap || dashboard.topRisks) && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {dashboard.riskHeatMap && (
              <div className={dashboard.topRisks ? 'lg:col-span-2' : 'lg:col-span-5'}>
                <RiskHeatMap />
              </div>
            )}
            {dashboard.topRisks && (
              <div className={dashboard.riskHeatMap ? 'lg:col-span-3' : 'lg:col-span-5'}>
                <TopRisksTable />
              </div>
            )}
          </div>
        )}

        {/* Escalations + activity feed */}
        {(dashboard.escalations || dashboard.recentActivity) && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {dashboard.escalations && (
              <div className={dashboard.recentActivity ? 'lg:col-span-2' : 'lg:col-span-5'}>
                <EscalationsCard />
              </div>
            )}
            {dashboard.recentActivity && (
              <div className={dashboard.escalations ? 'lg:col-span-3' : 'lg:col-span-5'}>
                <RecentActivity />
              </div>
            )}
          </div>
        )}
      </section>

      <StartAuditWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
