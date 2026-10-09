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
    universe: {
        select: {
            id: true;
            name: true;
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
export declare const assetWithDetailsInclude: {
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
    custodian: {
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
    created_by: {
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
};
export type AssetWithDetails = Prisma.AssetGetPayload<{
    include: typeof assetWithDetailsInclude;
}>;
export declare const systemAuditRunInclude: {
    engagement: {
        select: {
            id: true;
            reference_number: true;
            title: true;
        };
    };
    security_test: {
        select: {
            id: true;
            reference: true;
            title: true;
        };
    };
    created_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    reviewed_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
};
export type SystemAuditRunWithRelations = Prisma.System_Audit_RunGetPayload<{
    include: typeof systemAuditRunInclude;
}>;
export declare const systemAuditExceptionInclude: {
    disposed_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    finding: {
        select: {
            id: true;
            title: true;
            status: true;
        };
    };
};
export type SystemAuditExceptionWithRelations = Prisma.System_Audit_ExceptionGetPayload<{
    include: typeof systemAuditExceptionInclude;
}>;
export declare const accessReviewItemInclude: {
    decided_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
};
export type AccessReviewItemWithRelations = Prisma.Access_Review_ItemGetPayload<{
    include: typeof accessReviewItemInclude;
}>;
export declare const securityTestInclude: {
    engagement: {
        select: {
            id: true;
            reference_number: true;
            title: true;
        };
    };
    coordinator: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    authorised_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    created_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    report_document: {
        select: {
            id: true;
            original_name: true;
            file_size: true;
            created_at: true;
        };
    };
    assets: {
        include: {
            asset: {
                select: {
                    id: true;
                    asset_tag: true;
                    name: true;
                    asset_type: true;
                    criticality: true;
                };
            };
        };
    };
};
export type SecurityTestWithRelations = Prisma.Security_TestGetPayload<{
    include: typeof securityTestInclude;
}>;
export declare const systemDocumentInclude: {
    document: {
        select: {
            id: true;
            original_name: true;
            mime_type: true;
            file_size: true;
            version_number: true;
            content_sha256: true;
        };
    };
    owner: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    created_by: {
        select: {
            id: true;
            email: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
    universe: {
        select: {
            id: true;
            name: true;
        };
    };
    asset: {
        select: {
            id: true;
            asset_tag: true;
            name: true;
        };
    };
};
export type SystemDocumentWithRelations = Prisma.System_DocumentGetPayload<{
    include: typeof systemDocumentInclude;
}>;
//# sourceMappingURL=prisma.types.d.ts.map