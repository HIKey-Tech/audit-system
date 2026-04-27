"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapChecklistToResponse = void 0;
const mapChecklistToResponse = (item) => ({
    id: item.id,
    engagementId: item.engagement_id,
    auditType: item.audit_type,
    controlReference: item.control_reference,
    controlDescription: item.control_description,
    testProcedure: item.test_procedure,
    result: item.result,
    notes: item.notes,
    evidenceId: item.evidence_id,
    testedById: item.tested_by_id,
    testedAt: item.tested_at?.toISOString() ?? null,
    createdAt: item.created_at.toISOString(),
    updatedAt: item.updated_at.toISOString(),
});
exports.mapChecklistToResponse = mapChecklistToResponse;
//# sourceMappingURL=checklist.response.dto.js.map