"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userWithRolesInclude = void 0;
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
//# sourceMappingURL=prisma.types.js.map