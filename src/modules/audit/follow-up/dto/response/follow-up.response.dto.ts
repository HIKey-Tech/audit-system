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
  verifiedAt: string | null;
  verificationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  finding?: FollowUpFindingSummaryDto;
  remediationEvidence?: EvidenceResponseDto | null;
}

export const mapFollowUpToResponse = (followUp: {
  id: string;
  finding_id: string;
  management_response: string | null;
  management_response_by_id: string | null;
  management_response_at: Date | null;
  remediation_evidence_id: string | null;
  verification_status: string;
  verified_by_id: string | null;
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
}): FollowUpResponseDto => ({
  id: followUp.id,
  findingId: followUp.finding_id,
  managementResponse: followUp.management_response,
  managementResponseById: followUp.management_response_by_id,
  managementResponseAt: followUp.management_response_at?.toISOString() ?? null,
  remediationEvidenceId: followUp.remediation_evidence_id,
  verificationStatus: followUp.verification_status,
  verifiedById: followUp.verified_by_id,
  verifiedAt: followUp.verified_at?.toISOString() ?? null,
  verificationNotes: followUp.verification_notes,
  createdAt: followUp.created_at.toISOString(),
  updatedAt: followUp.updated_at.toISOString(),
  finding: followUp.finding
    ? {
        id: followUp.finding.id,
        engagementId: followUp.finding.engagement_id,
        title: followUp.finding.title,
        severity: followUp.finding.severity,
        status: followUp.finding.status,
        auditeeId: followUp.finding.auditee_id,
        dueDate: followUp.finding.due_date.toISOString(),
      }
    : undefined,
  remediationEvidence: followUp.remediation_evidence === undefined
    ? undefined
    : followUp.remediation_evidence
      ? mapEvidenceToResponse(followUp.remediation_evidence)
      : null,
});
