// src/modules/user/domain/entity/user.entity.ts
export interface UserEntity {
  id: string;
  azureOid: string | null;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
  isSystemUser: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RoleEntity {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionEntity[];
}

export interface PermissionEntity {
  id: string;
  name: string;
  module: string;
  action: string;
  description: string | null;
}

export interface UserWithRoles extends UserEntity {
  roles: RoleEntity[];
  permissions: string[];
}
