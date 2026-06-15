import { EvidenceResponseDto, mapEvidenceToResponse } from '../../../evidence/dto/response/evidence.response.dto';
import { FollowUpResponseDto, mapFollowUpToResponse } from '../../../follow-up/dto/response/follow-up.response.dto';

export interface FindingResponseDto {
  id: string;
  engagementId: string;
  engagementReference?: string;
  workingPaperId: string | null;
  checklistId: string | null;
  controlReference?: string;
  controlDescription?: string;
  riskId: string | null;
  riskTitle?: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  rootCause: string;
  riskImplication: string;
  recommendation: string;
  auditeeId: string;
  auditeeName?: string;
  status: string;
  dueDate: string;
  createdById: string;
  createdByName?: string;
  closedById: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidence?: EvidenceResponseDto[];
  followUp?: FollowUpResponseDto | null;
}

const formatUserName = (user?: {
  display_name: string | null;
  first_name: string;
  last_name: string;
  email: string;
}): string | undefined => {
  if (!user) return undefined;
  const name = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
  return name || user.email;
};

export const mapFindingToResponse = (finding: {
  id: string;
  engagement_id: string;
  engagement?: { reference_number: string };
  working_paper_id: string | null;
  checklist_id: string | null;
  checklist?: { control_reference: string; control_description: string } | null;
  risk_id: string | null;
  risk?: { title: string } | null;
  title: string;
  description: string;
  category: string;
  severity: string;
  root_cause: string;
  risk_implication: string;
  recommendation: string;
  auditee_id: string;
  auditee?: Parameters<typeof formatUserName>[0];
  status: string;
  due_date: Date;
  created_by_id: string;
  created_by?: Parameters<typeof formatUserName>[0];
  closed_by_id: string | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  evidence?: Array<Parameters<typeof mapEvidenceToResponse>[0]>;
  follow_up?: Parameters<typeof mapFollowUpToResponse>[0] | null;
}): FindingResponseDto => ({
  id: finding.id,
  engagementId: finding.engagement_id,
  engagementReference: finding.engagement?.reference_number,
  workingPaperId: finding.working_paper_id,
  checklistId: finding.checklist_id,
  controlReference: finding.checklist?.control_reference,
  controlDescription: finding.checklist?.control_description,
  riskId: finding.risk_id,
  riskTitle: finding.risk?.title,
  title: finding.title,
  description: finding.description,
  category: finding.category,
  severity: finding.severity,
  rootCause: finding.root_cause,
  riskImplication: finding.risk_implication,
  recommendation: finding.recommendation,
  auditeeId: finding.auditee_id,
  auditeeName: formatUserName(finding.auditee),
  status: finding.status,
  dueDate: finding.due_date.toISOString(),
  createdById: finding.created_by_id,
  createdByName: formatUserName(finding.created_by),
  closedById: finding.closed_by_id,
  closedAt: finding.closed_at?.toISOString() ?? null,
  createdAt: finding.created_at.toISOString(),
  updatedAt: finding.updated_at.toISOString(),
  evidence: finding.evidence?.map(mapEvidenceToResponse),
  followUp: finding.follow_up === undefined ? undefined : finding.follow_up ? mapFollowUpToResponse(finding.follow_up) : null,
});
