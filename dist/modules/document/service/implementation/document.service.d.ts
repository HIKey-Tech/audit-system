import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IDocumentService, DocumentAccessActor } from '../interface/document.service.interface';
import { UploadDocumentDto, UploadVersionDto, CreateTemplateRequestDto, UpdateTemplateRequestDto, TemplateQueryDto, DocumentListQueryDto } from '../../dto/request/document.request.dto';
import { DocumentResponseDto, DocumentVersionResponseDto, DocumentTemplateResponseDto, ServedFileDto } from '../../dto/response/document.response.dto';
export declare class DocumentService implements IDocumentService {
    upload(dto: UploadDocumentDto): Promise<DocumentResponseDto>;
    getById(id: string, actor: DocumentAccessActor): Promise<DocumentResponseDto>;
    getDownloadUrl(id: string): Promise<string>;
    delete(id: string, actor: DocumentAccessActor): Promise<void>;
    list(query: DocumentListQueryDto, ownerId: string): Promise<{
        documents: DocumentResponseDto[];
        meta: PaginationMeta;
    }>;
    listByEntity(entityType: string, entityId: string): Promise<DocumentResponseDto[]>;
    listByEntityForActor(entityType: string, entityId: string, actor: DocumentAccessActor): Promise<DocumentResponseDto[]>;
    listByEntityIds(entityType: string, entityIds: string[]): Promise<Map<string, DocumentResponseDto[]>>;
    /**
     * Personal-isolation guard for the generic by-id routes (`GET /documents/:id/file`
     * and `/download`). Those service reads are also used internally to assemble
     * engagement/signature PDFs, so the check lives here and is invoked from the
     * controller rather than inside the read methods. Entity-attached documents
     * (engagement evidence, attachments, signatures, …) are exempt, so every party
     * linked to an engagement keeps access to its shared documents.
     */
    assertCanUserAccess(documentId: string, actor: DocumentAccessActor): Promise<void>;
    getFileById(id: string): Promise<ServedFileDto>;
    serveFile(storedName: string, actor: DocumentAccessActor): Promise<ServedFileDto>;
    uploadNewVersion(documentId: string, dto: UploadVersionDto): Promise<DocumentVersionResponseDto>;
    listVersions(documentId: string, actor: DocumentAccessActor): Promise<DocumentVersionResponseDto[]>;
    getVersion(documentId: string, versionNumber: number, actor: DocumentAccessActor): Promise<DocumentVersionResponseDto>;
    getVersionDownloadUrl(documentId: string, versionNumber: number, actor: DocumentAccessActor): Promise<string>;
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
     * Object-level access control for document reads.
     *
     * - Personal documents (`entity_type === null`) are private to their uploader.
     * - The uploader and oversight roles (`engagement:read_all` / super admin) may
     *   always read.
     * - Entity-attached documents that resolve to an engagement (evidence, working
     *   papers, reports, findings, checklists, follow-ups) are restricted to the
     *   engagement's audit team (lead / manager / assignee). This mirrors the
     *   central repository visibility rule (`repositoryEngagementScope`) so a
     *   user can no longer read another engagement's confidential material just by
     *   holding `document:read`.
     * - Entity types that do not map to an engagement (assets, risk records,
     *   workflow requests, signed approval copies, plans, …) keep the prior
     *   behaviour: any holder of the route's module permission may read them. They
     *   are surfaced and governed through their own module endpoints.
     *
     * Throws `notFound` rather than `forbidden` so a caller cannot confirm the
     * existence of a document they are not allowed to see.
     */
    private _assertCanAccess;
    private _isOversight;
    /**
     * Maps a document `entity_type`/`entity_id` to the engagement that owns it, or
     * null when the type is not engagement-scoped. The mappings follow how each
     * audit module attaches documents (see the *.service.ts upload calls).
     */
    private _resolveEngagementId;
    private _isEngagementMember;
    private _assertTemplateExists;
    private _assertDocumentExists;
}
//# sourceMappingURL=document.service.d.ts.map