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
