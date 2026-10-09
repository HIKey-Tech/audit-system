import { SecurityTestWithRelations } from '../../../../../shared/prisma/prisma.types';
import { SeverityCounts } from '../../../analytics/dto/response/analytics.response.dto';
import { UserRef } from '../../../utility/system-audit.utility';
export interface SecurityTestResultsDto {
    scanRuns: number;
    /** Vulnerabilities by severity from the most recent linked scan import. */
    latestScan: SeverityCounts | null;
    openExceptions: number;
    findingsRaised: number;
}
export interface SecurityTestResponseDto {
    id: string;
    reference: string;
    title: string;
    testType: string;
    status: string;
    engagement: {
        id: string;
        referenceNumber: string;
        title: string;
    } | null;
    provider: string;
    providerType: string;
    scope: string;
    rulesOfEngagement: string | null;
    plannedStart: string;
    plannedEnd: string;
    actualStart: string | null;
    actualEnd: string | null;
    coordinator: UserRef | null;
    authorisedBy: UserRef | null;
    authorisedAt: string | null;
    report: {
        documentId: string;
        fileName: string;
        fileSize: number;
        uploadedAt: string;
    } | null;
    notes: string | null;
    assets: Array<{
        id: string;
        assetTag: string;
        name: string;
        assetType: string;
        criticality: string;
    }>;
    createdBy: UserRef | null;
    createdAt: string;
    updatedAt: string;
    /** Status moves the current state allows (authorisation is its own action). */
    allowedTransitions: string[];
    results: SecurityTestResultsDto;
}
export interface SecurityTestDetailResponseDto extends SecurityTestResponseDto {
    scanRuns: Array<{
        id: string;
        reference: string;
        title: string;
        createdAt: string;
        exceptionCount: number;
        summary: Record<string, unknown>;
    }>;
}
export declare const mapSecurityTestToResponse: (test: SecurityTestWithRelations, allowedTransitions: string[], results: SecurityTestResultsDto) => SecurityTestResponseDto;
//# sourceMappingURL=security-test.response.dto.d.ts.map