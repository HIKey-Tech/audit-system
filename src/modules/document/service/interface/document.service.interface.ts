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

/**
 * Identity + authorization context of the caller, used to gate access to
 * entity-attached documents. `permissions`/`isSuperAdmin` let oversight roles
 * (e.g. `engagement:read_all`) read across engagements without being a member.
 */
export interface DocumentAccessActor {
  id: string;
  permissions: string[];
  isSuperAdmin: boolean;
}

export interface IDocumentService {
  // ──────────── Files ────────────
  upload(dto: UploadDocumentDto, actor?: DocumentAccessActor): Promise<DocumentResponseDto>;
  getById(id: string, actor: DocumentAccessActor): Promise<DocumentResponseDto>;
  getDownloadUrl(id: string): Promise<string>;
  delete(id: string, actor: DocumentAccessActor): Promise<void>;
  /**
   * Object-level access guard for the generic by-id download routes. Personal
   * (standalone) documents are visible only to their uploader. Entity-attached
   * documents are restricted to the uploader, the audit team of the owning
   * engagement (lead / manager / assignee), and oversight (`engagement:read_all`
   * / super admin); non-engagement entity types fall back to the caller's
   * module read permission. Throws notFound rather than forbidden so a caller
   * cannot probe for documents they may not see.
   */
  assertCanUserAccess(documentId: string, actor: DocumentAccessActor): Promise<void>;
  /**
   * List documents owned by `ownerId` only. The standalone Documents page is
   * personal storage — a user must never see another user's uploads here.
   * Entity-attached documents are surfaced separately via {@link listByEntity}.
   */
  list(
    query: DocumentListQueryDto,
    ownerId: string,
  ): Promise<{ documents: DocumentResponseDto[]; meta: PaginationMeta }>;
  /**
   * Internal, UNGUARDED listing for one entity. Callers (other modules) MUST
   * perform their own authorization before invoking this. For the HTTP
   * `GET /documents/by-entity/...` route use {@link listByEntityForActor}.
   */
  listByEntity(entityType: string, entityId: string): Promise<DocumentResponseDto[]>;
  /**
   * Authorization-checked listing for the HTTP by-entity route: the actor must
   * be allowed to view the owning entity (engagement membership / oversight) or
   * the result is empty / rejected.
   */
  listByEntityForActor(
    entityType: string,
    entityId: string,
    actor: DocumentAccessActor,
  ): Promise<DocumentResponseDto[]>;
  /**
   * Batched variant of {@link listByEntity}: loads documents for many entities of
   * the same type in a single query, grouped by entity id. Use this instead of
   * calling listByEntity in a loop to avoid N+1 queries on list endpoints.
   */
  listByEntityIds(
    entityType: string,
    entityIds: string[],
  ): Promise<Map<string, DocumentResponseDto[]>>;
  serveFile(storedName: string, actor: DocumentAccessActor): Promise<ServedFileDto>;
  getFileById(id: string): Promise<ServedFileDto>;

  // ──────────── Versioning ────────────
  uploadNewVersion(
    documentId: string,
    dto: UploadVersionDto,
    actor?: DocumentAccessActor,
  ): Promise<DocumentVersionResponseDto>;

  listVersions(
    documentId: string,
    actor: DocumentAccessActor,
  ): Promise<DocumentVersionResponseDto[]>;

  getVersion(
    documentId: string,
    versionNumber: number,
    actor: DocumentAccessActor,
  ): Promise<DocumentVersionResponseDto>;

  getVersionDownloadUrl(
    documentId: string,
    versionNumber: number,
    actor: DocumentAccessActor,
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
