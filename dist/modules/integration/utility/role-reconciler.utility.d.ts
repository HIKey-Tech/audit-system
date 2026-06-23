export interface CurrentUserRole {
    roleId: string;
    source: string;
}
export interface AdRoleReconcileResult {
    /** role ids to insert as source="azure_ad" */
    toAdd: string[];
    /** role ids (source="azure_ad") to delete */
    toRemove: string[];
}
/**
 * Pure reconciliation of a user's Azure-derived roles.
 * - Adds desired roles the user holds under no source at all.
 * - Removes azure_ad roles the user no longer qualifies for.
 * - Manual roles are immutable here (never added, never removed).
 */
export declare function reconcileAdRoles(currentRoles: CurrentUserRole[], desiredRoleIds: string[]): AdRoleReconcileResult;
//# sourceMappingURL=role-reconciler.utility.d.ts.map