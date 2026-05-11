import { ReportTemplateSection, ReportTemplateVariable, WorkingPaperTemplateSection } from '../domain/entity/settings.entity';
type StoredReportSection = {
    key: string;
    title: string;
    description: string;
    include_findings?: boolean;
    includeFindings?: boolean;
};
export declare const toReportTemplateSections: (sections: StoredReportSection[]) => ReportTemplateSection[];
export declare const toStoredReportTemplateSections: (sections: ReportTemplateSection[]) => StoredReportSection[];
export declare const asWorkingPaperSections: (value: unknown) => WorkingPaperTemplateSection[];
export declare const asReportSections: (value: unknown) => ReportTemplateSection[];
export declare const asReportVariables: (value: unknown) => ReportTemplateVariable[];
export declare const parseNullableJson: (value: string | null) => unknown | null;
export declare const stringifyJson: (value: unknown) => string;
export {};
//# sourceMappingURL=settings.utility.d.ts.map