import { SystemDocumentWithRelations } from '../../../../../shared/prisma/prisma.types';
import { UserRef } from '../../../utility/system-audit.utility';
export declare const REVIEW_DUE_SOON_DAYS = 30;
export declare const CONTRACT_EXPIRING_DAYS = 60;
export interface SystemDocumentResponseDto {
    id: string;
    title: string;
    docType: string;
    description: string | null;
    versionLabel: string | null;
    owner: UserRef | null;
    universe: {
        id: string;
        name: string;
    } | null;
    asset: {
        id: string;
        assetTag: string;
        name: string;
    } | null;
    vendor: string | null;
    effectiveDate: string | null;
    reviewDueDate: string | null;
    expiryDate: string | null;
    status: string;
    file: {
        documentId: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
        versionNumber: number;
        contentSha256: string | null;
    };
    /** Null when no review date is set. */
    reviewState: 'ok' | 'due_soon' | 'overdue' | null;
    /** Null when no expiry date is set. */
    contractState: 'ok' | 'expiring' | 'expired' | null;
    createdBy: UserRef | null;
    createdAt: string;
    updatedAt: string;
}
export interface SystemDocumentSummaryDto {
    total: number;
    byType: Record<string, number>;
    reviewOverdue: number;
    reviewDueSoon: number;
    contractsExpired: number;
    contractsExpiring: number;
}
export declare const mapSystemDocumentToResponse: (doc: SystemDocumentWithRelations, now?: Date) => SystemDocumentResponseDto;
//# sourceMappingURL=documentation.response.dto.d.ts.map