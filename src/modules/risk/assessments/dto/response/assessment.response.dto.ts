export interface RiskAssessmentUserResponseDto {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
}

export interface RiskAssessmentResponseDto {
  id: string;
  riskId: string;
  likelihood: number;
  impact: number;
  score: number;
  notes: string | null;
  assessedById: string;
  assessedBy?: RiskAssessmentUserResponseDto;
  assessedAt: string;
  createdAt: string;
}

const mapUserBrief = (user: {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
}): RiskAssessmentUserResponseDto => ({
  id: user.id,
  email: user.email,
  displayName: user.display_name,
  firstName: user.first_name,
  lastName: user.last_name,
});

export const mapRiskAssessmentToResponse = (assessment: {
  id: string;
  risk_id: string;
  likelihood: number;
  impact: number;
  score: number;
  notes: string | null;
  assessed_by_id: string;
  assessed_by?: {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string;
    last_name: string;
  };
  assessed_at: Date;
  created_at: Date;
}): RiskAssessmentResponseDto => ({
  id: assessment.id,
  riskId: assessment.risk_id,
  likelihood: assessment.likelihood,
  impact: assessment.impact,
  score: assessment.score,
  notes: assessment.notes,
  assessedById: assessment.assessed_by_id,
  assessedBy: assessment.assessed_by ? mapUserBrief(assessment.assessed_by) : undefined,
  assessedAt: assessment.assessed_at.toISOString(),
  createdAt: assessment.created_at.toISOString(),
});
