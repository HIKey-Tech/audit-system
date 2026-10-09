"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapSecurityTestToResponse = void 0;
const system_audit_utility_1 = require("../../../utility/system-audit.utility");
const mapSecurityTestToResponse = (test, allowedTransitions, results) => ({
    id: test.id,
    reference: test.reference,
    title: test.title,
    testType: test.test_type,
    status: test.status,
    engagement: test.engagement
        ? { id: test.engagement.id, referenceNumber: test.engagement.reference_number, title: test.engagement.title }
        : null,
    provider: test.provider,
    providerType: test.provider_type,
    scope: test.scope,
    rulesOfEngagement: test.rules_of_engagement,
    plannedStart: test.planned_start.toISOString(),
    plannedEnd: test.planned_end.toISOString(),
    actualStart: test.actual_start?.toISOString() ?? null,
    actualEnd: test.actual_end?.toISOString() ?? null,
    coordinator: (0, system_audit_utility_1.toUserRef)(test.coordinator),
    authorisedBy: (0, system_audit_utility_1.toUserRef)(test.authorised_by),
    authorisedAt: test.authorised_at?.toISOString() ?? null,
    report: test.report_document
        ? {
            documentId: test.report_document.id,
            fileName: test.report_document.original_name,
            fileSize: test.report_document.file_size,
            uploadedAt: test.report_document.created_at.toISOString(),
        }
        : null,
    notes: test.notes,
    assets: test.assets.map((a) => ({
        id: a.asset.id,
        assetTag: a.asset.asset_tag,
        name: a.asset.name,
        assetType: a.asset.asset_type,
        criticality: a.asset.criticality,
    })),
    createdBy: (0, system_audit_utility_1.toUserRef)(test.created_by),
    createdAt: test.created_at.toISOString(),
    updatedAt: test.updated_at.toISOString(),
    allowedTransitions,
    results,
});
exports.mapSecurityTestToResponse = mapSecurityTestToResponse;
//# sourceMappingURL=security-test.response.dto.js.map