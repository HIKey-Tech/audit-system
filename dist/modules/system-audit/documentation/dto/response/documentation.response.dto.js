"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSystemDocumentToResponse = exports.CONTRACT_EXPIRING_DAYS = exports.REVIEW_DUE_SOON_DAYS = void 0;
const system_audit_utility_1 = require("../../../utility/system-audit.utility");
exports.REVIEW_DUE_SOON_DAYS = 30;
exports.CONTRACT_EXPIRING_DAYS = 60;
const dateState = (date, now, soonDays, labels) => {
    if (!date)
        return null;
    if (date < now)
        return labels.past;
    return (0, system_audit_utility_1.daysBetween)(now, date) <= soonDays ? labels.soon : labels.ok;
};
const mapSystemDocumentToResponse = (doc, now = new Date()) => ({
    id: doc.id,
    title: doc.title,
    docType: doc.doc_type,
    description: doc.description,
    versionLabel: doc.version_label,
    owner: (0, system_audit_utility_1.toUserRef)(doc.owner),
    universe: doc.universe ? { id: doc.universe.id, name: doc.universe.name } : null,
    asset: doc.asset ? { id: doc.asset.id, assetTag: doc.asset.asset_tag, name: doc.asset.name } : null,
    vendor: doc.vendor,
    effectiveDate: doc.effective_date?.toISOString() ?? null,
    reviewDueDate: doc.review_due_date?.toISOString() ?? null,
    expiryDate: doc.expiry_date?.toISOString() ?? null,
    status: doc.status,
    file: {
        documentId: doc.document.id,
        fileName: doc.document.original_name,
        mimeType: doc.document.mime_type,
        fileSize: doc.document.file_size,
        versionNumber: doc.document.version_number,
        contentSha256: doc.document.content_sha256,
    },
    reviewState: dateState(doc.review_due_date, now, exports.REVIEW_DUE_SOON_DAYS, { ok: 'ok', soon: 'due_soon', past: 'overdue' }),
    contractState: dateState(doc.expiry_date, now, exports.CONTRACT_EXPIRING_DAYS, { ok: 'ok', soon: 'expiring', past: 'expired' }),
    createdBy: (0, system_audit_utility_1.toUserRef)(doc.created_by),
    createdAt: doc.created_at.toISOString(),
    updatedAt: doc.updated_at.toISOString(),
});
exports.mapSystemDocumentToResponse = mapSystemDocumentToResponse;
//# sourceMappingURL=documentation.response.dto.js.map