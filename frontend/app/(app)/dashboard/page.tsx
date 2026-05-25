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
  const { dashboard, isAuditee } = usePermissions();

  const subtitle = isAuditee
    ? 'Your assigned findings and follow-up items.'
    : 'Start with what needs you — then the wider audit programme.';

  return (
    <div>
      <PageHeader title="Home" subtitle={subtitle} />

      <section className="space-y-6">
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

        {dashboard.recentActivity && <RecentActivity />}
      </section>
    </div>
  );
}
