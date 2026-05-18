'use client';

import { useState } from 'react';
import { Shield, FileText, BookOpen, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { RoleManagementTab } from '@/components/settings/roles/RoleManagementTab';
import { WorkingPaperTemplatesTab } from '@/components/settings/working-papers/WorkingPaperTemplatesTab';
import { ReportTemplatesTab } from '@/components/settings/reports/ReportTemplatesTab';
import { SystemConfigTab } from '@/components/settings/config/SystemConfigTab';

type TabKey = 'roles' | 'wp-templates' | 'report-templates' | 'config';

const TABS: TabItem[] = [
  { key: 'roles', label: <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Role Management</span> },
  { key: 'wp-templates', label: <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Working Paper Templates</span> },
  { key: 'report-templates', label: <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />Report Templates</span> },
  { key: 'config', label: <span className="flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />System Configuration</span> },
];

export default function SettingsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabKey>('roles');

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage roles, permissions, templates, and system configuration."
      />

      <Tabs
        tabs={TABS}
        active={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        className="mb-6"
      />

      {activeTab === 'roles' && <RoleManagementTab />}
      {activeTab === 'wp-templates' && <WorkingPaperTemplatesTab />}
      {activeTab === 'report-templates' && <ReportTemplatesTab />}
      {activeTab === 'config' && <SystemConfigTab />}
    </div>
  );
}
