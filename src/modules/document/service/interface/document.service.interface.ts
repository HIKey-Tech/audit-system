// src/modules/document/service/interface/document.service.interface.ts
import { PaginationMeta } from '../../../../shared/types/api-response.type';
import {
  DocumentVersionResponseDto,
  DocumentTemplateResponseDto,
} from '../../dto/response/document.response.dto';
import {
  CreateTemplateRequestDto,
  UpdateTemplateRequestDto,
  TemplateQueryDto,
} from '../../dto/request/document.request.dto';

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

export interface UploadVersionDto {
  uploadedById: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
  changeNote?: string;
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

export interface IDocumentService {
  // ──────────── Files ────────────
  upload(dto: UploadDocumentDto): Promise<DocumentResponseDto>;
  getById(id: string): Promise<DocumentResponseDto>;
  getDownloadUrl(id: string): Promise<string>;
  delete(id: string, actorId: string): Promise<void>;
  listByEntity(entityType: string, entityId: string): Promise<DocumentResponseDto[]>;
  serveFile(storedName: string): Promise<ServedFileDto>;

  // ──────────── Versioning ────────────
  uploadNewVersion(
    documentId: string,
    dto: UploadVersionDto,
  ): Promise<DocumentVersionResponseDto>;

  listVersions(documentId: string): Promise<DocumentVersionResponseDto[]>;

  getVersion(
    documentId: string,
    versionNumber: number,
  ): Promise<DocumentVersionResponseDto>;

  getVersionDownloadUrl(
    documentId: string,
    versionNumber: number,
  ): Promise<string>;

  // ──────────── Templates ────────────
  createTemplate(
    dto: CreateTemplateRequestDto,
    actorId: string,
  ): Promise<DocumentTemplateResponseDto>;

  getTemplateById(id: string): Promise<DocumentTemplateResponseDto>;

  listTemplates(
    query: TemplateQueryDto,
  ): Promise<{ templates: DocumentTemplateResponseDto[]; meta: PaginationMeta }>;

  updateTemplate(
    id: string,
    dto: UpdateTemplateRequestDto,
    actorId: string,
  ): Promise<DocumentTemplateResponseDto>;

  deleteTemplate(id: string, actorId: string): Promise<void>;
}
