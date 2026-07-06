"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapEvidenceRequestToResponse = exports.evidenceRequestInclude = void 0;
const client_1 = require("@prisma/client");
exports.evidenceRequestInclude = client_1.Prisma.validator()({
    requested_by: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } },
    assigned_to: { select: { id: true, email: true, display_name: true, first_name: true, last_name: true } },
    evidence: { select: { id: true, file_name: true, uploaded_at: true }, orderBy: { uploaded_at: 'desc' } },
    engagement: { select: { reference_number: true, title: true } },
});
const userName = (u) => u.display_name ?? `${u.first_name} ${u.last_name}`.trim();
const mapEvidenceRequestToResponse = (r) => ({
    id: r.id,
    engagementId: r.engagement_id,
    engagementReference: r.engagement.reference_number,
    engagementTitle: r.engagement.title,
    title: r.title,
    description: r.description,
    dueDate: r.due_date?.toISOString() ?? null,
    status: r.status,
    returnReason: r.return_reason,
    requestedById: r.requested_by_id,
    requestedByName: userName(r.requested_by),
    assignedToId: r.assigned_to_id,
    assignedToName: userName(r.assigned_to),
    fulfilledAt: r.fulfilled_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    evidence: r.evidence.map((e) => ({ id: e.id, fileName: e.file_name, uploadedAt: e.uploaded_at.toISOString() })),
});
exports.mapEvidenceRequestToResponse = mapEvidenceRequestToResponse;
//# sourceMappingURL=evidence-request.response.dto.js.map