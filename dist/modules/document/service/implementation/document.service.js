"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const document_response_dto_1 = require("../../dto/response/document.response.dto");
const storage_client_1 = require("../client/storage.client");
const docx_template_utility_1 = require("../../utility/docx-template.utility");
class DocumentService {
    storageClient;
    constructor() {
        this.storageClient = (0, storage_client_1.createStorageClient)();
    }
    async upload(dto) {
        const document = await prisma_client_1.prisma.$transaction(async (tx) => {
            const pendingStoragePath = `pending:${dto.originalName}`;
            const createdDocument = await tx.document.create({
                data: {
                    uploaded_by_id: dto.uploadedById,
                    original_name: dto.originalName,
                    stored_name: pendingStoragePath,
                    mime_type: dto.mimeType,
                    file_size: dto.fileSize,
                    storage_path: pendingStoragePath,
                    storage_provider: app_config_1.config.storage.provider,
                    module: dto.module,
                    entity_type: dto.entityType,
                    entity_id: dto.entityId,
                },
            });
            let storedName;
            try {
                storedName = await this.storageClient.save(dto.buffer, dto.originalName);
                return await tx.document.update({
                    where: { id: createdDocument.id },
                    data: {
                        stored_name: storedName,
                        storage_path: storedName,
                    },
                });
            }
            catch (err) {
                if (storedName) {
                    await this.storageClient.delete(storedName).catch(() => undefined);
                }
                throw err;
            }
        });
        logger_util_1.logger.info('Document uploaded', { documentId: document.id, module: dto.module });
        const url = await this.storageClient.getUrl(document.storage_path);
        return (0, document_response_dto_1.mapDocumentToResponse)(document, url);
    }
    async getById(id) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        const url = await this.storageClient.getUrl(doc.storage_path);
        return (0, document_response_dto_1.mapDocumentToResponse)(doc, url);
    }
    async getDownloadUrl(id) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id, deleted_at: null },
            select: { storage_path: true },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        return this.storageClient.getUrl(doc.storage_path);
    }
    async delete(id, actorId) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        await prisma_client_1.prisma.document.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
        await this.storageClient.delete(doc.storage_path);
        logger_util_1.logger.info('Document deleted', { documentId: id, actorId });
    }
    async listByEntity(entityType, entityId) {
        const docs = await prisma_client_1.prisma.document.findMany({
            where: { entity_type: entityType, entity_id: entityId, deleted_at: null },
            orderBy: { created_at: 'desc' },
        });
        return Promise.all(docs.map(async (doc) => {
            const url = await this.storageClient.getUrl(doc.storage_path);
            return (0, document_response_dto_1.mapDocumentToResponse)(doc, url);
        }));
    }
    async serveFile(storedName) {
        // Resolve the storage key to an owning record. Current versions live on
        // the Document row; historical versions live on Document_Version. Either
        // must exist and not belong to a soft-deleted document.
        const doc = await prisma_client_1.prisma.document.findFirst({
            where: { storage_path: storedName, deleted_at: null },
            select: { mime_type: true, original_name: true, file_size: true },
        });
        let mimeType;
        let originalName;
        let fileSize;
        if (doc) {
            mimeType = doc.mime_type;
            originalName = doc.original_name;
            fileSize = doc.file_size;
        }
        else {
            const version = await prisma_client_1.prisma.document_Version.findFirst({
                where: {
                    storage_path: storedName,
                    document: { deleted_at: null },
                },
                select: { mime_type: true, original_name: true, file_size: true },
            });
            if (!version)
                throw app_error_1.AppError.notFound('File');
            mimeType = version.mime_type;
            originalName = version.original_name;
            fileSize = version.file_size;
        }
        const buffer = await this.storageClient.read(storedName);
        return { buffer, mimeType, originalName, fileSize };
    }
    // ────────────────────────────────────────────────────────────
    // Versioning
    // ────────────────────────────────────────────────────────────
    async uploadNewVersion(documentId, dto) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        const newVersionNumber = doc.version_number + 1;
        // Ensure the outgoing current version is present in Document_Version,
        // then persist the uploaded version with its change note before updating
        // the Document row that holds the current-version state.
        const version = await prisma_client_1.prisma.$transaction(async (tx) => {
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
                    storage_provider: app_config_1.config.storage.provider,
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
                    storage_provider: app_config_1.config.storage.provider,
                    version_number: newVersionNumber,
                },
            });
            let storedName;
            try {
                storedName = await this.storageClient.save(dto.buffer, dto.originalName);
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
            }
            catch (err) {
                if (storedName) {
                    await this.storageClient.delete(storedName).catch(() => undefined);
                }
                throw err;
            }
        });
        logger_util_1.logger.info('Document new version uploaded', {
            documentId: doc.id,
            previousVersion: doc.version_number,
            newVersion: newVersionNumber,
            actorId: dto.uploadedById,
        });
        const url = await this.storageClient.getUrl(version.storage_path);
        return (0, document_response_dto_1.mapVersionToResponse)(version, true, url);
    }
    async listVersions(documentId) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        const history = await prisma_client_1.prisma.document_Version.findMany({
            where: { document_id: documentId },
            orderBy: { version_number: 'desc' },
        });
        const currentUrl = await this.storageClient.getUrl(doc.storage_path);
        const currentVersion = history.find((v) => v.version_number === doc.version_number);
        const current = currentVersion
            ? (0, document_response_dto_1.mapVersionToResponse)(currentVersion, true, currentUrl)
            : (0, document_response_dto_1.mapCurrentDocumentToVersion)(doc, currentUrl);
        const historical = await Promise.all(history
            .filter((v) => v.version_number !== doc.version_number)
            .map(async (v) => {
            const url = await this.storageClient.getUrl(v.storage_path);
            return (0, document_response_dto_1.mapVersionToResponse)(v, false, url);
        }));
        return [current, ...historical];
    }
    async getVersion(documentId, versionNumber) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        if (versionNumber === doc.version_number) {
            const url = await this.storageClient.getUrl(doc.storage_path);
            const currentVersion = await prisma_client_1.prisma.document_Version.findUnique({
                where: {
                    document_id_version_number: {
                        document_id: documentId,
                        version_number: versionNumber,
                    },
                },
            });
            return currentVersion
                ? (0, document_response_dto_1.mapVersionToResponse)(currentVersion, true, url)
                : (0, document_response_dto_1.mapCurrentDocumentToVersion)(doc, url);
        }
        const version = await prisma_client_1.prisma.document_Version.findUnique({
            where: {
                document_id_version_number: {
                    document_id: documentId,
                    version_number: versionNumber,
                },
            },
        });
        if (!version)
            throw app_error_1.AppError.notFound('Document version');
        const url = await this.storageClient.getUrl(version.storage_path);
        return (0, document_response_dto_1.mapVersionToResponse)(version, false, url);
    }
    async getVersionDownloadUrl(documentId, versionNumber) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
            select: { storage_path: true, version_number: true },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        if (versionNumber === doc.version_number) {
            return this.storageClient.getUrl(doc.storage_path);
        }
        const version = await prisma_client_1.prisma.document_Version.findUnique({
            where: {
                document_id_version_number: {
                    document_id: documentId,
                    version_number: versionNumber,
                },
            },
            select: { storage_path: true },
        });
        if (!version)
            throw app_error_1.AppError.notFound('Document version');
        return this.storageClient.getUrl(version.storage_path);
    }
    // ────────────────────────────────────────────────────────────
    // Templates
    // ────────────────────────────────────────────────────────────
    async createTemplate(dto, actorId) {
        if (dto.content === undefined && dto.documentId === undefined) {
            throw app_error_1.AppError.badRequest('Either content or documentId must be provided');
        }
        const existing = await prisma_client_1.prisma.document_Template.findUnique({
            where: { name: dto.name },
        });
        if (existing) {
            throw app_error_1.AppError.conflict(`Template with name '${dto.name}' already exists`);
        }
        if (dto.documentId) {
            await this._assertDocumentExists(dto.documentId);
        }
        const template = await prisma_client_1.prisma.document_Template.create({
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
        logger_util_1.logger.info('Document template created', {
            templateId: template.id,
            name: template.name,
            actorId,
        });
        return (0, document_response_dto_1.mapTemplateToResponse)(template);
    }
    async getTemplateById(id) {
        const template = await prisma_client_1.prisma.document_Template.findFirst({
            where: { id, deleted_at: null },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Template');
        return (0, document_response_dto_1.mapTemplateToResponse)(template);
    }
    async listTemplates(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
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
        const [total, templates] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.document_Template.count({ where }),
            prisma_client_1.prisma.document_Template.findMany({
                where,
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            templates: templates.map(document_response_dto_1.mapTemplateToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async updateTemplate(id, dto, actorId) {
        await this._assertTemplateExists(id);
        if (dto.name) {
            const clash = await prisma_client_1.prisma.document_Template.findFirst({
                where: { name: dto.name, id: { not: id }, deleted_at: null },
                select: { id: true },
            });
            if (clash) {
                throw app_error_1.AppError.conflict(`Template with name '${dto.name}' already exists`);
            }
        }
        if (dto.documentId) {
            await this._assertDocumentExists(dto.documentId);
        }
        const template = await prisma_client_1.prisma.document_Template.update({
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
        logger_util_1.logger.info('Document template updated', { templateId: id, actorId });
        return (0, document_response_dto_1.mapTemplateToResponse)(template);
    }
    async deleteTemplate(id, actorId) {
        await this._assertTemplateExists(id);
        await prisma_client_1.prisma.document_Template.update({
            where: { id },
            data: {
                deleted_at: new Date(),
                is_active: false,
                updated_by_id: actorId,
            },
        });
        logger_util_1.logger.info('Document template soft-deleted', { templateId: id, actorId });
    }
    async renderDocxTemplate(category, data) {
        const template = await prisma_client_1.prisma.document_Template.findFirst({
            where: { category, is_active: true, deleted_at: null },
            orderBy: { updated_at: 'desc' },
            select: { id: true, content: true, name: true },
        });
        if (!template?.content) {
            throw app_error_1.AppError.notFound(`Active DOCX template for category '${category}'`);
        }
        return (0, docx_template_utility_1.renderDocxFromDocumentXml)(template.content, data);
    }
    async _assertTemplateExists(id) {
        const template = await prisma_client_1.prisma.document_Template.findFirst({
            where: { id, deleted_at: null },
            select: { id: true },
        });
        if (!template)
            throw app_error_1.AppError.notFound('Template');
    }
    async _assertDocumentExists(id) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id, deleted_at: null },
            select: { id: true },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
    }
}
exports.DocumentService = DocumentService;
//# sourceMappingURL=document.service.js.map