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

// ──────────── Review comments ────────────

import { Prisma } from '@prisma/client';

export const wpCommentInclude = Prisma.validator<Prisma.Audit_Working_Paper_CommentInclude>()({
  author: { select: { display_name: true, first_name: true, last_name: true } },
  resolved_by: { select: { display_name: true, first_name: true, last_name: true } },
});

type WpCommentWithAuthor = Prisma.Audit_Working_Paper_CommentGetPayload<{ include: typeof wpCommentInclude }>;

export interface WorkingPaperCommentResponseDto {
  id: string;
  workingPaperId: string;
  authorId: string;
  authorName: string;
  body: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  createdAt: string;
}

const wpUserName = (u: { display_name: string | null; first_name: string; last_name: string } | null): string | null =>
  u ? (u.display_name ?? `${u.first_name} ${u.last_name}`.trim()) : null;

export const mapWpCommentToResponse = (c: WpCommentWithAuthor): WorkingPaperCommentResponseDto => ({
  id: c.id,
  workingPaperId: c.working_paper_id,
  authorId: c.author_id,
  authorName: wpUserName(c.author) ?? 'Unknown',
  body: c.body,
  resolvedAt: c.resolved_at?.toISOString() ?? null,
  resolvedByName: wpUserName(c.resolved_by),
  createdAt: c.created_at.toISOString(),
});
