import {
  RiskAssessmentResponseDto,
  mapRiskAssessmentToResponse,
} from '../../../assessments/dto/response/assessment.response.dto';
import {
  RiskCategoryResponseDto,
  mapRiskCategoryToResponse,
} from '../../../categories/dto/response/category.response.dto';

export interface RiskUserResponseDto {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
}

export interface RiskRegisterResponseDto {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string | null;
  category?: RiskCategoryResponseDto;
  ownerId: string;
  ownerName: string | null;
  owner?: RiskUserResponseDto;
  likelihood: number;
  impact: number;
  // Flat aliases the frontend reads (Risk type uses currentLikelihood/currentImpact).
  currentLikelihood: number;
  currentImpact: number;
  currentScore: number;
  status: string;
  lastAssessedAt: string | null;
  universeId: string | null;
  universeName: string | null;
  createdById: string;
  latestAssessment?: RiskAssessmentResponseDto | null;
  createdAt: string;
  updatedAt: string;
}

const mapRiskUserToResponse = (user: {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
  department: string | null;
  job_title: string | null;
}): RiskUserResponseDto => ({
  id: user.id,
  email: user.email,
  displayName: user.display_name,
  firstName: user.first_name,
  lastName: user.last_name,
  department: user.department,
  jobTitle: user.job_title,
});

export const mapRiskRegisterToResponse = (risk: {
  id: string;
  title: string;
  description: string;
  category_id: string;
  category?: Parameters<typeof mapRiskCategoryToResponse>[0];
  owner_id: string;
  owner?: {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string;
    last_name: string;
    department: string | null;
    job_title: string | null;
  };
  likelihood: number;
  impact: number;
  current_score: number;
  status: string;
  last_assessed_at: Date | null;
  universe_id: string | null;
  universe?: {
    id: string;
    name: string;
  } | null;
  created_by_id: string;
  assessments?: Array<Parameters<typeof mapRiskAssessmentToResponse>[0]>;
  created_at: Date;
  updated_at: Date;
}): RiskRegisterResponseDto => ({
  id: risk.id,
  title: risk.title,
  description: risk.description,
  categoryId: risk.category_id,
  categoryName: risk.category?.name ?? null,
  category: risk.category ? mapRiskCategoryToResponse(risk.category) : undefined,
  ownerId: risk.owner_id,
  ownerName: risk.owner
    ? risk.owner.display_name ?? `${risk.owner.first_name} ${risk.owner.last_name}`.trim()
    : null,
  owner: risk.owner ? mapRiskUserToResponse(risk.owner) : undefined,
  likelihood: risk.likelihood,
  impact: risk.impact,
  currentLikelihood: risk.likelihood,
  currentImpact: risk.impact,
  currentScore: risk.current_score,
  status: risk.status,
  lastAssessedAt: risk.last_assessed_at?.toISOString() ?? null,
  universeId: risk.universe_id,
  universeName: risk.universe?.name ?? null,
  createdById: risk.created_by_id,
  latestAssessment: risk.assessments?.[0]
    ? mapRiskAssessmentToResponse(risk.assessments[0])
    : risk.assessments
      ? null
      : undefined,
  createdAt: risk.created_at.toISOString(),
  updatedAt: risk.updated_at.toISOString(),
});
