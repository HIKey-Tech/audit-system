"use strict";
// src/modules/document/dto/response/document.response.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTemplateToResponse = exports.mapCurrentDocumentToVersion = exports.mapVersionToResponse = exports.mapDocumentToResponse = void 0;
// Mapper: Prisma Document → Response DTO
const mapDocumentToResponse = (doc, downloadUrl) => {
    const uploader = doc.uploaded_by;
    const uploadedByName = uploader
        ? uploader.display_name?.trim() || `${uploader.first_name} ${uploader.last_name}`.trim()
        : '';
    return {
        id: doc.id,
        originalName: doc.original_name,
        fileName: doc.original_name,
        mimeType: doc.mime_type,
        fileType: doc.mime_type,
        fileSize: doc.file_size,
        storageProvider: doc.storage_provider,
        module: doc.module,
        entityType: doc.entity_type,
        entityId: doc.entity_id,
        uploadedById: doc.uploaded_by_id,
        uploadedByName,
        versionNumber: doc.version_number,
        createdAt: doc.created_at.toISOString(),
        downloadUrl,
    };
};
exports.mapDocumentToResponse = mapDocumentToResponse;
// Mapper: Prisma Document_Version → Response DTO
const mapVersionToResponse = (version, isCurrent, downloadUrl) => ({
    id: version.id,
    documentId: version.document_id,
    versionNumber: version.version_number,
    originalName: version.original_name,
    mimeType: version.mime_type,
    fileSize: version.file_size,
    storageProvider: version.storage_provider,
    uploadedById: version.uploaded_by_id,
    changeNote: version.change_note,
    createdAt: version.created_at.toISOString(),
    downloadUrl,
    isCurrent,
});
exports.mapVersionToResponse = mapVersionToResponse;
// Synthesize a version DTO from the current Document record.
// The Document itself holds the current version state (see Document_Version
// convention — historical snapshots only, current lives on Document).
const mapCurrentDocumentToVersion = (doc, downloadUrl) => ({
    id: doc.id,
    documentId: doc.id,
    versionNumber: doc.version_number,
    originalName: doc.original_name,
    mimeType: doc.mime_type,
    fileSize: doc.file_size,
    storageProvider: doc.storage_provider,
    uploadedById: doc.uploaded_by_id,
    changeNote: null,
    createdAt: doc.updated_at.toISOString(),
    downloadUrl,
    isCurrent: true,
});
exports.mapCurrentDocumentToVersion = mapCurrentDocumentToVersion;
// Mapper: Prisma Document_Template → Response DTO
const mapTemplateToResponse = (template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    content: template.content,
    documentId: template.document_id,
    metadata: template.metadata,
    isActive: template.is_active,
    createdById: template.created_by_id,
    updatedById: template.updated_by_id,
    createdAt: template.created_at.toISOString(),
    updatedAt: template.updated_at.toISOString(),
});
exports.mapTemplateToResponse = mapTemplateToResponse;
//# sourceMappingURL=document.response.dto.js.map