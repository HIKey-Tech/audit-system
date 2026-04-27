import { EvidenceResponseDto, mapEvidenceToResponse } from '../../../evidence/dto/response/evidence.response.dto';

export interface WorkingPaperResponseDto {
  id: string;
  engagementId: string;
  title: string;
  content: string;
  versionNumber: number;
  status: string;
  createdById: string;
  reviewedById: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  evidence?: EvidenceResponseDto[];
}

export const mapWorkingPaperToResponse = (paper: {
  id: string;
  engagement_id: string;
  title: string;
  content: string;
  version_number: number;
  status: string;
  created_by_id: string;
  reviewed_by_id: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
  evidence?: Array<Parameters<typeof mapEvidenceToResponse>[0]>;
}): WorkingPaperResponseDto => ({
  id: paper.id,
  engagementId: paper.engagement_id,
  title: paper.title,
  content: paper.content,
  versionNumber: paper.version_number,
  status: paper.status,
  createdById: paper.created_by_id,
  reviewedById: paper.reviewed_by_id,
  rejectionReason: paper.rejection_reason,
  createdAt: paper.created_at.toISOString(),
  updatedAt: paper.updated_at.toISOString(),
  evidence: paper.evidence?.map(mapEvidenceToResponse),
});
