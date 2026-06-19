import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IDocumentService } from '../interface/document.service.interface';
import { UploadDocumentDto, UploadVersionDto, CreateTemplateRequestDto, UpdateTemplateRequestDto, TemplateQueryDto, DocumentListQueryDto } from '../../dto/request/document.request.dto';
import { DocumentResponseDto, DocumentVersionResponseDto, DocumentTemplateResponseDto, ServedFileDto } from '../../dto/response/document.response.dto';
export declare class DocumentService implements IDocumentService {
    upload(dto: UploadDocumentDto): Promise<DocumentResponseDto>;
    getById(id: string, requesterId: string): Promise<DocumentResponseDto>;
    getDownloadUrl(id: string): Promise<string>;
    delete(id: string, actorId: string): Promise<void>;
    list(query: DocumentListQueryDto, ownerId: string): Promise<{
        documents: DocumentResponseDto[];
        meta: PaginationMeta;
    }>;
    listByEntity(entityType: string, entityId: string): Promise<DocumentResponseDto[]>;
    listByEntityIds(entityType: string, entityIds: string[]): Promise<Map<string, DocumentResponseDto[]>>;
    /**
     * Personal-isolation guard for the generic by-id routes (`GET /documents/:id/file`
     * and `/download`). Those service reads are also used internally to assemble
     * engagement/signature PDFs, so the check lives here and is invoked from the
     * controller rather than inside the read methods. Entity-attached documents
     * (engagement evidence, attachments, signatures, …) are exempt, so every party
     * linked to an engagement keeps access to its shared documents.
     */
    assertCanUserAccess(documentId: string, requesterId: string): Promise<void>;
    getFileById(id: string): Promise<ServedFileDto>;
    serveFile(storedName: string, requesterId: string): Promise<ServedFileDto>;
    uploadNewVersion(documentId: string, dto: UploadVersionDto): Promise<DocumentVersionResponseDto>;
    listVersions(documentId: string, requesterId: string): Promise<DocumentVersionResponseDto[]>;
    getVersion(documentId: string, versionNumber: number, requesterId: string): Promise<DocumentVersionResponseDto>;
    getVersionDownloadUrl(documentId: string, versionNumber: number, requesterId: string): Promise<string>;
    createTemplate(dto: CreateTemplateRequestDto, actorId: string): Promise<DocumentTemplateResponseDto>;
    getTemplateById(id: string): Promise<DocumentTemplateResponseDto>;
    listTemplates(query: TemplateQueryDto): Promise<{
        templates: DocumentTemplateResponseDto[];
        meta: PaginationMeta;
    }>;
    updateTemplate(id: string, dto: UpdateTemplateRequestDto, actorId: string): Promise<DocumentTemplateResponseDto>;
    deleteTemplate(id: string, actorId: string): Promise<void>;
    renderDocxTemplate(category: string, data: Record<string, unknown>): Promise<Buffer>;
    pruneOldVersions(): Promise<{
        prunedCount: number;
        failedCount: number;
    }>;
    private _storageClient;
    /**
     * Enforce per-person isolation for standalone (personal) documents.
     *
     * A personal document has no entity attachment (`entity_type === null`) and
     * is private to whoever uploaded it. Entity-attached documents (audit
     * evidence, working papers, reports, request attachments, signatures, …) are
     * governed by their owning module's access rules and stay shared with the
     * audit/workflow team, so they are exempt from this check.
     *
     * Throws `notFound` rather than `forbidden` so a non-owner can't even
     * confirm that another user's personal document exists.
     */
    private _assertCanAccess;
    private _assertTemplateExists;
    private _assertDocumentExists;
}
//# sourceMappingURL=document.service.d.ts.map