// src/modules/document/service/implementation/document.service.ts
import type { Document_Version, Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import {
  PaginationMeta,
  parsePagination,
  buildPaginationMeta,
} from '../../../../shared/types/api-response.type';
import { IDocumentService } from '../interface/document.service.interface';
import {
  UploadDocumentDto,
  UploadVersionDto,
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  TemplateQueryDto,
  DocumentListQueryDto,
} from '../../dto/request/document.request.dto';
import {
  DocumentResponseDto,
  DocumentVersionResponseDto,
  DocumentTemplateResponseDto,
  ServedFileDto,
  mapDocumentToResponse,
  mapVersionToResponse,
  mapCurrentDocumentToVersion,
  mapTemplateToResponse,
} from '../../dto/response/document.response.dto';
import { createStorageClient } from '../client/storage.client';
import { renderDocxFromDocumentXml } from '../../utility/docx-template.utility';

const uploaderInclude = {
  uploaded_by: {
    select: { display_name: true, first_name: true, last_name: true },
  },
} as const;

export class DocumentService implements IDocumentService {
  async upload(dto: UploadDocumentDto): Promise<DocumentResponseDto> {
    const storageProvider = config.storage.provider;
    const storageClient = this._storageClient(storageProvider);
    let storedName: string | undefined;

    try {
      storedName = await storageClient.save(dto.buffer, dto.originalName);

      const document = await prisma.document.create({
        data: {
          uploaded_by_id: dto.uploadedById,
          original_name: dto.originalName,
          stored_name: storedName,
          mime_type: dto.mimeType,
          file_size: dto.fileSize,
          storage_path: storedName,
          storage_provider: storageProvider,
          module: dto.module,
          entity_type: dto.entityType,
          entity_id: dto.entityId,
        },
        include: uploaderInclude,
      });

      logger.info('Document uploaded', { documentId: document.id, module: dto.module });
      const url = await this._storageClient(document.storage_provider).getUrl(document.storage_path);
      return mapDocumentToResponse(document, url);
    } catch (err) {
      if (storedName) {
        await storageClient.delete(storedName).catch(() => undefined);
      }
      throw err;
    }
  }

  async getById(id: string, requesterId: string): Promise<DocumentResponseDto> {
    const doc = await prisma.document.findUnique({
      where: { id, deleted_at: null },
      include: uploaderInclude,
    });
    if (!doc) throw AppError.notFound('Document');
    this._assertCanAccess(doc, requesterId);
    const url = await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
    return mapDocumentToResponse(doc, url);
  }

  async getDownloadUrl(id: string): Promise<string> {
    const doc = await prisma.document.findUnique({
      where: { id, deleted_at: null },
      select: { storage_path: true, storage_provider: true },
    });
    if (!doc) throw AppError.notFound('Document');
    return this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
  }

  async delete(id: string, actorId: string): Promise<void> {
    const doc = await prisma.document.findUnique({
      where: { id, deleted_at: null },
    });
    if (!doc) throw AppError.notFound('Document');
    this._assertCanAccess(doc, actorId);

    await prisma.document.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this._storageClient(doc.storage_provider).delete(doc.storage_path);
    logger.info('Document deleted', { documentId: id, actorId });
  }

  async list(
    query: DocumentListQueryDto,
    ownerId: string,
  ): Promise<{ documents: DocumentResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    // Personal storage: only the documents this user uploaded. Other users'
    // uploads are never visible from the standalone Documents listing.
    const where: Prisma.DocumentWhereInput = {
      deleted_at: null,
      uploaded_by_id: ownerId,
      ...(query.entityType && { entity_type: query.entityType }),
      ...(query.search && {
        original_name: { contains: query.search },
      }),
    };

    const [total, docs] = await prisma.$transaction([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take,
        include: uploaderInclude,
      }),
    ]);

    const documents = await Promise.all(
      docs.map(async (doc) => {
        const url = await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
        return mapDocumentToResponse(doc, url);
      }),
    );

    return { documents, meta: buildPaginationMeta(total, page, pageSize) };
  }

  async listByEntity(
    entityType: string,
    entityId: string,
  ): Promise<DocumentResponseDto[]> {
    const docs = await prisma.document.findMany({
      where: { entity_type: entityType, entity_id: entityId, deleted_at: null },
      orderBy: { created_at: 'desc' },
      include: uploaderInclude,
    });

    return Promise.all(
      docs.map(async (doc) => {
        const url = await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
        return mapDocumentToResponse(doc, url);
      }),
    );
  }

  async listByEntityIds(
    entityType: string,
    entityIds: string[],
  ): Promise<Map<string, DocumentResponseDto[]>> {
    const grouped = new Map<string, DocumentResponseDto[]>();
    if (entityIds.length === 0) return grouped;

    // Single query for every entity in the batch — callers that previously
    // looped over listByEntity collapse from N queries to 1.
    const docs = await prisma.document.findMany({
      where: { entity_type: entityType, entity_id: { in: entityIds }, deleted_at: null },
      orderBy: { created_at: 'desc' },
      include: uploaderInclude,
    });

    const mapped = await Promise.all(
      docs.map(async (doc) => ({
        entityId: doc.entity_id,
        dto: mapDocumentToResponse(
          doc,
          await this._storageClient(doc.storage_provider).getUrl(doc.storage_path),
        ),
      })),
    );

    for (const { entityId, dto } of mapped) {
      if (!entityId) continue;
      const bucket = grouped.get(entityId);
      if (bucket) bucket.push(dto);
      else grouped.set(entityId, [dto]);
    }
    return grouped;
  }

  /**
   * Personal-isolation guard for the generic by-id routes (`GET /documents/:id/file`
   * and `/download`). Those service reads are also used internally to assemble
   * engagement/signature PDFs, so the check lives here and is invoked from the
   * controller rather than inside the read methods. Entity-attached documents
   * (engagement evidence, attachments, signatures, …) are exempt, so every party
   * linked to an engagement keeps access to its shared documents.
   */
  async assertCanUserAccess(documentId: string, requesterId: string): Promise<void> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId, deleted_at: null },
      select: { entity_type: true, uploaded_by_id: true },
    });
    if (!doc) throw AppError.notFound('Document');
    this._assertCanAccess(doc, requesterId);
  }

  async getFileById(id: string): Promise<ServedFileDto> {
    const doc = await prisma.document.findUnique({
      where: { id, deleted_at: null },
      select: {
        mime_type: true,
        original_name: true,
        file_size: true,
        storage_provider: true,
        storage_path: true,
      },
    });
    if (!doc) throw AppError.notFound('Document');

    const buffer = await this._storageClient(doc.storage_provider).read(doc.storage_path);
    return {
      buffer,
      mimeType: doc.mime_type,
      originalName: doc.original_name,
      fileSize: doc.file_size,
    };
  }

  async serveFile(storedName: string, requesterId: string): Promise<ServedFileDto> {
    // Resolve the storage key to an owning record. Current versions live on
    // the Document row; historical versions live on Document_Version. Either
    // must exist and not belong to a soft-deleted document.
    const doc = await prisma.document.findFirst({
      where: { storage_path: storedName, deleted_at: null },
      select: {
        mime_type: true,
        original_name: true,
        file_size: true,
        storage_provider: true,
        entity_type: true,
        uploaded_by_id: true,
      },
    });

    let mimeType: string;
    let originalName: string;
    let fileSize: number;
    let storageProvider: string;

    if (doc) {
      this._assertCanAccess(doc, requesterId);
      mimeType = doc.mime_type;
      originalName = doc.original_name;
      fileSize = doc.file_size;
      storageProvider = doc.storage_provider;
    } else {
      const version = await prisma.document_Version.findFirst({
        where: {
          storage_path: storedName,
          document: { deleted_at: null },
        },
        select: {
          mime_type: true,
          original_name: true,
          file_size: true,
          storage_provider: true,
          // A historical version inherits its parent document's access rules.
          document: { select: { entity_type: true, uploaded_by_id: true } },
        },
      });
      if (!version) throw AppError.notFound('File');
      this._assertCanAccess(version.document, requesterId);
      mimeType = version.mime_type;
      originalName = version.original_name;
      fileSize = version.file_size;
      storageProvider = version.storage_provider;
    }

    const buffer = await this._storageClient(storageProvider).read(storedName);
    return { buffer, mimeType, originalName, fileSize };
  }

  // ────────────────────────────────────────────────────────────
  // Versioning
  // ────────────────────────────────────────────────────────────

  async uploadNewVersion(
    documentId: string,
    dto: UploadVersionDto,
  ): Promise<DocumentVersionResponseDto> {
    const storageProvider = config.storage.provider;
    const storageClient = this._storageClient(storageProvider);
    const doc = await prisma.document.findUnique({
      where: { id: documentId, deleted_at: null },
    });
    if (!doc) throw AppError.notFound('Document');
    this._assertCanAccess(doc, dto.uploadedById);

    const newVersionNumber = doc.version_number + 1;
    let storedName: string | undefined;

    // Ensure the outgoing current version is present in Document_Version,
    // then persist the uploaded version with its change note before updating
    // the Document row that holds the current-version state.
    try {
      storedName = await storageClient.save(dto.buffer, dto.originalName);

      const version = await prisma.$transaction(async (tx) => {
        const existingCurrentVersion = await tx.document_Version.findUnique({
          where: {
            document_id_version_number: {
              document_id: doc.id,
              version_number: doc.version_number,
            },
          },
          select: { id: true },
        });

        if (!existingCurrentVersion) {
          await tx.document_Version.create({
            data: {
              document_id: doc.id,
              version_number: doc.version_number,
              uploaded_by_id: doc.uploaded_by_id,
              original_name: doc.original_name,
              stored_name: doc.stored_name,
              mime_type: doc.mime_type,
              file_size: doc.file_size,
              storage_path: doc.storage_path,
              storage_provider: doc.storage_provider,
              change_note: null,
            },
          });
        }

        const newVersion = await tx.document_Version.create({
          data: {
            document_id: doc.id,
            version_number: newVersionNumber,
            uploaded_by_id: dto.uploadedById,
            original_name: dto.originalName,
            stored_name: storedName!,
            mime_type: dto.mimeType,
            file_size: dto.fileSize,
            storage_path: storedName!,
            storage_provider: storageProvider,
            change_note: dto.changeNote ?? null,
          },
        });

        await tx.document.update({
          where: { id: doc.id },
          data: {
            uploaded_by_id: dto.uploadedById,
            original_name: dto.originalName,
            stored_name: storedName,
            mime_type: dto.mimeType,
            file_size: dto.fileSize,
            storage_path: storedName,
            storage_provider: storageProvider,
            version_number: newVersionNumber,
          },
        });

        return newVersion;
      });

      logger.info('Document new version uploaded', {
        documentId: doc.id,
        previousVersion: doc.version_number,
        newVersion: newVersionNumber,
        actorId: dto.uploadedById,
      });

      const url = await this._storageClient(version.storage_provider).getUrl(version.storage_path);
      return mapVersionToResponse(version, true, url);
    } catch (err) {
      if (storedName) {
        await storageClient.delete(storedName).catch(() => undefined);
      }
      throw err;
    }
  }

  async listVersions(
    documentId: string,
    requesterId: string,
  ): Promise<DocumentVersionResponseDto[]> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId, deleted_at: null },
    });
    if (!doc) throw AppError.notFound('Document');
    this._assertCanAccess(doc, requesterId);

    const history = await prisma.document_Version.findMany({
      where: { document_id: documentId },
      orderBy: { version_number: 'desc' },
    });

    const currentVersion = history.find(
      (v) => v.version_number === doc.version_number,
    );
    const currentUrl = currentVersion
      ? await this._storageClient(currentVersion.storage_provider).getUrl(currentVersion.storage_path)
      : await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
    const current = currentVersion
      ? mapVersionToResponse(currentVersion, true, currentUrl)
      : mapCurrentDocumentToVersion(doc, currentUrl);

    const historical = await Promise.all(
      history
        .filter((v: Document_Version) => v.version_number !== doc.version_number)
        .map(async (v: Document_Version) => {
          const url = await this._storageClient(v.storage_provider).getUrl(v.storage_path);
          return mapVersionToResponse(v, false, url);
        }),
    );

    return [current, ...historical];
  }

  async getVersion(
    documentId: string,
    versionNumber: number,
    requesterId: string,
  ): Promise<DocumentVersionResponseDto> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId, deleted_at: null },
    });
    if (!doc) throw AppError.notFound('Document');
    this._assertCanAccess(doc, requesterId);

    if (versionNumber === doc.version_number) {
      const currentVersion = await prisma.document_Version.findUnique({
        where: {
          document_id_version_number: {
            document_id: documentId,
            version_number: versionNumber,
          },
        },
      });
      const url = currentVersion
        ? await this._storageClient(currentVersion.storage_provider).getUrl(currentVersion.storage_path)
        : await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
      return currentVersion
        ? mapVersionToResponse(currentVersion, true, url)
        : mapCurrentDocumentToVersion(doc, url);
    }

    const version = await prisma.document_Version.findUnique({
      where: {
        document_id_version_number: {
          document_id: documentId,
          version_number: versionNumber,
        },
      },
    });
    if (!version) throw AppError.notFound('Document version');

    const url = await this._storageClient(version.storage_provider).getUrl(version.storage_path);
    return mapVersionToResponse(version, false, url);
  }

  async getVersionDownloadUrl(
    documentId: string,
    versionNumber: number,
    requesterId: string,
  ): Promise<string> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId, deleted_at: null },
      select: {
        storage_path: true,
        storage_provider: true,
        version_number: true,
        entity_type: true,
        uploaded_by_id: true,
      },
    });
    if (!doc) throw AppError.notFound('Document');
    this._assertCanAccess(doc, requesterId);

    if (versionNumber === doc.version_number) {
      return this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
    }

    const version = await prisma.document_Version.findUnique({
      where: {
        document_id_version_number: {
          document_id: documentId,
          version_number: versionNumber,
        },
      },
      select: { storage_path: true, storage_provider: true },
    });
    if (!version) throw AppError.notFound('Document version');

    return this._storageClient(version.storage_provider).getUrl(version.storage_path);
  }

  // ────────────────────────────────────────────────────────────
  // Templates
  // ────────────────────────────────────────────────────────────

  async createTemplate(
    dto: CreateTemplateRequestDto,
    actorId: string,
  ): Promise<DocumentTemplateResponseDto> {
    if (dto.content === undefined && dto.documentId === undefined) {
      throw AppError.badRequest(
        'Either content or documentId must be provided',
      );
    }

    const existing = await prisma.document_Template.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw AppError.conflict(
        `Template with name '${dto.name}' already exists`,
      );
    }

    if (dto.documentId) {
      await this._assertDocumentExists(dto.documentId);
    }

    const template = await prisma.document_Template.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        content: dto.content,
        document_id: dto.documentId,
        metadata: dto.metadata,
        is_active: dto.isActive ?? true,
        created_by_id: actorId,
      },
    });

    logger.info('Document template created', {
      templateId: template.id,
      name: template.name,
      actorId,
    });
    return mapTemplateToResponse(template);
  }

  async getTemplateById(id: string): Promise<DocumentTemplateResponseDto> {
    const template = await prisma.document_Template.findFirst({
      where: { id, deleted_at: null },
    });
    if (!template) throw AppError.notFound('Template');
    return mapTemplateToResponse(template);
  }

  async listTemplates(
    query: TemplateQueryDto,
  ): Promise<{ templates: DocumentTemplateResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where: Prisma.Document_TemplateWhereInput = {
      deleted_at: null,
      ...(query.category && { category: query.category }),
      ...(query.isActive !== undefined && { is_active: query.isActive }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search } },
          { description: { contains: query.search } },
        ],
      }),
    };

    const [total, templates] = await prisma.$transaction([
      prisma.document_Template.count({ where }),
      prisma.document_Template.findMany({
        where,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      templates: templates.map(mapTemplateToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  async updateTemplate(
    id: string,
    dto: UpdateTemplateRequestDto,
    actorId: string,
  ): Promise<DocumentTemplateResponseDto> {
    await this._assertTemplateExists(id);

    if (dto.name) {
      const clash = await prisma.document_Template.findFirst({
        where: { name: dto.name, id: { not: id }, deleted_at: null },
        select: { id: true },
      });
      if (clash) {
        throw AppError.conflict(
          `Template with name '${dto.name}' already exists`,
        );
      }
    }

    if (dto.documentId) {
      await this._assertDocumentExists(dto.documentId);
    }

    const template = await prisma.document_Template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.documentId !== undefined && { document_id: dto.documentId }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
        ...(dto.isActive !== undefined && { is_active: dto.isActive }),
        updated_by_id: actorId,
      },
    });

    logger.info('Document template updated', { templateId: id, actorId });
    return mapTemplateToResponse(template);
  }

  async deleteTemplate(id: string, actorId: string): Promise<void> {
    await this._assertTemplateExists(id);

    await prisma.document_Template.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        is_active: false,
        updated_by_id: actorId,
      },
    });

    logger.info('Document template soft-deleted', { templateId: id, actorId });
  }

  async renderDocxTemplate(
    category: string,
    data: Record<string, unknown>,
  ): Promise<Buffer> {
    const template = await prisma.document_Template.findFirst({
      where: { category, is_active: true, deleted_at: null },
      orderBy: { updated_at: 'desc' },
      select: { id: true, content: true, name: true },
    });

    if (!template?.content) {
      throw AppError.notFound(`Active DOCX template for category '${category}'`);
    }

    return renderDocxFromDocumentXml(template.content, data);
  }

  async pruneOldVersions(): Promise<{ prunedCount: number; failedCount: number }> {
    // Read retention config from system_config
    const configRow = await prisma.system_Config.findUnique({
      where: { key: 'version_retention' },
      select: { value: true },
    });

    let retentionConfig = { enabled: false, keepLastVersions: 10 };
    if (configRow?.value) {
      try {
        const parsed = JSON.parse(configRow.value);
        retentionConfig = { ...retentionConfig, ...parsed };
      } catch {
        logger.warn('Invalid JSON in version_retention config, using defaults');
      }
    }

    if (!retentionConfig.enabled) {
      logger.info('Version retention is disabled, skipping prune');
      return { prunedCount: 0, failedCount: 0 };
    }

    const keepN = Math.max(1, retentionConfig.keepLastVersions);
    let prunedCount = 0;
    let failedCount = 0;

    // Find documents with versions to prune
    const documentsWithVersions = await prisma.document.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        versions: {
          orderBy: { version_number: 'desc' },
          select: {
            id: true,
            version_number: true,
            storage_path: true,
            storage_provider: true,
          },
        },
      },
    });

    for (const doc of documentsWithVersions) {
      if (doc.versions.length <= keepN) continue;

      // Keep the first N (most recent by version_number desc), prune the rest
      const toPrune = doc.versions.slice(keepN);

      for (const version of toPrune) {
        try {
          // Delete from storage first
          await this._storageClient(version.storage_provider).delete(version.storage_path);

          // Then delete the DB row
          await prisma.document_Version.delete({
            where: { id: version.id },
          });

          prunedCount++;
        } catch (err) {
          failedCount++;
          logger.error('Failed to prune document version', {
            versionId: version.id,
            documentId: doc.id,
            storagePath: version.storage_path,
            err: String(err),
          });
        }
      }
    }

    logger.info('Version retention prune completed', { prunedCount, failedCount });
    return { prunedCount, failedCount };
  }

  private _storageClient(provider: string = config.storage.provider) {
    return createStorageClient(provider);
  }

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
  private _assertCanAccess(
    doc: { entity_type: string | null; uploaded_by_id: string },
    requesterId: string,
  ): void {
    if (doc.entity_type === null && doc.uploaded_by_id !== requesterId) {
      throw AppError.notFound('Document');
    }
  }

  private async _assertTemplateExists(id: string): Promise<void> {
    const template = await prisma.document_Template.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });
    if (!template) throw AppError.notFound('Template');
  }

  private async _assertDocumentExists(id: string): Promise<void> {
    const doc = await prisma.document.findUnique({
      where: { id, deleted_at: null },
      select: { id: true },
    });
    if (!doc) throw AppError.notFound('Document');
  }
}
