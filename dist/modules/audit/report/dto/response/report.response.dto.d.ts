import { FindingResponseDto, mapFindingToResponse } from '../../../findings/dto/response/finding.response.dto';
export interface ReportResponseDto {
    id: string;
    engagementId: string;
    title: string;
    executiveSummary: string;
    scope: string;
    methodology: string;
    status: string;
    versionNumber: number;
    documentId: string | null;
    issuedAt: string | null;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    findings?: FindingResponseDto[];
}
export declare const mapReportToResponse: (report: {
    id: string;
    engagement_id: string;
    title: string;
    executive_summary: string;
    scope: string;
    methodology: string;
    status: string;
    version_number: number;
    document_id: string | null;
    issued_at: Date | null;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
    engagement?: {
        findings: Array<Parameters<typeof mapFindingToResponse>[0]>;
    };
}) => ReportResponseDto;
//# sourceMappingURL=report.response.dto.d.ts.map