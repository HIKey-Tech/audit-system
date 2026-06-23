"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileAdRoles = reconcileAdRoles;
/**
 * Pure reconciliation of a user's Azure-derived roles.
 * - Adds desired roles the user holds under no source at all.
 * - Removes azure_ad roles the user no longer qualifies for.
 * - Manual roles are immutable here (never added, never removed).
 */
function reconcileAdRoles(currentRoles, desiredRoleIds) {
    const desired = new Set(desiredRoleIds);
    const heldRoleIds = new Set(currentRoles.map((r) => r.roleId));
    const toAdd = [...desired].filter((roleId) => !heldRoleIds.has(roleId));
    const toRemove = currentRoles
        .filter((r) => r.source === 'azure_ad' && !desired.has(r.roleId))
        .map((r) => r.roleId);
    return { toAdd, toRemove };
}
//# sourceMappingURL=role-reconciler.utility.js.map