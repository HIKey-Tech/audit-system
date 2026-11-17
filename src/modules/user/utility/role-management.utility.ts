// src/modules/user/utility/role-management.utility.ts
//
// Least-privilege rules for creating and editing roles. These mirror the guard
// that already protects *assigning* roles (UserService._assertCanGrantRoles): a
// role is just a bag of permissions, so editing one's permissions is exactly as
// powerful as granting them — it needs the same "you cannot hand out authority
// you do not hold" check, or a delegated `settings:manage` holder could edit a
// role they already hold (or `super_admin` itself) and promote themselves.
import { AppError } from '../../../shared/errors/app.error';
import { RoleManagementActor } from '../service/interface/user.service.interface';

/** The role that carries platform-admin authority; its name drives `is_super_admin`. */
export const SUPER_ADMIN_ROLE_NAME = 'super_admin';

export interface RoleSnapshot {
  name: string;
  isSystem: boolean;
  /** Slugs the role holds right now. */
  permissionSlugs: readonly string[];
}

/**
 * Throws unless `actor` may modify `role`.
 *
 * A super admin may modify any role. Everyone else:
 *   - may never modify `super_admin` or any system role, and
 *   - may only manage a role whose permissions — both the ones it holds now and
 *     the ones it would hold afterwards (`resultingPermissionSlugs`) — are all
 *     permissions the actor holds themselves. Checking the current set as well
 *     stops a lesser admin from editing (or stripping) a more powerful role.
 */
export const assertCanModifyRole = (
  actor: RoleManagementActor,
  role: RoleSnapshot,
  resultingPermissionSlugs: readonly string[] = role.permissionSlugs,
): void => {
  if (actor.isSuperAdmin) return;

  if (role.name === SUPER_ADMIN_ROLE_NAME || role.isSystem) {
    throw AppError.forbidden('Only a super admin can modify a system role');
  }

  const held = new Set(actor.permissions);
  const unheld = [...role.permissionSlugs, ...resultingPermissionSlugs].find(
    (slug) => !held.has(slug),
  );
  if (unheld !== undefined) {
    throw AppError.forbidden('You cannot modify a role that grants permissions you do not hold');
  }
};

/**
 * Throws if `name` change would rename the `super_admin` role. Nobody — super
 * admins included — may do this: `_syncUserSuperAdminFlag` and the role guards
 * identify the role by name, so a rename would silently strip every super
 * admin's flag (or make a different role look like it).
 */
export const assertSuperAdminRoleNotRenamed = (currentName: string, newName?: string): void => {
  if (currentName === SUPER_ADMIN_ROLE_NAME && newName !== undefined && newName !== currentName) {
    throw AppError.badRequest('The super_admin role cannot be renamed');
  }
};
