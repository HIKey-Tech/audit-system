export interface DocumentResponseDto {
    id: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    storageProvider: string;
    module: string;
    entityType: string | null;
    entityId: string | null;
    uploadedById: string;
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
export declare const mapDocumentToResponse: (doc: {
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
}, downloadUrl?: string) => DocumentResponseDto;
export declare const mapVersionToResponse: (version: {
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
}, isCurrent: boolean, downloadUrl?: string) => DocumentVersionResponseDto;
export declare const mapCurrentDocumentToVersion: (doc: {
    id: string;
    version_number: number;
    original_name: string;
    mime_type: string;
    file_size: number;
    storage_provider: string;
    uploaded_by_id: string;
    updated_at: Date;
}, downloadUrl?: string) => DocumentVersionResponseDto;
export declare const mapTemplateToResponse: (template: {
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
}) => DocumentTemplateResponseDto;
//# sourceMappingURL=document.response.dto.d.ts.map