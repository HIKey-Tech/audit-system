"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskRegisterWithDetailsInclude = exports.riskAssessmentWithAssessorInclude = exports.userWithRolesInclude = void 0;
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
    assessments: {
        include: exports.riskAssessmentWithAssessorInclude,
        orderBy: { assessed_at: 'desc' },
        take: 1,
    },
});
//# sourceMappingURL=prisma.types.js.map