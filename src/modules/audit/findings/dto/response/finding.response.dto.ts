import { EvidenceResponseDto, mapEvidenceToResponse } from '../../../evidence/dto/response/evidence.response.dto';
import { FollowUpResponseDto, mapFollowUpToResponse } from '../../../follow-up/dto/response/follow-up.response.dto';

export interface FindingResponseDto {
  id: string;
  engagementId: string;
  workingPaperId: string | null;
  title: string;
  description: string;
  category: string;
  severity: string;
  rootCause: string;
  riskImplication: string;
  recommendation: string;
  auditeeId: string;
  status: string;
  dueDate: string;
  createdById: string;
  closedById: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidence?: EvidenceResponseDto[];
  followUp?: FollowUpResponseDto | null;
}

export const mapFindingToResponse = (finding: {
  id: string;
  engagement_id: string;
  working_paper_id: string | null;
  title: string;
  description: string;
  category: string;
  severity: string;
  root_cause: string;
  risk_implication: string;
  recommendation: string;
  auditee_id: string;
  status: string;
  due_date: Date;
  created_by_id: string;
  closed_by_id: string | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  evidence?: Array<Parameters<typeof mapEvidenceToResponse>[0]>;
  follow_up?: Parameters<typeof mapFollowUpToResponse>[0] | null;
}): FindingResponseDto => ({
  id: finding.id,
  engagementId: finding.engagement_id,
  workingPaperId: finding.working_paper_id,
  title: finding.title,
  description: finding.description,
  category: finding.category,
  severity: finding.severity,
  rootCause: finding.root_cause,
  riskImplication: finding.risk_implication,
  recommendation: finding.recommendation,
  auditeeId: finding.auditee_id,
  status: finding.status,
  dueDate: finding.due_date.toISOString(),
  createdById: finding.created_by_id,
  closedById: finding.closed_by_id,
  closedAt: finding.closed_at?.toISOString() ?? null,
  createdAt: finding.created_at.toISOString(),
  updatedAt: finding.updated_at.toISOString(),
  evidence: finding.evidence?.map(mapEvidenceToResponse),
  followUp: finding.follow_up === undefined ? undefined : finding.follow_up ? mapFollowUpToResponse(finding.follow_up) : null,
});
