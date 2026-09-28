// src/shared/prisma/prisma.types.ts
import { Prisma } from '@prisma/client';

/**
 * Single source of truth for the user-with-roles query shape.
 * Used across auth.middleware, auth.service, and user.service
 * to give TypeScript full type inference on nested relations.
 */
export const userWithRolesInclude = Prisma.validator<Prisma.UserInclude>()({
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

export type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof userWithRolesInclude;
}>;

const riskUserBriefSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  display_name: true,
  first_name: true,
  last_name: true,
  department: true,
  job_title: true,
});

const riskAssessmentUserBriefSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  display_name: true,
  first_name: true,
  last_name: true,
});

export const riskAssessmentWithAssessorInclude = Prisma.validator<Prisma.Risk_AssessmentInclude>()({
  assessed_by: {
    select: riskAssessmentUserBriefSelect,
  },
});

export type RiskAssessmentWithAssessor = Prisma.Risk_AssessmentGetPayload<{
  include: typeof riskAssessmentWithAssessorInclude;
}>;

export const riskRegisterWithDetailsInclude = Prisma.validator<Prisma.Risk_RegisterInclude>()({
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
    include: riskAssessmentWithAssessorInclude,
    orderBy: { assessed_at: 'desc' },
    take: 1,
  },
});

export type RiskRegisterWithDetails = Prisma.Risk_RegisterGetPayload<{
  include: typeof riskRegisterWithDetailsInclude;
}>;

const assetUserBriefSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  display_name: true,
  first_name: true,
  last_name: true,
  department: true,
  job_title: true,
});

export const assetWithDetailsInclude = Prisma.validator<Prisma.AssetInclude>()({
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

export type AssetWithDetails = Prisma.AssetGetPayload<{
  include: typeof assetWithDetailsInclude;
}>;

// ── System audit toolkit ──────────────────────────────────────

const systemAuditUserSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  display_name: true,
  first_name: true,
  last_name: true,
});

export const systemAuditRunInclude = Prisma.validator<Prisma.System_Audit_RunInclude>()({
  engagement: { select: { id: true, reference_number: true, title: true } },
  security_test: { select: { id: true, reference: true, title: true } },
  created_by: { select: systemAuditUserSelect },
  reviewed_by: { select: systemAuditUserSelect },
});

export type SystemAuditRunWithRelations = Prisma.System_Audit_RunGetPayload<{
  include: typeof systemAuditRunInclude;
}>;

export const systemAuditExceptionInclude = Prisma.validator<Prisma.System_Audit_ExceptionInclude>()({
  disposed_by: { select: systemAuditUserSelect },
  finding: { select: { id: true, title: true, status: true } },
});

export type SystemAuditExceptionWithRelations = Prisma.System_Audit_ExceptionGetPayload<{
  include: typeof systemAuditExceptionInclude;
}>;

export const accessReviewItemInclude = Prisma.validator<Prisma.Access_Review_ItemInclude>()({
  decided_by: { select: systemAuditUserSelect },
});

export type AccessReviewItemWithRelations = Prisma.Access_Review_ItemGetPayload<{
  include: typeof accessReviewItemInclude;
}>;

export const securityTestInclude = Prisma.validator<Prisma.Security_TestInclude>()({
  engagement: { select: { id: true, reference_number: true, title: true } },
  coordinator: { select: systemAuditUserSelect },
  authorised_by: { select: systemAuditUserSelect },
  created_by: { select: systemAuditUserSelect },
  report_document: { select: { id: true, original_name: true, file_size: true, created_at: true } },
  assets: {
    include: { asset: { select: { id: true, asset_tag: true, name: true, asset_type: true, criticality: true } } },
  },
});

export type SecurityTestWithRelations = Prisma.Security_TestGetPayload<{
  include: typeof securityTestInclude;
}>;

export const systemDocumentInclude = Prisma.validator<Prisma.System_DocumentInclude>()({
  document: { select: { id: true, original_name: true, mime_type: true, file_size: true, version_number: true, content_sha256: true } },
  owner: { select: systemAuditUserSelect },
  created_by: { select: systemAuditUserSelect },
  universe: { select: { id: true, name: true } },
  asset: { select: { id: true, asset_tag: true, name: true } },
});

export type SystemDocumentWithRelations = Prisma.System_DocumentGetPayload<{
  include: typeof systemDocumentInclude;
}>;
