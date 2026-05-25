// src/modules/document/dto/response/document.response.dto.ts

export interface DocumentResponseDto {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  fileType: string;
  fileSize: number;
  storageProvider: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  uploadedById: string;
  uploadedByName: string;
  versionNumber: number;
  createdAt: string;
  downloadUrl?: string;
}

export interface ServedFileDto {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  fileSize: number;
}

export interface DocumentVersionResponseDto {
  id: string;
  documentId: string;
  versionNumber: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storageProvider: string;
  uploadedById: string;
  changeNote: string | null;
  createdAt: string;
  downloadUrl?: string;
  isCurrent: boolean;
}

export interface DocumentTemplateResponseDto {
  id: string;
  name: string;
  description: string | null;
  category: string;
  content: string | null;
  documentId: string | null;
  metadata: string | null;
  isActive: boolean;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

// Mapper: Prisma Document → Response DTO
export const mapDocumentToResponse = (
  doc: {
    id: string;
    original_name: string;
    mime_type: string;
    file_size: number;
    storage_provider: string;
    module: string;
    entity_type: string | null;
    entity_id: string | null;
    uploaded_by_id: string;
    version_number: number;
    created_at: Date;
    uploaded_by?: { display_name: string | null; first_name: string; last_name: string } | null;
  },
  downloadUrl?: string,
): DocumentResponseDto => {
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

// Mapper: Prisma Document_Version → Response DTO
export const mapVersionToResponse = (
  version: {
    id: string;
    document_id: string;
    version_number: number;
    original_name: string;
    mime_type: string;
    file_size: number;
    storage_provider: string;
    uploaded_by_id: string;
    change_note: string | null;
    created_at: Date;
  },
  isCurrent: boolean,
  downloadUrl?: string,
): DocumentVersionResponseDto => ({
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

// Synthesize a version DTO from the current Document record.
// The Document itself holds the current version state (see Document_Version
// convention — historical snapshots only, current lives on Document).
export const mapCurrentDocumentToVersion = (
  doc: {
    id: string;
    version_number: number;
    original_name: string;
    mime_type: string;
    file_size: number;
    storage_provider: string;
    uploaded_by_id: string;
    updated_at: Date;
  },
  downloadUrl?: string,
): DocumentVersionResponseDto => ({
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

// Mapper: Prisma Document_Template → Response DTO
export const mapTemplateToResponse = (template: {
  id: string;
  name: string;
  description: string | null;
  category: string;
  content: string | null;
  document_id: string | null;
  metadata: string | null;
  is_active: boolean;
  created_by_id: string;
  updated_by_id: string | null;
  created_at: Date;
  updated_at: Date;
}): DocumentTemplateResponseDto => ({
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
