import { EvidenceResponseDto, mapEvidenceToResponse } from '../../../evidence/dto/response/evidence.response.dto';

export interface WorkingPaperResponseDto {
  id: string;
  engagementId: string;
  templateId: string | null;
  sourceDocumentId: string | null;
  workingPaperType: string;
  title: string;
  content: string;
  versionNumber: number;
  status: string;
  createdById: string;
  reviewedById: string | null;
  rejectionReason: string | null;
  importMetadata: unknown | null;
  createdAt: string;
  updatedAt: string;
  evidence?: EvidenceResponseDto[];
}

export interface WorkingPaperImportSectionPreviewDto {
  title: string;
  description: string;
  required: boolean;
  content: string;
  confidence: number;
}

export interface WorkingPaperImportPreviewResponseDto {
  documentId: string;
  fileName: string;
  fileType: string;
  templateId: string | null;
  templateName: string | null;
  workingPaperType: string;
  suggestedTitle: string;
  extractedText: string;
  mappedSections: WorkingPaperImportSectionPreviewDto[];
  content: string;
  confidence: number;
  warnings: string[];
}

export const mapWorkingPaperToResponse = (paper: {
  id: string;
  engagement_id: string;
  template_id: string | null;
  source_document_id: string | null;
  working_paper_type: string;
  title: string;
  content: string;
  version_number: number;
  status: string;
  created_by_id: string;
  reviewed_by_id: string | null;
  rejection_reason: string | null;
  import_metadata: string | null;
  created_at: Date;
  updated_at: Date;
  evidence?: Array<Parameters<typeof mapEvidenceToResponse>[0]>;
}): WorkingPaperResponseDto => ({
  id: paper.id,
  engagementId: paper.engagement_id,
  templateId: paper.template_id,
  sourceDocumentId: paper.source_document_id,
  workingPaperType: paper.working_paper_type,
  title: paper.title,
  content: paper.content,
  versionNumber: paper.version_number,
  status: paper.status,
  createdById: paper.created_by_id,
  reviewedById: paper.reviewed_by_id,
  rejectionReason: paper.rejection_reason,
  importMetadata: paper.import_metadata ? JSON.parse(paper.import_metadata) : null,
  createdAt: paper.created_at.toISOString(),
  updatedAt: paper.updated_at.toISOString(),
  evidence: paper.evidence?.map(mapEvidenceToResponse),
});
