export interface RiskCategoryResponseDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export const mapRiskCategoryToResponse = (category: {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}): RiskCategoryResponseDto => ({
  id: category.id,
  name: category.name,
  description: category.description,
  isActive: category.is_active,
  createdById: category.created_by_id,
  createdAt: category.created_at.toISOString(),
  updatedAt: category.updated_at.toISOString(),
});
