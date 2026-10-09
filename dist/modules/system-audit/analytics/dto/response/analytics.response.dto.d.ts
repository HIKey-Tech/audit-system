import { SystemAuditExceptionWithRelations, SystemAuditRunWithRelations } from '../../../../../shared/prisma/prisma.types';
import { AnalysisField, AnalysisRule } from '../../../domain/entity/system-audit.entity';
import { AnalysisSource } from '../../../domain/enum/system-audit.enum';
import { UserRef } from '../../../utility/system-audit.utility';
export interface AnalysisTypeResponseDto {
    type: string;
    label: string;
    description: string;
    controls: string[];
    fields: AnalysisField[];
    rules: AnalysisRule[];
    defaultParameters: unknown;
    /** Read-only sources this analysis can run against besides an uploaded export. */
    liveSources: AnalysisSource[];
}
export interface ExtractPreviewResponseDto {
    analysisType: string;
    fileName: string;
    rowCount: number;
    headers: string[];
    sampleRows: Array<Record<string, unknown>>;
    suggestedMapping: Record<string, string | null>;
    missingRequired: Array<{
        key: string;
        label: string;
    }>;
}
export interface SeverityCounts {
    critical: number;
    high: number;
    medium: number;
    low: number;
}
export interface DispositionCounts {
    open: number;
    confirmed: number;
    false_positive: number;
    explained: number;
}
export interface RunResponseDto {
    id: string;
    reference: string;
    title: string;
    analysisType: string;
    analysisLabel: string;
    source: string;
    systemName: string;
    trigger: string;
    engagement: {
        id: string;
        referenceNumber: string;
        title: string;
    } | null;
    securityTest: {
        id: string;
        reference: string;
        title: string;
    } | null;
    fileName: string | null;
    contentSha256: string | null;
    recordCount: number;
    exceptionCount: number;
    severityCounts: SeverityCounts;
    openExceptions: number;
    reviewStatus: string;
    reviewNote: string | null;
    reviewedBy: UserRef | null;
    reviewedAt: string | null;
    isBaseline: boolean;
    baselineRunId: string | null;
    createdBy: UserRef | null;
    createdAt: string;
    summary: Record<string, unknown>;
}
export interface RunDetailResponseDto extends RunResponseDto {
    parameters: Record<string, unknown>;
    controls: string[];
    dispositionCounts: DispositionCounts;
    ruleCounts: Array<{
        ruleCode: string;
        label: string;
        count: number;
    }>;
    accessReview: {
        total: number;
        pending: number;
        appropriate: number;
        revoke: number;
        modify: number;
    } | null;
    hasExtract: boolean;
}
export interface ExceptionResponseDto {
    id: string;
    runId: string;
    ruleCode: string;
    ruleLabel: string;
    severity: string;
    title: string;
    recordRef: string | null;
    details: Record<string, unknown>;
    disposition: string;
    dispositionNote: string | null;
    disposedBy: UserRef | null;
    disposedAt: string | null;
    finding: {
        id: string;
        title: string;
        status: string;
    } | null;
    createdAt: string;
}
export declare const emptySeverityCounts: () => SeverityCounts;
export declare const mapRunToResponse: (run: SystemAuditRunWithRelations, analysisLabel: string, counts: {
    severity: SeverityCounts;
    open: number;
}) => RunResponseDto;
export declare const mapExceptionToResponse: (exception: SystemAuditExceptionWithRelations, ruleLabel: string) => ExceptionResponseDto;
//# sourceMappingURL=analytics.response.dto.d.ts.map