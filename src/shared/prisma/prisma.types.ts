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
