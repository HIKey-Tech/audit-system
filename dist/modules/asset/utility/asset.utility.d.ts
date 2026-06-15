import { AssetActorContext } from '../domain/entity/asset.entity';
export declare const assertHasPermission: (actor: AssetActorContext, required: string, message?: string) => void;
export declare const hasPermission: (actor: AssetActorContext, permission: string) => boolean;
export declare const stringifyJson: (value: Record<string, unknown> | null | undefined) => string | null;
export declare const daysAgo: (days: number) => Date;
/**
 * Guards classification, lifecycle, and source fields so only `asset:admin`
 * (or super admin) can govern them.
 *
 * - `'update'` (default): the update schema is `.partial()`, so any presence of
 *   a sensitive field is a deliberate change and is rejected for non-admins.
 * - `'create'`: the create schema applies defaults, so a non-admin who simply
 *   omits these fields still receives the baseline. Only a value that differs
 *   from the baseline is treated as an attempt to set a governed field.
 */
export declare const assertAdminForSensitiveAssetFields: (actor: AssetActorContext, dto: Record<string, unknown>, mode?: "create" | "update") => void;
//# sourceMappingURL=asset.utility.d.ts.map