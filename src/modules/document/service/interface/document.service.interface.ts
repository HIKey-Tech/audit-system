// src/modules/document/service/interface/document.service.interface.ts
export interface UploadDocumentDto {
  uploadedById: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  module: string;
  entityType?: string;
  entityId?: string;
}

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
  createdAt: string;
  downloadUrl?: string;
}

export interface IDocumentService {
  upload(dto: UploadDocumentDto): Promise<DocumentResponseDto>;
  getById(id: string): Promise<DocumentResponseDto>;
  getDownloadUrl(id: string): Promise<string>;
  delete(id: string, actorId: string): Promise<void>;
  listByEntity(entityType: string, entityId: string): Promise<DocumentResponseDto[]>;
}
