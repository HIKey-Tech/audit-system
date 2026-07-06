import { Prisma } from '@prisma/client';
export declare const evidenceRequestInclude: {
    requested_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    assigned_to: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    evidence: {
        select: {
            id: true;
            file_name: true;
            uploaded_at: true;
        };
        orderBy: {
            uploaded_at: "desc";
        };
    };
    engagement: {
        select: {
            reference_number: true;
            title: true;
        };
    };
};
export type EvidenceRequestWithDetails = Prisma.Audit_Evidence_RequestGetPayload<{
    include: typeof evidenceRequestInclude;
}>;
export interface EvidenceRequestResponseDto {
    id: string;
    engagementId: string;
    engagementReference: string;
    engagementTitle: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    status: string;
    returnReason: string | null;
    requestedById: string;
    requestedByName: string;
    assignedToId: string;
    assignedToName: string;
    fulfilledAt: string | null;
    createdAt: string;
    updatedAt: string;
    evidence: {
        id: string;
        fileName: string;
        uploadedAt: string;
    }[];
}
export declare const mapEvidenceRequestToResponse: (r: EvidenceRequestWithDetails) => EvidenceRequestResponseDto;
//# sourceMappingURL=evidence-request.response.dto.d.ts.map