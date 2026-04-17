// src/modules/document/service/implementation/document.service.ts
import { prisma } from '../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/utils/logger.util';
import { config } from '../../../../shared/config/app.config';
import {
  IDocumentService,
  UploadDocumentDto,
  DocumentResponseDto,
} from '../interface/document.service.interface';
import { createStorageClient, IStorageClient } from '../client/storage.client';

const mapToResponse = (doc: {
  id: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  storage_provider: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  uploaded_by_id: string;
  created_at: Date;
}, downloadUrl?: string): DocumentResponseDto => ({
  id: doc.id,
  originalName: doc.original_name,
  mimeType: doc.mime_type,
  fileSize: doc.file_size,
  storageProvider: doc.storage_provider,
  module: doc.module,
  entityType: doc.entity_type,
  entityId: doc.entity_id,
  uploadedById: doc.uploaded_by_id,
  createdAt: doc.created_at.toISOString(),
  downloadUrl,
});

export class DocumentService implements IDocumentService {
  private readonly storageClient: IStorageClient;

  constructor() {
    this.storageClient = createStorageClient();
  }

  async upload(dto: UploadDocumentDto): Promise<DocumentResponseDto> {
    const storedName = await this.storageClient.save(
      dto.buffer,
      dto.originalName,
    );

    const document = await prisma.document.create({
      data: {
        uploaded_by_id: dto.uploadedById,
        original_name: dto.originalName,
        stored_name: storedName,
        mime_type: dto.mimeType,
        file_size: dto.fileSize,
        storage_path: storedName,
        storage_provider: config.storage.provider,
        module: dto.module,
        entity_type: dto.entityType,
        entity_id: dto.entityId,
      },
    });

    logger.info({ documentId: document.id, module: dto.module }, 'Document uploaded');
    const url = await this.storageClient.getUrl(storedName);
    return mapToResponse(document, url);
  }

  async getById(id: string): Promise<DocumentResponseDto> {
    const doc = await prisma.document.findUnique({
      where: { id, is_deleted: false },
    });
    if (!doc) throw AppError.notFound('Document');
    const url = await this.storageClient.getUrl(doc.storage_path);
    return mapToResponse(doc, url);
  }

  async getDownloadUrl(id: string): Promise<string> {
    const doc = await prisma.document.findUnique({
      where: { id, is_deleted: false },
      select: { storage_path: true },
    });
    if (!doc) throw AppError.notFound('Document');
    return this.storageClient.getUrl(doc.storage_path);
  }

  async delete(id: string, actorId: string): Promise<void> {
    const doc = await prisma.document.findUnique({
      where: { id, is_deleted: false },
    });
    if (!doc) throw AppError.notFound('Document');

    await prisma.document.update({
      where: { id },
      data: { is_deleted: true, deleted_at: new Date() },
    });

    await this.storageClient.delete(doc.storage_path);
    logger.info({ documentId: id, actorId }, 'Document deleted');
  }

  async listByEntity(
    entityType: string,
    entityId: string,
  ): Promise<DocumentResponseDto[]> {
    const docs = await prisma.document.findMany({
      where: { entity_type: entityType, entity_id: entityId, is_deleted: false },
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(
      docs.map(async (doc) => {
        const url = await this.storageClient.getUrl(doc.storage_path);
        return mapToResponse(doc, url);
      }),
    );
  }
}
