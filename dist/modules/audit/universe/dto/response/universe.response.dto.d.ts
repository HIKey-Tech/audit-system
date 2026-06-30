import { Prisma } from '@prisma/client';
export interface UniverseLinkedRiskDto {
    id: string;
    title: string;
    currentScore: number;
    status: string;
    categoryName: string | null;
}
export interface UniverseEngagementHistoryDto {
    id: string;
    referenceNumber: string;
    title: string;
    auditType: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
}
export interface UniverseResponseDto {
    id: string;
    name: string;
    description: string | null;
    category: string;
    ownerId: string;
    ownerName: string | null;
    riskScore: number | null;
    lastAuditedAt: string | null;
    auditFrequency: string;
    status: string;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    linkedRisks?: UniverseLinkedRiskDto[];
    engagementHistory?: UniverseEngagementHistoryDto[];
}
export declare const mapUniverseToResponse: (entity: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    owner_id: string;
    owner?: {
        display_name: string | null;
        first_name: string;
        last_name: string;
    } | null;
    risk_score: Prisma.Decimal | null;
    last_audited_at: Date | null;
    audit_frequency: string;
    status: string;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
}) => UniverseResponseDto;
//# sourceMappingURL=universe.response.dto.d.ts.map