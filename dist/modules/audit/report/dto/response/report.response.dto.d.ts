import { FindingResponseDto, mapFindingToResponse } from '../../../findings/dto/response/finding.response.dto';
export interface ReportCommentDto {
    id: string;
    authorId: string;
    authorName: string;
    body: string;
    createdAt: string;
}
export interface ReportResponseDto {
    id: string;
    engagementId: string;
    engagementReference?: string;
    title: string;
    executiveSummary: string;
    scope: string;
    methodology: string;
    status: string;
    version: number;
    versionNumber: number;
    documentId: string | null;
    templateId: string | null;
    signOffMode?: 'cae_only' | 'cae_and_dg';
    comments?: ReportCommentDto[];
    issuedAt: string | null;
    rejectionReason: string | null;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    findings?: FindingResponseDto[];
}
export declare const mapReportToResponse: (report: {
    id: string;
    engagement_id: string;
    engagement?: {
        reference_number?: string;
        findings: Array<Parameters<typeof mapFindingToResponse>[0]>;
    };
    title: string;
    executive_summary: string;
    scope: string;
    methodology: string;
    status: string;
    version_number: number;
    document_id: string | null;
    template_id: string | null;
    issued_at: Date | null;
    rejection_reason: string | null;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
}, extra?: {
    signOffMode?: "cae_only" | "cae_and_dg";
    comments?: ReportCommentDto[];
}) => ReportResponseDto;
//# sourceMappingURL=report.response.dto.d.ts.map