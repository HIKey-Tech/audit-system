// src/modules/user/domain/enum/user.enum.ts
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum OidcProvider {
  AZURE_AD = 'azure_ad',
  GENERIC = 'generic',
}