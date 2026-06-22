export interface CurrentUserRole {
  roleId: string;
  source: string; // "manual" | "azure_ad"
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
export function reconcileAdRoles(
  currentRoles: CurrentUserRole[],
  desiredRoleIds: string[],
): AdRoleReconcileResult {
  const desired = new Set(desiredRoleIds);
  const heldRoleIds = new Set(currentRoles.map((r) => r.roleId));

  const toAdd = [...desired].filter((roleId) => !heldRoleIds.has(roleId));

  const toRemove = currentRoles
    .filter((r) => r.source === 'azure_ad' && !desired.has(r.roleId))
    .map((r) => r.roleId);

  return { toAdd, toRemove };
}
