import { RiskAssessmentResponseDto, mapRiskAssessmentToResponse } from '../../../assessments/dto/response/assessment.response.dto';
import { RiskCategoryResponseDto, mapRiskCategoryToResponse } from '../../../categories/dto/response/category.response.dto';
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
    category?: RiskCategoryResponseDto;
    ownerId: string;
    owner?: RiskUserResponseDto;
    likelihood: number;
    impact: number;
    currentScore: number;
    status: string;
    lastAssessedAt: string | null;
    universeId: string | null;
    createdById: string;
    latestAssessment?: RiskAssessmentResponseDto | null;
    createdAt: string;
    updatedAt: string;
}
export declare const mapRiskRegisterToResponse: (risk: {
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
    created_by_id: string;
    assessments?: Array<Parameters<typeof mapRiskAssessmentToResponse>[0]>;
    created_at: Date;
    updated_at: Date;
}) => RiskRegisterResponseDto;
//# sourceMappingURL=register.response.dto.d.ts.map