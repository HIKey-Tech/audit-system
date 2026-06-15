import { AppError } from '../../../shared/errors/app.error';
import { AssetActorContext } from '../domain/entity/asset.entity';
import {
  AssetLifecycleState,
  AssetRating,
  AssetSourceSystem,
  DataClassification,
} from '../domain/enum/asset.enum';

export const assertHasPermission = (
  actor: AssetActorContext,
  required: string,
  message = 'Insufficient permission for this action',
): void => {
  if (actor.isSuperAdmin) return;
  if (!actor.permissions.includes(required)) {
    throw AppError.forbidden(message);
  }
};

export const hasPermission = (actor: AssetActorContext, permission: string): boolean =>
  Boolean(actor.isSuperAdmin || actor.permissions.includes(permission));

export const stringifyJson = (
  value: Record<string, unknown> | null | undefined,
): string | null => {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
};

export const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const SENSITIVE_ASSET_FIELDS = [
  'criticality',
  'dataClassification',
  'confidentialityRating',
  'integrityRating',
  'availabilityRating',
  'lifecycleState',
  'sourceSystem',
  'sourceId',
  'lastSeenAt',
] as const;

/**
 * Baseline values the create schema fills in automatically. On create these
 * defaults are always present in the parsed DTO, so presence alone cannot mean
 * "the caller set this" — only a value that differs from the baseline does.
 * Keep this in sync with the defaults in `CreateAssetRequestSchema`.
 */
const SENSITIVE_ASSET_FIELD_DEFAULTS: Record<string, unknown> = {
  criticality: AssetRating.Medium,
  dataClassification: DataClassification.Internal,
  confidentialityRating: AssetRating.Medium,
  integrityRating: AssetRating.Medium,
  availabilityRating: AssetRating.Medium,
  lifecycleState: AssetLifecycleState.Active,
  sourceSystem: AssetSourceSystem.Manual,
  sourceId: null,
  lastSeenAt: null,
};

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
export const assertAdminForSensitiveAssetFields = (
  actor: AssetActorContext,
  dto: Record<string, unknown>,
  mode: 'create' | 'update' = 'update',
): void => {
  if (hasPermission(actor, 'asset:admin')) return;

  const changesSensitiveField = SENSITIVE_ASSET_FIELDS.some((field) => {
    if (!(field in dto)) return false;
    if (mode === 'update') return true;
    const provided = dto[field] ?? null;
    const baseline = SENSITIVE_ASSET_FIELD_DEFAULTS[field] ?? null;
    return provided !== baseline;
  });

  if (changesSensitiveField) {
    throw AppError.forbidden('asset:admin is required to set classification, lifecycle, or source fields');
  }
};
