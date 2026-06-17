// src/modules/user/service/implementation/signature.service.ts
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { AppError } from '../../../../shared/errors/app.error';
import { IDocumentService } from '../../../document/service/interface/document.service.interface';
import { DocumentService } from '../../../document';
import { SetSignatureDto } from '../../dto/request/signature.request.dto';
import {
  UserSignatureResponseDto,
  mapSignatureToResponse,
} from '../../dto/response/signature.response.dto';
import { IUserSignatureService } from '../interface/signature.service.interface';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export class UserSignatureService implements IUserSignatureService {
  constructor(private readonly documents: IDocumentService) {}

  async setSignature(dto: SetSignatureDto): Promise<UserSignatureResponseDto> {
    if (!ALLOWED_MIME.has(dto.mimeType)) {
      throw AppError.badRequest('Signature must be a PNG or JPG image');
    }
    if (dto.fileSize > MAX_BYTES) {
      throw AppError.badRequest('Signature image must be 2 MB or smaller');
    }

    const doc = await this.documents.upload({
      uploadedById: dto.userId,
      originalName: dto.originalName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      buffer: dto.buffer,
      module: 'user',
      entityType: 'user_signature',
      entityId: dto.userId,
    });

    const row = await prisma.$transaction(async (tx) => {
      await tx.user_Signature.updateMany({
        where: { user_id: dto.userId, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      return tx.user_Signature.create({
        data: { user_id: dto.userId, document_id: doc.id, kind: dto.kind },
      });
    });

    logger.info('User signature set', { userId: dto.userId, signatureId: row.id, kind: dto.kind });
    return mapSignatureToResponse(row);
  }

  async getActiveSignature(userId: string): Promise<UserSignatureResponseDto | null> {
    const row = await prisma.user_Signature.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return row ? mapSignatureToResponse(row) : null;
  }

  async getActiveSignatureRef(userId: string): Promise<{ id: string; documentId: string } | null> {
    const row = await prisma.user_Signature.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' },
      select: { id: true, document_id: true },
    });
    return row ? { id: row.id, documentId: row.document_id } : null;
  }

  async removeSignature(userId: string): Promise<void> {
    await prisma.user_Signature.updateMany({
      where: { user_id: userId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    logger.info('User signature removed', { userId });
  }
}

export const userSignatureService = new UserSignatureService(new DocumentService());
