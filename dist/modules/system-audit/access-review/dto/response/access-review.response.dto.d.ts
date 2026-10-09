import { AccessReviewItemWithRelations } from '../../../../../shared/prisma/prisma.types';
import { UserRef } from '../../../utility/system-audit.utility';
export interface AccessReviewItemResponseDto {
    id: string;
    runId: string;
    accountId: string;
    displayName: string | null;
    email: string | null;
    department: string | null;
    accountStatus: string | null;
    isPrivileged: boolean;
    lastLoginAt: string | null;
    entitlements: string[];
    flags: string[];
    decision: string;
    decisionNote: string | null;
    decidedBy: UserRef | null;
    decidedAt: string | null;
}
export declare const mapAccessItemToResponse: (item: AccessReviewItemWithRelations) => AccessReviewItemResponseDto;
//# sourceMappingURL=access-review.response.dto.d.ts.map