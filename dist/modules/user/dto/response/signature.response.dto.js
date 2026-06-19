"use strict";
// src/modules/user/dto/response/signature.response.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSignatureToResponse = void 0;
const mapSignatureToResponse = (row) => ({
    id: row.id,
    kind: row.kind === 'uploaded' ? 'uploaded' : 'drawn',
    documentId: row.document_id,
    imageUrl: `/api/proxy/documents/${row.document_id}/file`,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
});
exports.mapSignatureToResponse = mapSignatureToResponse;
//# sourceMappingURL=signature.response.dto.js.map