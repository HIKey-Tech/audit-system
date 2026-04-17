// src/modules/user/domain/enum/user.enum.ts
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum SystemRole {
  SUPER_ADMIN = 'super_admin',
  AUDIT_ADMIN = 'audit_admin',
  AUDIT_LEAD = 'audit_lead',
  AUDITOR = 'auditor',
  AUDITEE = 'auditee',
  VIEWER = 'viewer',
}

export enum OidcProvider {
  AZURE_AD = 'azure_ad',
  GENERIC = 'generic',
}