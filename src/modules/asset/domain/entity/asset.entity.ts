export interface AssetActorContext {
  id: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin?: boolean;
}

export type JsonObject = Record<string, unknown>;
