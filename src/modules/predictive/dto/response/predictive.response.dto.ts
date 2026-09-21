export type PredictiveSeverityDto = 'low' | 'medium' | 'high' | 'critical';

export interface PredictiveRationaleResponseDto {
  code: string;
  label: string;
  value: string;
  weight: number;
}

export interface PredictiveInsightResponseDto {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  severity: PredictiveSeverityDto;
  score: number;
  title: string;
  summary: string;
  rationale: PredictiveRationaleResponseDto[];
  scoringVersion: string;
  generatedAt: string;
  actionUrl: string;
  feedback: 'useful' | 'not_useful' | 'dismissed' | null;
}

export interface PredictiveNextActionResponseDto {
  type: string;
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  dueAt: string | null;
  priority: 'high' | 'medium' | 'low';
  actionUrl: string;
}

export interface PredictiveOverviewResponseDto {
  generatedAt: string;
  mode: 'explainable_rules';
  dataReadiness: {
    snapshotCount: number;
    lastSnapshotAt: string | null;
    lastScoredAt: string | null;
    message: string;
  };
  insights: PredictiveInsightResponseDto[];
  nextActions: PredictiveNextActionResponseDto[];
}

export interface PredictiveRefreshResponseDto {
  generated: number;
  resolved: number;
  scoredAt: string;
}
