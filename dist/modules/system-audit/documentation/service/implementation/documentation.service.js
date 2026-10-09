"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemDocumentationService = void 0;
const crypto_1 = require("crypto");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const prisma_types_1 = require("../../../../../shared/prisma/prisma.types");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
const documentation_response_dto_1 = require("../../dto/response/documentation.response.dto");
const inDays = (days) => new Date(Date.now() + days * 86_400_000);
class SystemDocumentationService {
    documentService;
    userService;
    universeService;
    assetService;
    engagementService;
    constructor(documentService, userService, universeService, assetService, engagementService) {
        this.documentService = documentService;
        this.userService = userService;
        this.universeService = universeService;
        this.assetService = assetService;
        this.engagementService = engagementService;
    }
    async create(dto, file, actor) {
        const ownerId = dto.ownerId ?? actor.id;
        await this._assertReferences({ ownerId, universeId: dto.universeId, assetId: dto.assetId }, actor);
        const id = (0, crypto_1.randomUUID)();
        const document = await this.documentService.upload({
            uploadedById: actor.id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            fileSize: file.fileSize,
            buffer: file.buffer,
            module: 'system-audit',
            entityType: 'system_document',
            entityId: id,
        });
        await prisma_client_1.prisma.system_Document.create({
            data: {
                id,
                document_id: document.id,
                title: dto.title,
                doc_type: dto.docType,
                description: dto.description ?? null,
                version_label: dto.versionLabel ?? null,
                owner_id: ownerId,
                universe_id: dto.universeId ?? null,
                asset_id: dto.assetId ?? null,
                vendor: dto.vendor ?? null,
                effective_date: dto.effectiveDate ?? null,
                review_due_date: dto.reviewDueDate ?? null,
                expiry_date: dto.expiryDate ?? null,
                created_by_id: actor.id,
            },
        });
        logger_util_1.logger.info('System document added', { systemDocumentId: id, docType: dto.docType, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.documentation.create',
            module: 'system-audit',
            entityType: 'system_document',
            entityId: id,
            newValues: { ...dto, ownerId, fileName: file.originalName, contentSha256: document.contentSha256 },
        });
        return this.get(id);
    }
    async update(id, dto, actor) {
        const existing = await this._getExisting(id);
        await this._assertReferences({ ownerId: dto.ownerId, universeId: dto.universeId ?? undefined, assetId: dto.assetId ?? undefined }, actor);
        await prisma_client_1.prisma.system_Document.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.docType !== undefined && { doc_type: dto.docType }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.versionLabel !== undefined && { version_label: dto.versionLabel }),
                ...(dto.ownerId !== undefined && { owner_id: dto.ownerId }),
                ...(dto.universeId !== undefined && { universe_id: dto.universeId }),
                ...(dto.assetId !== undefined && { asset_id: dto.assetId }),
                ...(dto.vendor !== undefined && { vendor: dto.vendor }),
                ...(dto.effectiveDate !== undefined && { effective_date: dto.effectiveDate }),
                ...(dto.reviewDueDate !== undefined && { review_due_date: dto.reviewDueDate }),
                ...(dto.expiryDate !== undefined && { expiry_date: dto.expiryDate }),
                ...(dto.status !== undefined && { status: dto.status }),
            },
        });
        logger_util_1.logger.info('System document updated', { systemDocumentId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.documentation.update',
            module: 'system-audit',
            entityType: 'system_document',
            entityId: id,
            oldValues: (0, documentation_response_dto_1.mapSystemDocumentToResponse)(existing),
            newValues: dto,
        });
        return this.get(id);
    }
    async uploadVersion(id, dto, file, actor) {
        const existing = await this._getExisting(id);
        await this.documentService.uploadNewVersion(existing.document_id, {
            uploadedById: actor.id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            fileSize: file.fileSize,
            buffer: file.buffer,
            changeNote: dto.changeNote,
        });
        if (dto.versionLabel !== undefined || dto.reviewDueDate !== undefined) {
            await prisma_client_1.prisma.system_Document.update({
                where: { id },
                data: {
                    ...(dto.versionLabel !== undefined && { version_label: dto.versionLabel }),
                    ...(dto.reviewDueDate !== undefined && { review_due_date: dto.reviewDueDate }),
                },
            });
        }
        logger_util_1.logger.info('System document version uploaded', { systemDocumentId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.documentation.version',
            module: 'system-audit',
            entityType: 'system_document',
            entityId: id,
            newValues: { ...dto, fileName: file.originalName },
        });
        return this.get(id);
    }
    async remove(id, actor) {
        await this._getExisting(id);
        await prisma_client_1.prisma.system_Document.update({
            where: { id },
            data: { deleted_at: new Date(), status: system_audit_enum_1.SystemDocumentStatus.Archived },
        });
        logger_util_1.logger.info('System document removed', { systemDocumentId: id, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.documentation.delete',
            module: 'system-audit',
            entityType: 'system_document',
            entityId: id,
        });
    }
    async get(id) {
        return (0, documentation_response_dto_1.mapSystemDocumentToResponse)(await this._getExisting(id));
    }
    async list(query, actor) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const now = new Date();
        const and = [
            { deleted_at: null, status: query.status ?? system_audit_enum_1.SystemDocumentStatus.Active },
        ];
        if (query.docType)
            and.push({ doc_type: query.docType });
        if (query.universeId)
            and.push({ universe_id: query.universeId });
        if (query.assetId)
            and.push({ asset_id: query.assetId });
        if (query.ownerId)
            and.push({ owner_id: query.ownerId });
        if (query.engagementId)
            and.push(await this._engagementScope(query.engagementId, actor));
        if (query.reviewState === 'overdue')
            and.push({ review_due_date: { lt: now } });
        if (query.reviewState === 'due_soon')
            and.push({ review_due_date: { gte: now, lte: inDays(documentation_response_dto_1.REVIEW_DUE_SOON_DAYS) } });
        if (query.contractState === 'expired')
            and.push({ expiry_date: { lt: now } });
        if (query.contractState === 'expiring')
            and.push({ expiry_date: { gte: now, lte: inDays(documentation_response_dto_1.CONTRACT_EXPIRING_DAYS) } });
        if (query.search) {
            and.push({
                OR: [
                    { title: { contains: query.search } },
                    { description: { contains: query.search } },
                    { vendor: { contains: query.search } },
                ],
            });
        }
        const where = { AND: and };
        const [total, documents] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.system_Document.count({ where }),
            prisma_client_1.prisma.system_Document.findMany({
                where,
                include: prisma_types_1.systemDocumentInclude,
                orderBy: [{ doc_type: 'asc' }, { title: 'asc' }],
                skip,
                take,
            }),
        ]);
        return {
            documents: documents.map((d) => (0, documentation_response_dto_1.mapSystemDocumentToResponse)(d, now)),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async summary() {
        const now = new Date();
        const base = { deleted_at: null, status: system_audit_enum_1.SystemDocumentStatus.Active };
        const [byType, reviewOverdue, reviewDueSoon, contractsExpired, contractsExpiring] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.system_Document.groupBy({ by: ['doc_type'], where: base, _count: { _all: true }, orderBy: { doc_type: 'asc' } }),
            prisma_client_1.prisma.system_Document.count({ where: { ...base, review_due_date: { lt: now } } }),
            prisma_client_1.prisma.system_Document.count({ where: { ...base, review_due_date: { gte: now, lte: inDays(documentation_response_dto_1.REVIEW_DUE_SOON_DAYS) } } }),
            prisma_client_1.prisma.system_Document.count({ where: { ...base, expiry_date: { lt: now } } }),
            prisma_client_1.prisma.system_Document.count({ where: { ...base, expiry_date: { gte: now, lte: inDays(documentation_response_dto_1.CONTRACT_EXPIRING_DAYS) } } }),
        ]);
        const types = Object.fromEntries(byType.map((t) => [t.doc_type, typeof t._count === 'object' ? (t._count._all ?? 0) : 0]));
        return {
            total: Object.values(types).reduce((n, c) => n + c, 0),
            byType: types,
            reviewOverdue,
            reviewDueSoon,
            contractsExpired,
            contractsExpiring,
        };
    }
    async getFile(id, actor) {
        const doc = await this._getExisting(id);
        const file = await this.documentService.getFileById(doc.document_id);
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'system_audit.documentation.download',
            module: 'system-audit',
            entityType: 'system_document',
            entityId: id,
        });
        return { buffer: file.buffer, mimeType: file.mimeType, originalName: file.originalName };
    }
    // ── internals ───────────────────────────────────────────────
    async _getExisting(id) {
        const doc = await prisma_client_1.prisma.system_Document.findFirst({ where: { id, deleted_at: null }, include: prisma_types_1.systemDocumentInclude });
        if (!doc)
            throw app_error_1.AppError.notFound('System document');
        return doc;
    }
    async _assertReferences(refs, actor) {
        const ctx = { id: actor.id, roles: actor.roles, permissions: actor.permissions, isSuperAdmin: actor.isSuperAdmin };
        if (refs.ownerId)
            await this.userService.getUserById(refs.ownerId);
        if (refs.universeId)
            await this.universeService.getEntityById(refs.universeId, ctx);
        if (refs.assetId)
            await this.assetService.getAssetById(refs.assetId, ctx);
    }
    /** An engagement's scope: its audit-universe entity plus the assets linked to it. */
    async _engagementScope(engagementId, actor) {
        const ctx = { id: actor.id, roles: actor.roles, permissions: actor.permissions, isSuperAdmin: actor.isSuperAdmin };
        const engagement = await this.engagementService.getEngagementById(engagementId, ctx);
        const assets = await this.assetService.listAssetsForEngagement(engagementId, ctx);
        return {
            OR: [
                { universe_id: engagement.universeId },
                ...(assets.length > 0 ? [{ asset_id: { in: assets.map((a) => a.id) } }] : []),
            ],
        };
    }
}
exports.SystemDocumentationService = SystemDocumentationService;
//# sourceMappingURL=documentation.service.js.map