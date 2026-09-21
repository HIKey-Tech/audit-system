import { api } from '../api-client';

export type PredictiveSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PredictiveFeedback = 'useful' | 'not_useful' | 'dismissed';

export interface PredictiveRationale {
  code: string;
  label: string;
  value: string;
  weight: number;
}

export interface PredictiveInsight {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  severity: PredictiveSeverity;
  score: number;
  title: string;
  summary: string;
  rationale: PredictiveRationale[];
  scoringVersion: string;
  generatedAt: string;
  actionUrl: string;
  feedback: PredictiveFeedback | null;
}

export interface PredictiveNextAction {
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  dueAt: string | null;
  priority: 'high' | 'medium' | 'low';
  actionUrl: string;
}

export interface PredictiveOverview {
  generatedAt: string;
  mode: 'explainable_rules';
  dataReadiness: {
    snapshotCount: number;
    lastSnapshotAt: string | null;
    lastScoredAt: string | null;
    message: string;
  };
  insights: PredictiveInsight[];
  nextActions: PredictiveNextAction[];
}

export const predictiveApi = {
  getOverview: () => api.get<PredictiveOverview>('/predictive/overview'),
  recordFeedback: (insightId: string, feedback: PredictiveFeedback) =>
    api.post<void>(`/predictive/insights/${insightId}/feedback`, { feedback }),
};
