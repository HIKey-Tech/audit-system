import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IDocumentService } from '../interface/document.service.interface';
import { UploadDocumentDto, UploadVersionDto, CreateTemplateRequestDto, UpdateTemplateRequestDto, TemplateQueryDto, DocumentListQueryDto } from '../../dto/request/document.request.dto';
import { DocumentResponseDto, DocumentVersionResponseDto, DocumentTemplateResponseDto, ServedFileDto } from '../../dto/response/document.response.dto';
export declare class DocumentService implements IDocumentService {
    upload(dto: UploadDocumentDto): Promise<DocumentResponseDto>;
    getById(id: string): Promise<DocumentResponseDto>;
    getDownloadUrl(id: string): Promise<string>;
    delete(id: string, actorId: string): Promise<void>;
    list(query: DocumentListQueryDto): Promise<{
        documents: DocumentResponseDto[];
        meta: PaginationMeta;
    }>;
    listByEntity(entityType: string, entityId: string): Promise<DocumentResponseDto[]>;
    listByEntityIds(entityType: string, entityIds: string[]): Promise<Map<string, DocumentResponseDto[]>>;
    getFileById(id: string): Promise<ServedFileDto>;
    serveFile(storedName: string): Promise<ServedFileDto>;
    uploadNewVersion(documentId: string, dto: UploadVersionDto): Promise<DocumentVersionResponseDto>;
    listVersions(documentId: string): Promise<DocumentVersionResponseDto[]>;
    getVersion(documentId: string, versionNumber: number): Promise<DocumentVersionResponseDto>;
    getVersionDownloadUrl(documentId: string, versionNumber: number): Promise<string>;
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
    private _assertTemplateExists;
    private _assertDocumentExists;
}
//# sourceMappingURL=document.service.d.ts.map