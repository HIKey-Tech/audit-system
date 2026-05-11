"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSystemConfigToResponse = exports.mapReportTemplateToResponse = exports.mapWorkingPaperTemplateToResponse = void 0;
const settings_utility_1 = require("../../utility/settings.utility");
const mapWorkingPaperTemplateToResponse = (template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    auditType: template.audit_type,
    sections: (0, settings_utility_1.asWorkingPaperSections)(template.sections),
    isActive: template.is_active,
    isDefault: template.is_default,
    createdById: template.created_by_id,
    updatedById: template.updated_by_id,
    createdAt: template.created_at.toISOString(),
    updatedAt: template.updated_at.toISOString(),
    deletedAt: template.deleted_at?.toISOString() ?? null,
});
exports.mapWorkingPaperTemplateToResponse = mapWorkingPaperTemplateToResponse;
const mapReportTemplateToResponse = (template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    sections: (0, settings_utility_1.asReportSections)(template.sections),
    headerConfig: (0, settings_utility_1.parseNullableJson)(template.header_config),
    footerConfig: (0, settings_utility_1.parseNullableJson)(template.footer_config),
    signatureConfig: (0, settings_utility_1.parseNullableJson)(template.signature_config),
    availableVariables: (0, settings_utility_1.asReportVariables)(template.available_variables),
    isActive: template.is_active,
    isDefault: template.is_default,
    createdById: template.created_by_id,
    updatedById: template.updated_by_id,
    createdAt: template.created_at.toISOString(),
    updatedAt: template.updated_at.toISOString(),
    deletedAt: template.deleted_at?.toISOString() ?? null,
});
exports.mapReportTemplateToResponse = mapReportTemplateToResponse;
const mapSystemConfigToResponse = (config) => ({
    id: config.id,
    key: config.key,
    value: config.value,
    description: config.description,
    isPublic: config.is_public,
    updatedById: config.updated_by_id,
    createdAt: config.created_at.toISOString(),
    updatedAt: config.updated_at.toISOString(),
});
exports.mapSystemConfigToResponse = mapSystemConfigToResponse;
//# sourceMappingURL=settings.response.dto.js.map