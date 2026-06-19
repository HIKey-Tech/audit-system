"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userSignatureService = exports.UserSignatureService = void 0;
// src/modules/user/service/implementation/signature.service.ts
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_error_1 = require("../../../../shared/errors/app.error");
const document_1 = require("../../../document");
const signature_response_dto_1 = require("../../dto/response/signature.response.dto");
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
class UserSignatureService {
    documents;
    constructor(documents) {
        this.documents = documents;
    }
    async setSignature(dto) {
        if (!ALLOWED_MIME.has(dto.mimeType)) {
            throw app_error_1.AppError.badRequest('Signature must be a PNG or JPG image');
        }
        if (dto.fileSize > MAX_BYTES) {
            throw app_error_1.AppError.badRequest('Signature image must be 2 MB or smaller');
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
        const row = await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.user_Signature.updateMany({
                where: { user_id: dto.userId, deleted_at: null },
                data: { deleted_at: new Date() },
            });
            return tx.user_Signature.create({
                data: { user_id: dto.userId, document_id: doc.id, kind: dto.kind },
            });
        });
        logger_util_1.logger.info('User signature set', { userId: dto.userId, signatureId: row.id, kind: dto.kind });
        return (0, signature_response_dto_1.mapSignatureToResponse)(row);
    }
    async getActiveSignature(userId) {
        const row = await prisma_client_1.prisma.user_Signature.findFirst({
            where: { user_id: userId, deleted_at: null },
            orderBy: { created_at: 'desc' },
        });
        return row ? (0, signature_response_dto_1.mapSignatureToResponse)(row) : null;
    }
    async getActiveSignatureRef(userId) {
        const row = await prisma_client_1.prisma.user_Signature.findFirst({
            where: { user_id: userId, deleted_at: null },
            orderBy: { created_at: 'desc' },
            select: { id: true, document_id: true },
        });
        return row ? { id: row.id, documentId: row.document_id } : null;
    }
    async removeSignature(userId) {
        await prisma_client_1.prisma.user_Signature.updateMany({
            where: { user_id: userId, deleted_at: null },
            data: { deleted_at: new Date() },
        });
        logger_util_1.logger.info('User signature removed', { userId });
    }
}
exports.UserSignatureService = UserSignatureService;
exports.userSignatureService = new UserSignatureService(new document_1.DocumentService());
//# sourceMappingURL=signature.service.js.map