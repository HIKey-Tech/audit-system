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
export declare const mapRiskAssessmentToResponse: (assessment: {
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
}) => RiskAssessmentResponseDto;
//# sourceMappingURL=assessment.response.dto.d.ts.map