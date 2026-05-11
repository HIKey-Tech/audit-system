import { ReportTemplateSection, ReportTemplateVariable, WorkingPaperTemplateSection } from '../../domain/entity/settings.entity';
import { SettingsAuditType } from '../../domain/enum/settings.enum';
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
export declare const mapWorkingPaperTemplateToResponse: (template: {
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
}) => WorkingPaperTemplateResponseDto;
export declare const mapReportTemplateToResponse: (template: {
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
}) => ReportTemplateResponseDto;
export declare const mapSystemConfigToResponse: (config: {
    id: string;
    key: string;
    value: string | null;
    description: string | null;
    is_public: boolean;
    updated_by_id: string | null;
    created_at: Date;
    updated_at: Date;
}) => SystemConfigResponseDto;
//# sourceMappingURL=settings.response.dto.d.ts.map