import { EvidenceResponseDto, mapEvidenceToResponse } from '../../../evidence/dto/response/evidence.response.dto';
export interface FollowUpFindingSummaryDto {
    id: string;
    engagementId: string;
    title: string;
    severity: string;
    status: string;
    auditeeId: string;
    dueDate: string;
}
export interface FollowUpResponseDto {
    id: string;
    findingId: string;
    managementResponse: string | null;
    managementResponseById: string | null;
    managementResponseAt: string | null;
    remediationEvidenceId: string | null;
    verificationStatus: string;
    verifiedById: string | null;
    verifiedByName: string | null;
    verifiedAt: string | null;
    verificationNotes: string | null;
    createdAt: string;
    updatedAt: string;
    finding?: FollowUpFindingSummaryDto;
    remediationEvidence?: EvidenceResponseDto | null;
}
export declare const mapFollowUpToResponse: (followUp: {
    id: string;
    finding_id: string;
    management_response: string | null;
    management_response_by_id: string | null;
    management_response_at: Date | null;
    remediation_evidence_id: string | null;
    verification_status: string;
    verified_by_id: string | null;
    verified_by?: {
        display_name: string | null;
        first_name: string;
        last_name: string;
    } | null;
    verified_at: Date | null;
    verification_notes: string | null;
    created_at: Date;
    updated_at: Date;
    finding?: {
        id: string;
        engagement_id: string;
        title: string;
        severity: string;
        status: string;
        auditee_id: string;
        due_date: Date;
    };
    remediation_evidence?: Parameters<typeof mapEvidenceToResponse>[0] | null;
}) => FollowUpResponseDto;
//# sourceMappingURL=follow-up.response.dto.d.ts.map