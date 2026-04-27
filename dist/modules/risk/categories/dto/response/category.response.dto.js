"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapRiskCategoryToResponse = void 0;
const mapRiskCategoryToResponse = (category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    isActive: category.is_active,
    createdById: category.created_by_id,
    createdAt: category.created_at.toISOString(),
    updatedAt: category.updated_at.toISOString(),
});
exports.mapRiskCategoryToResponse = mapRiskCategoryToResponse;
//# sourceMappingURL=category.response.dto.js.map