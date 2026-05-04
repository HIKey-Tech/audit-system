'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { StatCards } from '@/components/dashboard/StatCards';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { FindingsBySeverity } from '@/components/dashboard/FindingsBySeverity';
import { MyWorkPanel } from '@/components/dashboard/MyWorkPanel';
import { TopRisksTable } from '@/components/dashboard/TopRisksTable';
import { EscalationsCard } from '@/components/dashboard/EscalationsCard';
import { usePermissions } from '@/lib/hooks/usePermissions';

export default function DashboardPage(): JSX.Element {
  const { dashboard, isAuditee, isExecutive } = usePermissions();

  const subtitle = isAuditee
    ? 'Your assigned findings and follow-up items.'
    : isExecutive
      ? 'Executive summary — engagements, findings, risks, and approvals.'
      : 'Audit programme at a glance — engagements, findings, risks, and approvals.';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={subtitle}
      />

      <section className="space-y-6">
        {/* Stat cards — only admin/exec/cae */}
        {dashboard.statCards && <StatCards />}

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Recent activity — not auditee */}
          {dashboard.recentActivity && (
            <div className={dashboard.myWork ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <RecentActivity />
            </div>
          )}
          {/* Findings by severity — admin/exec/field */}
          {dashboard.findingsBySeverity && (
            <div className="lg:col-span-1">
              <FindingsBySeverity />
            </div>
          )}
          {/* My Work — field auditors and auditees */}
          {dashboard.myWork && (
            <div className={dashboard.recentActivity ? 'lg:col-span-1' : 'lg:col-span-4'}>
              <MyWorkPanel />
            </div>
          )}
        </div>

        {/* Bottom row — top risks + escalations */}
        {(dashboard.topRisks || dashboard.escalations) && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {dashboard.topRisks && (
              <div className={dashboard.escalations ? 'lg:col-span-3' : 'lg:col-span-5'}>
                <TopRisksTable />
              </div>
            )}
            {dashboard.escalations && (
              <div className={dashboard.topRisks ? 'lg:col-span-2' : 'lg:col-span-5'}>
                <EscalationsCard />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

