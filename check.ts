import { userWithRolesInclude, UserWithRoles } from './src/shared/prisma/prisma.types';

const a: UserWithRoles = null as any;
const b = a.user_roles;
