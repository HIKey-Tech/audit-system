'use client';

import { Shield, FileText, BookOpen, SlidersHorizontal, Workflow, ListChecks, Network } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { useQueryFilters } from '@/lib/hooks/useQueryFilters';
import { RoleManagementTab } from '@/components/settings/roles/RoleManagementTab';
import { WorkingPaperTemplatesTab } from '@/components/settings/working-papers/WorkingPaperTemplatesTab';
import { ReportTemplatesTab } from '@/components/settings/reports/ReportTemplatesTab';
import { ChecklistTemplatesTab } from '@/components/settings/checklists/ChecklistTemplatesTab';
import { SystemConfigTab } from '@/components/settings/config/SystemConfigTab';
import { AuditCustomizationTab } from '@/components/settings/customization/AuditCustomizationTab';
import { DirectoryMappingsTab } from '@/components/settings/directory/DirectoryMappingsTab';

type TabKey = 'roles' | 'wp-templates' | 'report-templates' | 'checklist-templates' | 'customization' | 'directory' | 'config';

const TABS: TabItem[] = [
  { key: 'roles', label: <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Role Management</span> },
  { key: 'wp-templates', label: <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Working Paper Templates</span> },
  { key: 'report-templates', label: <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />Review Templates</span> },
  { key: 'checklist-templates', label: <span className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" />Checklist Templates</span> },
  { key: 'customization', label: <span className="flex items-center gap-1.5"><Workflow className="h-3.5 w-3.5" />Audit Customization</span> },
  { key: 'directory', label: <span className="flex items-center gap-1.5"><Network className="h-3.5 w-3.5" />Directory</span> },
  { key: 'config', label: <span className="flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />System Configuration</span> },
];

const TAB_KEYS = TABS.map((t) => t.key) as TabKey[];

export default function SettingsPage(): JSX.Element {
  // Tab in the URL so an admin can link a colleague straight to a settings area.
  const { values, set } = useQueryFilters({ tab: 'roles' });
  const activeTab = (TAB_KEYS.includes(values.tab as TabKey) ? values.tab : 'roles') as TabKey;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage roles, permissions, templates, and system configuration."
      />

      <Tabs
        tabs={TABS}
        active={activeTab}
        onChange={(key) => set({ tab: key })}
        className="mb-6"
      />

      {activeTab === 'roles' && <RoleManagementTab />}
      {activeTab === 'wp-templates' && <WorkingPaperTemplatesTab />}
      {activeTab === 'report-templates' && <ReportTemplatesTab />}
      {activeTab === 'checklist-templates' && <ChecklistTemplatesTab />}
      {activeTab === 'customization' && <AuditCustomizationTab />}
      {activeTab === 'directory' && <DirectoryMappingsTab />}
      {activeTab === 'config' && <SystemConfigTab />}
    </div>
  );
}
