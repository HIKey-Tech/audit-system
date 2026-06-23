'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
