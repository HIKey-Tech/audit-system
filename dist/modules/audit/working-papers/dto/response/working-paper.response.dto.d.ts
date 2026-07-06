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
export declare const mapWorkingPaperToResponse: (paper: {
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
}) => WorkingPaperResponseDto;
import { Prisma } from '@prisma/client';
export declare const wpCommentInclude: {
    author: {
        select: {
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    resolved_by: {
        select: {
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
};
type WpCommentWithAuthor = Prisma.Audit_Working_Paper_CommentGetPayload<{
    include: typeof wpCommentInclude;
}>;
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
export declare const mapWpCommentToResponse: (c: WpCommentWithAuthor) => WorkingPaperCommentResponseDto;
export {};
//# sourceMappingURL=working-paper.response.dto.d.ts.map