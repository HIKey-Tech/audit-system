import { Plug } from 'lucide-react';
import { ComingSoon } from '@/components/common/ComingSoon';

export default function IntegrationsPage(): JSX.Element {
  return (
    <ComingSoon
      icon={Plug}
      title="Coming Soon: Integrations"
      description="Connect IAMS to GBB's internal systems including Dynafin, IMOC, Active Directory, Project Plus, and Shared Drive. Real-time data sync for financial audits, IT service records, and project data."
    />
  );
}
