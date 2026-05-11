import {
  ReportTemplateSection,
  ReportTemplateVariable,
  WorkingPaperTemplateSection,
} from '../../domain/entity/settings.entity';
import { SettingsAuditType } from '../../domain/enum/settings.enum';
import {
  asReportSections,
  asReportVariables,
  asWorkingPaperSections,
  parseNullableJson,
} from '../../utility/settings.utility';

export interface WorkingPaperTemplateResponseDto {
  id: string;
  name: string;
  description: string | null;
  auditType: SettingsAuditType;
  sections: WorkingPaperTemplateSection[];
  isActive: boolean;
  isDefault: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ReportTemplateResponseDto {
  id: string;
  name: string;
  description: string | null;
  sections: ReportTemplateSection[];
  headerConfig: unknown | null;
  footerConfig: unknown | null;
  signatureConfig: unknown | null;
  availableVariables: ReportTemplateVariable[];
  isActive: boolean;
  isDefault: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SystemConfigResponseDto {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  isPublic: boolean;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export const mapWorkingPaperTemplateToResponse = (template: {
  id: string;
  name: string;
  description: string | null;
  audit_type: string;
  sections: string;
  is_active: boolean;
  is_default: boolean;
  created_by_id: string | null;
  updated_by_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): WorkingPaperTemplateResponseDto => ({
  id: template.id,
  name: template.name,
  description: template.description,
  auditType: template.audit_type as SettingsAuditType,
  sections: asWorkingPaperSections(template.sections),
  isActive: template.is_active,
  isDefault: template.is_default,
  createdById: template.created_by_id,
  updatedById: template.updated_by_id,
  createdAt: template.created_at.toISOString(),
  updatedAt: template.updated_at.toISOString(),
  deletedAt: template.deleted_at?.toISOString() ?? null,
});

export const mapReportTemplateToResponse = (template: {
  id: string;
  name: string;
  description: string | null;
  sections: string;
  header_config: string | null;
  footer_config: string | null;
  signature_config: string | null;
  available_variables: string;
  is_active: boolean;
  is_default: boolean;
  created_by_id: string | null;
  updated_by_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): ReportTemplateResponseDto => ({
  id: template.id,
  name: template.name,
  description: template.description,
  sections: asReportSections(template.sections),
  headerConfig: parseNullableJson(template.header_config),
  footerConfig: parseNullableJson(template.footer_config),
  signatureConfig: parseNullableJson(template.signature_config),
  availableVariables: asReportVariables(template.available_variables),
  isActive: template.is_active,
  isDefault: template.is_default,
  createdById: template.created_by_id,
  updatedById: template.updated_by_id,
  createdAt: template.created_at.toISOString(),
  updatedAt: template.updated_at.toISOString(),
  deletedAt: template.deleted_at?.toISOString() ?? null,
});

export const mapSystemConfigToResponse = (config: {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  is_public: boolean;
  updated_by_id: string | null;
  created_at: Date;
  updated_at: Date;
}): SystemConfigResponseDto => ({
  id: config.id,
  key: config.key,
  value: config.value,
  description: config.description,
  isPublic: config.is_public,
  updatedById: config.updated_by_id,
  createdAt: config.created_at.toISOString(),
  updatedAt: config.updated_at.toISOString(),
});
