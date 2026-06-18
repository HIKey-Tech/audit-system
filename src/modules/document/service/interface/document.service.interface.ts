// src/modules/document/service/interface/document.service.interface.ts
import { PaginationMeta } from '../../../../shared/types/api-response.type';
import {
  DocumentResponseDto,
  DocumentVersionResponseDto,
  DocumentTemplateResponseDto,
  ServedFileDto,
} from '../../dto/response/document.response.dto';
import {
  UploadDocumentDto,
  UploadVersionDto,
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  TemplateQueryDto,
  DocumentListQueryDto,
} from '../../dto/request/document.request.dto';

export interface IDocumentService {
  // ──────────── Files ────────────
  upload(dto: UploadDocumentDto): Promise<DocumentResponseDto>;
  getById(id: string, requesterId: string): Promise<DocumentResponseDto>;
  getDownloadUrl(id: string): Promise<string>;
  delete(id: string, actorId: string): Promise<void>;
  /**
   * Personal-isolation guard for the generic by-id download routes. Standalone
   * (personal) documents are visible only to their uploader; entity-attached
   * documents (engagement evidence, attachments, signatures) are exempt so all
   * parties on an engagement keep access. Throws notFound for both missing and
   * non-owned personal documents.
   */
  assertCanUserAccess(documentId: string, requesterId: string): Promise<void>;
  /**
   * List documents owned by `ownerId` only. The standalone Documents page is
   * personal storage — a user must never see another user's uploads here.
   * Entity-attached documents are surfaced separately via {@link listByEntity}.
   */
  list(
    query: DocumentListQueryDto,
    ownerId: string,
  ): Promise<{ documents: DocumentResponseDto[]; meta: PaginationMeta }>;
  listByEntity(entityType: string, entityId: string): Promise<DocumentResponseDto[]>;
  /**
   * Batched variant of {@link listByEntity}: loads documents for many entities of
   * the same type in a single query, grouped by entity id. Use this instead of
   * calling listByEntity in a loop to avoid N+1 queries on list endpoints.
   */
  listByEntityIds(
    entityType: string,
    entityIds: string[],
  ): Promise<Map<string, DocumentResponseDto[]>>;
  serveFile(storedName: string, requesterId: string): Promise<ServedFileDto>;
  getFileById(id: string): Promise<ServedFileDto>;

  // ──────────── Versioning ────────────
  uploadNewVersion(
    documentId: string,
    dto: UploadVersionDto,
  ): Promise<DocumentVersionResponseDto>;

  listVersions(
    documentId: string,
    requesterId: string,
  ): Promise<DocumentVersionResponseDto[]>;

  getVersion(
    documentId: string,
    versionNumber: number,
    requesterId: string,
  ): Promise<DocumentVersionResponseDto>;

  getVersionDownloadUrl(
    documentId: string,
    versionNumber: number,
    requesterId: string,
  ): Promise<string>;

  // ──────────── Templates ────────────
  createTemplate(
    dto: CreateTemplateRequestDto,
    actorId: string,
  ): Promise<DocumentTemplateResponseDto>;

  getTemplateById(id: string): Promise<DocumentTemplateResponseDto>;

  listTemplates(
    query: TemplateQueryDto,
  ): Promise<{ templates: DocumentTemplateResponseDto[]; meta: PaginationMeta }>;

  updateTemplate(
    id: string,
    dto: UpdateTemplateRequestDto,
    actorId: string,
  ): Promise<DocumentTemplateResponseDto>;

  deleteTemplate(id: string, actorId: string): Promise<void>;

  /**
   * Look up the latest active template for a category and render it as a
   * populated .docx buffer using docxtemplater. The stored template `content`
   * must be a `word/document.xml` body containing docxtemplater placeholders.
   */
  renderDocxTemplate(
    category: string,
    data: Record<string, unknown>,
  ): Promise<Buffer>;

  // ──────────── Retention ────────────
  /**
   * Prune old document versions when version_retention is enabled in system config.
   * Reads the `version_retention` config, keeps the N most recent versions per document,
   * deletes older versions from storage and DB. No-op when disabled (default).
   */
  pruneOldVersions(): Promise<{ prunedCount: number; failedCount: number }>;
}
