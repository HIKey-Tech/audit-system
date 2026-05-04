import { Brain } from 'lucide-react';
import { ComingSoon } from '@/components/common/ComingSoon';

export default function PredictivePage(): JSX.Element {
  return (
    <ComingSoon
      icon={Brain}
      title="Coming Soon: Predictive Analytics"
      description="AI-powered risk prediction, anomaly detection, and NLP analysis of audit evidence. This module learns from your audit history to surface insights and predict high-risk areas."
    />
  );
}
