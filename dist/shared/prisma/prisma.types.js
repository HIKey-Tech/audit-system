"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemDocumentInclude = exports.securityTestInclude = exports.accessReviewItemInclude = exports.systemAuditExceptionInclude = exports.systemAuditRunInclude = exports.assetWithDetailsInclude = exports.riskRegisterWithDetailsInclude = exports.riskAssessmentWithAssessorInclude = exports.userWithRolesInclude = void 0;
// src/shared/prisma/prisma.types.ts
const client_1 = require("@prisma/client");
/**
 * Single source of truth for the user-with-roles query shape.
 * Used across auth.middleware, auth.service, and user.service
 * to give TypeScript full type inference on nested relations.
 */
exports.userWithRolesInclude = client_1.Prisma.validator()({
    user_roles: {
        include: {
            role: {
                include: {
                    role_permissions: {
                        include: { permission: true },
                    },
                },
            },
        },
    },
});
const riskUserBriefSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
    department: true,
    job_title: true,
});
const riskAssessmentUserBriefSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
});
exports.riskAssessmentWithAssessorInclude = client_1.Prisma.validator()({
    assessed_by: {
        select: riskAssessmentUserBriefSelect,
    },
});
exports.riskRegisterWithDetailsInclude = client_1.Prisma.validator()({
    category: true,
    owner: {
        select: riskUserBriefSelect,
    },
    universe: {
        select: {
            id: true,
            name: true,
        },
    },
    assessments: {
        include: exports.riskAssessmentWithAssessorInclude,
        orderBy: { assessed_at: 'desc' },
        take: 1,
    },
});
const assetUserBriefSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
    department: true,
    job_title: true,
});
exports.assetWithDetailsInclude = client_1.Prisma.validator()({
    owner: {
        select: assetUserBriefSelect,
    },
    custodian: {
        select: assetUserBriefSelect,
    },
    created_by: {
        select: assetUserBriefSelect,
    },
});
// ── System audit toolkit ──────────────────────────────────────
const systemAuditUserSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
});
exports.systemAuditRunInclude = client_1.Prisma.validator()({
    engagement: { select: { id: true, reference_number: true, title: true } },
    security_test: { select: { id: true, reference: true, title: true } },
    created_by: { select: systemAuditUserSelect },
    reviewed_by: { select: systemAuditUserSelect },
});
exports.systemAuditExceptionInclude = client_1.Prisma.validator()({
    disposed_by: { select: systemAuditUserSelect },
    finding: { select: { id: true, title: true, status: true } },
});
exports.accessReviewItemInclude = client_1.Prisma.validator()({
    decided_by: { select: systemAuditUserSelect },
});
exports.securityTestInclude = client_1.Prisma.validator()({
    engagement: { select: { id: true, reference_number: true, title: true } },
    coordinator: { select: systemAuditUserSelect },
    authorised_by: { select: systemAuditUserSelect },
    created_by: { select: systemAuditUserSelect },
    report_document: { select: { id: true, original_name: true, file_size: true, created_at: true } },
    assets: {
        include: { asset: { select: { id: true, asset_tag: true, name: true, asset_type: true, criticality: true } } },
    },
});
exports.systemDocumentInclude = client_1.Prisma.validator()({
    document: { select: { id: true, original_name: true, mime_type: true, file_size: true, version_number: true, content_sha256: true } },
    owner: { select: systemAuditUserSelect },
    created_by: { select: systemAuditUserSelect },
    universe: { select: { id: true, name: true } },
    asset: { select: { id: true, asset_tag: true, name: true } },
});
//# sourceMappingURL=prisma.types.js.map