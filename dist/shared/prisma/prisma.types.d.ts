import { Prisma } from '@prisma/client';
/**
 * Single source of truth for the user-with-roles query shape.
 * Used across auth.middleware, auth.service, and user.service
 * to give TypeScript full type inference on nested relations.
 */
export declare const userWithRolesInclude: {
    user_roles: {
        include: {
            role: {
                include: {
                    role_permissions: {
                        include: {
                            permission: true;
                        };
                    };
                };
            };
        };
    };
};
export type UserWithRoles = Prisma.UserGetPayload<{
    include: typeof userWithRolesInclude;
}>;
export declare const riskAssessmentWithAssessorInclude: {
    assessed_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
};
export type RiskAssessmentWithAssessor = Prisma.Risk_AssessmentGetPayload<{
    include: typeof riskAssessmentWithAssessorInclude;
}>;
export declare const riskRegisterWithDetailsInclude: {
    category: true;
    owner: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
            department: true;
            job_title: true;
        };
    };
    assessments: {
        include: {
            assessed_by: {
                select: {
                    id: true;
                    email: true;
                    display_name: true;
                    first_name: true;
                    last_name: true;
                };
            };
        };
        orderBy: {
            assessed_at: "desc";
        };
        take: 1;
    };
};
export type RiskRegisterWithDetails = Prisma.Risk_RegisterGetPayload<{
    include: typeof riskRegisterWithDetailsInclude;
}>;
//# sourceMappingURL=prisma.types.d.ts.map