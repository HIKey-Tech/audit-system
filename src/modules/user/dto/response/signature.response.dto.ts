// src/modules/user/dto/response/signature.response.dto.ts

export interface UserSignatureResponseDto {
  id: string;
  kind: 'drawn' | 'uploaded';
  documentId: string;
  /** Same-origin proxy URL the frontend can render directly. */
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSignatureRow {
  id: string;
  kind: string;
  document_id: string;
  created_at: Date;
  updated_at: Date;
}

export const mapSignatureToResponse = (row: UserSignatureRow): UserSignatureResponseDto => ({
  id: row.id,
  kind: row.kind === 'uploaded' ? 'uploaded' : 'drawn',
  documentId: row.document_id,
  imageUrl: `/api/proxy/documents/${row.document_id}/file`,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
