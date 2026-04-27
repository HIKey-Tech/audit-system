export interface RiskCategoryResponseDto {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdById: string;
    createdAt: string;
    updatedAt: string;
}
export declare const mapRiskCategoryToResponse: (category: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
}) => RiskCategoryResponseDto;
//# sourceMappingURL=category.response.dto.d.ts.map