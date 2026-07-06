/**
 * Periodic CAE → audit committee oversight pack. Deliberately org-wide (no
 * per-actor scoping): access is gated by the `committee_pack:read` permission
 * on the route, and holders are oversight-level by definition.
 */
export interface CommitteePackDto {
    generatedAt: string;
    periodStart: string;
    engagements: {
        totalThisYear: number;
        byStatus: Array<{
            status: string;
            count: number;
        }>;
        overdue: number;
        completionRate: number;
        recent: Array<{
            referenceNumber: string;
            title: string;
            status: string;
            auditType: string;
            slaDeadline: string;
            overdue: boolean;
        }>;
    };
    findings: {
        totalOpen: number;
        bySeverity: Array<{
            severity: string;
            count: number;
        }>;
        aging: Array<{
            bucket: string;
            count: number;
        }>;
        closedThisYear: number;
    };
    reportsIssuedThisYear: number;
    risks: {
        byBand: Array<{
            band: string;
            count: number;
        }>;
        top: Array<{
            title: string;
            score: number;
            band: string;
            status: string;
        }>;
    };
    escalationsLast90Days: number;
}
export declare class CommitteePackService {
    getCommitteePack(): Promise<CommitteePackDto>;
    exportCommitteePackPdf(): Promise<Buffer>;
}
export declare const committeePackService: CommitteePackService;
//# sourceMappingURL=committee-pack.service.d.ts.map