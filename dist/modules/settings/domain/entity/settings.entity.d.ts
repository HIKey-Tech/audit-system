import { SettingsAuditType } from '../enum/settings.enum';
export interface WorkingPaperTemplateSection {
    title: string;
    description: string;
    placeholder: string;
    required: boolean;
}
export interface ReportTemplateSection {
    key: string;
    title: string;
    description: string;
    includeFindings: boolean;
}
export interface ReportTemplateVariable {
    key: string;
    description: string;
    example: string;
}
export interface WorkingPaperTemplateEntity {
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
//# sourceMappingURL=settings.entity.d.ts.map