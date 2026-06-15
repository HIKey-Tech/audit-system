"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertAdminForSensitiveAssetFields = exports.daysAgo = exports.stringifyJson = exports.hasPermission = exports.assertHasPermission = void 0;
const app_error_1 = require("../../../shared/errors/app.error");
const asset_enum_1 = require("../domain/enum/asset.enum");
const assertHasPermission = (actor, required, message = 'Insufficient permission for this action') => {
    if (actor.isSuperAdmin)
        return;
    if (!actor.permissions.includes(required)) {
        throw app_error_1.AppError.forbidden(message);
    }
};
exports.assertHasPermission = assertHasPermission;
const hasPermission = (actor, permission) => Boolean(actor.isSuperAdmin || actor.permissions.includes(permission));
exports.hasPermission = hasPermission;
const stringifyJson = (value) => {
    if (value === undefined || value === null)
        return null;
    return JSON.stringify(value);
};
exports.stringifyJson = stringifyJson;
const daysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
};
exports.daysAgo = daysAgo;
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
];
/**
 * Baseline values the create schema fills in automatically. On create these
 * defaults are always present in the parsed DTO, so presence alone cannot mean
 * "the caller set this" — only a value that differs from the baseline does.
 * Keep this in sync with the defaults in `CreateAssetRequestSchema`.
 */
const SENSITIVE_ASSET_FIELD_DEFAULTS = {
    criticality: asset_enum_1.AssetRating.Medium,
    dataClassification: asset_enum_1.DataClassification.Internal,
    confidentialityRating: asset_enum_1.AssetRating.Medium,
    integrityRating: asset_enum_1.AssetRating.Medium,
    availabilityRating: asset_enum_1.AssetRating.Medium,
    lifecycleState: asset_enum_1.AssetLifecycleState.Active,
    sourceSystem: asset_enum_1.AssetSourceSystem.Manual,
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
const assertAdminForSensitiveAssetFields = (actor, dto, mode = 'update') => {
    if ((0, exports.hasPermission)(actor, 'asset:admin'))
        return;
    const changesSensitiveField = SENSITIVE_ASSET_FIELDS.some((field) => {
        if (!(field in dto))
            return false;
        if (mode === 'update')
            return true;
        const provided = dto[field] ?? null;
        const baseline = SENSITIVE_ASSET_FIELD_DEFAULTS[field] ?? null;
        return provided !== baseline;
    });
    if (changesSensitiveField) {
        throw app_error_1.AppError.forbidden('asset:admin is required to set classification, lifecycle, or source fields');
    }
};
exports.assertAdminForSensitiveAssetFields = assertAdminForSensitiveAssetFields;
//# sourceMappingURL=asset.utility.js.map