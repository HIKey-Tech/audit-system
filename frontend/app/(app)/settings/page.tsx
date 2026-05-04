import { Settings } from 'lucide-react';
import { ComingSoon } from '@/components/common/ComingSoon';

export default function SettingsPage(): JSX.Element {
  return (
    <ComingSoon
      icon={Settings}
      title="Coming Soon: Settings"
      description="System configuration, user management, role administration, and IAMS platform settings."
    />
  );
}
