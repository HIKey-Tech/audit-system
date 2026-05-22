// src/modules/document/service/implementation/document.service.ts
import type { Document, Document_Version, Prisma } from '@prisma/client';
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

export class DocumentService implements IDocumentService {
  async upload(dto: UploadDocumentDto): Promise<DocumentResponseDto> {
    const storageProvider = config.storage.provider;
    const storageClient = this._storageClient(storageProvider);
    const document = await prisma.$transaction(async (tx) => {
      const pendingStoragePath = `pending:${dto.originalName}`;
      const createdDocument = await tx.document.create({
        data: {
          uploaded_by_id: dto.uploadedById,
          original_name: dto.originalName,
          stored_name: pendingStoragePath,
          mime_type: dto.mimeType,
          file_size: dto.fileSize,
          storage_path: pendingStoragePath,
          storage_provider: storageProvider,
          module: dto.module,
          entity_type: dto.entityType,
          entity_id: dto.entityId,
        },
      });

      let storedName: string | undefined;
      try {
        storedName = await storageClient.save(
          dto.buffer,
          dto.originalName,
        );

        return await tx.document.update({
          where: { id: createdDocument.id },
          data: {
            stored_name: storedName,
            storage_path: storedName,
          },
        });
      } catch (err) {
        if (storedName) {
          await storageClient.delete(storedName).catch(() => undefined);
        }
        throw err;
      }
    });

    logger.info('Document uploaded', { documentId: document.id, module: dto.module });
    const url = await this._storageClient(document.storage_provider).getUrl(document.storage_path);
    return mapDocumentToResponse(document, url);
  }

  async getById(id: string): Promise<DocumentResponseDto> {
    const doc = await prisma.document.findUnique({
      where: { id, deleted_at: null },
    });
    if (!doc) throw AppError.notFound('Document');
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

    await prisma.document.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this._storageClient(doc.storage_provider).delete(doc.storage_path);
    logger.info('Document deleted', { documentId: id, actorId });
  }

  async listByEntity(
    entityType: string,
    entityId: string,
  ): Promise<DocumentResponseDto[]> {
    const docs = await prisma.document.findMany({
      where: { entity_type: entityType, entity_id: entityId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      docs.map(async (doc: Document) => {
        const url = await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
        return mapDocumentToResponse(doc, url);
      }),
    );
  }

  async serveFile(storedName: string): Promise<ServedFileDto> {
    // Resolve the storage key to an owning record. Current versions live on
    // the Document row; historical versions live on Document_Version. Either
    // must exist and not belong to a soft-deleted document.
    const doc = await prisma.document.findFirst({
      where: { storage_path: storedName, deleted_at: null },
      select: { mime_type: true, original_name: true, file_size: true, storage_provider: true },
    });

    let mimeType: string;
    let originalName: string;
    let fileSize: number;
    let storageProvider: string;

    if (doc) {
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
        select: { mime_type: true, original_name: true, file_size: true, storage_provider: true },
      });
      if (!version) throw AppError.notFound('File');
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

    const newVersionNumber = doc.version_number + 1;

    // Ensure the outgoing current version is present in Document_Version,
    // then persist the uploaded version with its change note before updating
    // the Document row that holds the current-version state.
    const version = await prisma.$transaction(async (tx) => {
      const pendingStoragePath = `pending:${doc.id}:${newVersionNumber}`;
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
          stored_name: pendingStoragePath,
          mime_type: dto.mimeType,
          file_size: dto.fileSize,
          storage_path: pendingStoragePath,
          storage_provider: storageProvider,
          change_note: dto.changeNote ?? null,
        },
      });

      await tx.document.update({
        where: { id: doc.id },
        data: {
          uploaded_by_id: dto.uploadedById,
          original_name: dto.originalName,
          stored_name: pendingStoragePath,
          mime_type: dto.mimeType,
          file_size: dto.fileSize,
          storage_path: pendingStoragePath,
          storage_provider: storageProvider,
          version_number: newVersionNumber,
        },
      });

      let storedName: string | undefined;
      try {
        storedName = await storageClient.save(
          dto.buffer,
          dto.originalName,
        );

        await tx.document.update({
          where: { id: doc.id },
          data: {
            stored_name: storedName,
            storage_path: storedName,
          },
        });

        return await tx.document_Version.update({
          where: { id: newVersion.id },
          data: {
            stored_name: storedName,
            storage_path: storedName,
          },
        });
      } catch (err) {
        if (storedName) {
          await storageClient.delete(storedName).catch(() => undefined);
        }
        throw err;
      }
    });

    logger.info('Document new version uploaded', {
      documentId: doc.id,
      previousVersion: doc.version_number,
      newVersion: newVersionNumber,
      actorId: dto.uploadedById,
    });

    const url = await this._storageClient(version.storage_provider).getUrl(version.storage_path);
    return mapVersionToResponse(version, true, url);
  }

  async listVersions(
    documentId: string,
  ): Promise<DocumentVersionResponseDto[]> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId, deleted_at: null },
    });
    if (!doc) throw AppError.notFound('Document');

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
  ): Promise<DocumentVersionResponseDto> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId, deleted_at: null },
    });
    if (!doc) throw AppError.notFound('Document');

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
  ): Promise<string> {
    const doc = await prisma.document.findUnique({
      where: { id: documentId, deleted_at: null },
      select: { storage_path: true, storage_provider: true, version_number: true },
    });
    if (!doc) throw AppError.notFound('Document');

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

  private _storageClient(provider: string = config.storage.provider) {
    return createStorageClient(provider);
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
