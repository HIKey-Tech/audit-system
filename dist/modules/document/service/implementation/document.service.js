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
const uploaderInclude = {
    uploaded_by: {
        select: { display_name: true, first_name: true, last_name: true },
    },
};
class DocumentService {
    async upload(dto) {
        const storageProvider = app_config_1.config.storage.provider;
        const storageClient = this._storageClient(storageProvider);
        let storedName;
        try {
            storedName = await storageClient.save(dto.buffer, dto.originalName);
            const document = await prisma_client_1.prisma.document.create({
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
            logger_util_1.logger.info('Document uploaded', { documentId: document.id, module: dto.module });
            const url = await this._storageClient(document.storage_provider).getUrl(document.storage_path);
            return (0, document_response_dto_1.mapDocumentToResponse)(document, url);
        }
        catch (err) {
            if (storedName) {
                await storageClient.delete(storedName).catch(() => undefined);
            }
            throw err;
        }
    }
    async getById(id, requesterId) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id, deleted_at: null },
            include: uploaderInclude,
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        this._assertCanAccess(doc, requesterId);
        const url = await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
        return (0, document_response_dto_1.mapDocumentToResponse)(doc, url);
    }
    async getDownloadUrl(id) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id, deleted_at: null },
            select: { storage_path: true, storage_provider: true },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        return this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
    }
    async delete(id, actorId) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        this._assertCanAccess(doc, actorId);
        await prisma_client_1.prisma.document.update({
            where: { id },
            data: { deleted_at: new Date() },
        });
        await this._storageClient(doc.storage_provider).delete(doc.storage_path);
        logger_util_1.logger.info('Document deleted', { documentId: id, actorId });
    }
    async list(query, ownerId) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        // Personal storage: only the documents this user uploaded. Other users'
        // uploads are never visible from the standalone Documents listing.
        const where = {
            deleted_at: null,
            uploaded_by_id: ownerId,
            ...(query.entityType && { entity_type: query.entityType }),
            ...(query.search && {
                original_name: { contains: query.search },
            }),
        };
        const [total, docs] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.document.count({ where }),
            prisma_client_1.prisma.document.findMany({
                where,
                orderBy: { created_at: 'desc' },
                skip,
                take,
                include: uploaderInclude,
            }),
        ]);
        const documents = await Promise.all(docs.map(async (doc) => {
            const url = await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
            return (0, document_response_dto_1.mapDocumentToResponse)(doc, url);
        }));
        return { documents, meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize) };
    }
    async listByEntity(entityType, entityId) {
        const docs = await prisma_client_1.prisma.document.findMany({
            where: { entity_type: entityType, entity_id: entityId, deleted_at: null },
            orderBy: { created_at: 'desc' },
            include: uploaderInclude,
        });
        return Promise.all(docs.map(async (doc) => {
            const url = await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
            return (0, document_response_dto_1.mapDocumentToResponse)(doc, url);
        }));
    }
    async listByEntityIds(entityType, entityIds) {
        const grouped = new Map();
        if (entityIds.length === 0)
            return grouped;
        // Single query for every entity in the batch — callers that previously
        // looped over listByEntity collapse from N queries to 1.
        const docs = await prisma_client_1.prisma.document.findMany({
            where: { entity_type: entityType, entity_id: { in: entityIds }, deleted_at: null },
            orderBy: { created_at: 'desc' },
            include: uploaderInclude,
        });
        const mapped = await Promise.all(docs.map(async (doc) => ({
            entityId: doc.entity_id,
            dto: (0, document_response_dto_1.mapDocumentToResponse)(doc, await this._storageClient(doc.storage_provider).getUrl(doc.storage_path)),
        })));
        for (const { entityId, dto } of mapped) {
            if (!entityId)
                continue;
            const bucket = grouped.get(entityId);
            if (bucket)
                bucket.push(dto);
            else
                grouped.set(entityId, [dto]);
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
    async assertCanUserAccess(documentId, requesterId) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
            select: { entity_type: true, uploaded_by_id: true },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        this._assertCanAccess(doc, requesterId);
    }
    async getFileById(id) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id, deleted_at: null },
            select: {
                mime_type: true,
                original_name: true,
                file_size: true,
                storage_provider: true,
                storage_path: true,
            },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        const buffer = await this._storageClient(doc.storage_provider).read(doc.storage_path);
        return {
            buffer,
            mimeType: doc.mime_type,
            originalName: doc.original_name,
            fileSize: doc.file_size,
        };
    }
    async serveFile(storedName, requesterId) {
        // Resolve the storage key to an owning record. Current versions live on
        // the Document row; historical versions live on Document_Version. Either
        // must exist and not belong to a soft-deleted document.
        const doc = await prisma_client_1.prisma.document.findFirst({
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
        let mimeType;
        let originalName;
        let fileSize;
        let storageProvider;
        if (doc) {
            this._assertCanAccess(doc, requesterId);
            mimeType = doc.mime_type;
            originalName = doc.original_name;
            fileSize = doc.file_size;
            storageProvider = doc.storage_provider;
        }
        else {
            const version = await prisma_client_1.prisma.document_Version.findFirst({
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
            if (!version)
                throw app_error_1.AppError.notFound('File');
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
    async uploadNewVersion(documentId, dto) {
        const storageProvider = app_config_1.config.storage.provider;
        const storageClient = this._storageClient(storageProvider);
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        this._assertCanAccess(doc, dto.uploadedById);
        const newVersionNumber = doc.version_number + 1;
        let storedName;
        // Ensure the outgoing current version is present in Document_Version,
        // then persist the uploaded version with its change note before updating
        // the Document row that holds the current-version state.
        try {
            storedName = await storageClient.save(dto.buffer, dto.originalName);
            const version = await prisma_client_1.prisma.$transaction(async (tx) => {
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
                        stored_name: storedName,
                        mime_type: dto.mimeType,
                        file_size: dto.fileSize,
                        storage_path: storedName,
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
            logger_util_1.logger.info('Document new version uploaded', {
                documentId: doc.id,
                previousVersion: doc.version_number,
                newVersion: newVersionNumber,
                actorId: dto.uploadedById,
            });
            const url = await this._storageClient(version.storage_provider).getUrl(version.storage_path);
            return (0, document_response_dto_1.mapVersionToResponse)(version, true, url);
        }
        catch (err) {
            if (storedName) {
                await storageClient.delete(storedName).catch(() => undefined);
            }
            throw err;
        }
    }
    async listVersions(documentId, requesterId) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        this._assertCanAccess(doc, requesterId);
        const history = await prisma_client_1.prisma.document_Version.findMany({
            where: { document_id: documentId },
            orderBy: { version_number: 'desc' },
        });
        const currentVersion = history.find((v) => v.version_number === doc.version_number);
        const currentUrl = currentVersion
            ? await this._storageClient(currentVersion.storage_provider).getUrl(currentVersion.storage_path)
            : await this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
        const current = currentVersion
            ? (0, document_response_dto_1.mapVersionToResponse)(currentVersion, true, currentUrl)
            : (0, document_response_dto_1.mapCurrentDocumentToVersion)(doc, currentUrl);
        const historical = await Promise.all(history
            .filter((v) => v.version_number !== doc.version_number)
            .map(async (v) => {
            const url = await this._storageClient(v.storage_provider).getUrl(v.storage_path);
            return (0, document_response_dto_1.mapVersionToResponse)(v, false, url);
        }));
        return [current, ...historical];
    }
    async getVersion(documentId, versionNumber, requesterId) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        this._assertCanAccess(doc, requesterId);
        if (versionNumber === doc.version_number) {
            const currentVersion = await prisma_client_1.prisma.document_Version.findUnique({
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
        const url = await this._storageClient(version.storage_provider).getUrl(version.storage_path);
        return (0, document_response_dto_1.mapVersionToResponse)(version, false, url);
    }
    async getVersionDownloadUrl(documentId, versionNumber, requesterId) {
        const doc = await prisma_client_1.prisma.document.findUnique({
            where: { id: documentId, deleted_at: null },
            select: {
                storage_path: true,
                storage_provider: true,
                version_number: true,
                entity_type: true,
                uploaded_by_id: true,
            },
        });
        if (!doc)
            throw app_error_1.AppError.notFound('Document');
        this._assertCanAccess(doc, requesterId);
        if (versionNumber === doc.version_number) {
            return this._storageClient(doc.storage_provider).getUrl(doc.storage_path);
        }
        const version = await prisma_client_1.prisma.document_Version.findUnique({
            where: {
                document_id_version_number: {
                    document_id: documentId,
                    version_number: versionNumber,
                },
            },
            select: { storage_path: true, storage_provider: true },
        });
        if (!version)
            throw app_error_1.AppError.notFound('Document version');
        return this._storageClient(version.storage_provider).getUrl(version.storage_path);
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
    async pruneOldVersions() {
        // Read retention config from system_config
        const configRow = await prisma_client_1.prisma.system_Config.findUnique({
            where: { key: 'version_retention' },
            select: { value: true },
        });
        let retentionConfig = { enabled: false, keepLastVersions: 10 };
        if (configRow?.value) {
            try {
                const parsed = JSON.parse(configRow.value);
                retentionConfig = { ...retentionConfig, ...parsed };
            }
            catch {
                logger_util_1.logger.warn('Invalid JSON in version_retention config, using defaults');
            }
        }
        if (!retentionConfig.enabled) {
            logger_util_1.logger.info('Version retention is disabled, skipping prune');
            return { prunedCount: 0, failedCount: 0 };
        }
        const keepN = Math.max(1, retentionConfig.keepLastVersions);
        let prunedCount = 0;
        let failedCount = 0;
        // Find documents with versions to prune
        const documentsWithVersions = await prisma_client_1.prisma.document.findMany({
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
            if (doc.versions.length <= keepN)
                continue;
            // Keep the first N (most recent by version_number desc), prune the rest
            const toPrune = doc.versions.slice(keepN);
            for (const version of toPrune) {
                try {
                    // Delete from storage first
                    await this._storageClient(version.storage_provider).delete(version.storage_path);
                    // Then delete the DB row
                    await prisma_client_1.prisma.document_Version.delete({
                        where: { id: version.id },
                    });
                    prunedCount++;
                }
                catch (err) {
                    failedCount++;
                    logger_util_1.logger.error('Failed to prune document version', {
                        versionId: version.id,
                        documentId: doc.id,
                        storagePath: version.storage_path,
                        err: String(err),
                    });
                }
            }
        }
        logger_util_1.logger.info('Version retention prune completed', { prunedCount, failedCount });
        return { prunedCount, failedCount };
    }
    _storageClient(provider = app_config_1.config.storage.provider) {
        return (0, storage_client_1.createStorageClient)(provider);
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
    _assertCanAccess(doc, requesterId) {
        if (doc.entity_type === null && doc.uploaded_by_id !== requesterId) {
            throw app_error_1.AppError.notFound('Document');
        }
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