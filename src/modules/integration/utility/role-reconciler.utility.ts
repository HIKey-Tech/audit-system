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

/**
 * The roles a user should hold from directory sync, including the baseline role (e.g. `viewer`).
 *
 * The baseline only exists so that someone with no role at all can still sign in and read. A person who already
 * has a real role — from a mapped directory group, or assigned by an administrator — gets just that role, so
 * their profile shows "System Auditor" and not "System Auditor, Viewer". Because the reconcile step removes
 * directory-sourced roles that are no longer desired, a baseline added earlier is cleaned up on the next sync.
 */
export function withBaselineRole(
  groupRoleIds: string[],
  currentRoles: CurrentUserRole[],
  baselineRoleId: string | null | undefined,
): string[] {
  if (!baselineRoleId) return groupRoleIds;
  const holdsManualRole = currentRoles.some((r) => r.source !== 'azure_ad');
  if (groupRoleIds.length > 0 || holdsManualRole) return groupRoleIds;
  return [baselineRoleId];
}
