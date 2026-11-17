import { prisma } from '../../../shared/prisma/prisma.client';
import { revokeUserSessions } from '../../../shared/security/session-guard';
import { UserService } from '../service/implementation/user.service';
import {
  assertCanModifyRole,
  assertSuperAdminRoleNotRenamed,
} from '../utility/role-management.utility';

jest.mock('../../../shared/prisma/prisma.client', () => ({
  prisma: {
    role: { findUnique: jest.fn() },
    permission: { findMany: jest.fn() },
    role_Permission: { deleteMany: jest.fn(), createMany: jest.fn() },
    user_Role: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../../shared/security/session-guard', () => ({
  revokeUserSessions: jest.fn().mockResolvedValue(undefined),
  setUserActiveSnapshot: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../logging/service/implementation/audit-log.service', () => ({
  auditLogService: { logAsync: jest.fn(), log: jest.fn() },
}));

const superAdmin = { id: 'root', isSuperAdmin: true, permissions: [] as string[] };
const delegated = (permissions: string[]) => ({ id: 'delegate', isSuperAdmin: false, permissions });

const role = (name: string, isSystem: boolean, permissionSlugs: string[]) => ({
  name,
  isSystem,
  permissionSlugs,
});

describe('role management policy', () => {
  describe('assertCanModifyRole', () => {
    it('lets a super admin modify anything, including super_admin', () => {
      expect(() => assertCanModifyRole(superAdmin, role('super_admin', true, ['a']), ['a', 'b'])).not.toThrow();
    });

    it('blocks a non-super-admin from modifying super_admin', () => {
      const actor = delegated(['settings:manage', 'a']);
      expect(() => assertCanModifyRole(actor, role('super_admin', true, ['a']))).toThrow('system role');
    });

    it('blocks a non-super-admin from modifying any system role', () => {
      const actor = delegated(['settings:manage', 'a']);
      expect(() => assertCanModifyRole(actor, role('platform', true, ['a']))).toThrow('system role');
    });

    it('blocks granting a permission the actor does not hold (the escalation hole)', () => {
      const actor = delegated(['settings:manage', 'audit:read']);
      expect(() =>
        assertCanModifyRole(actor, role('custom', false, ['audit:read']), ['audit:read', 'user:admin']),
      ).toThrow('permissions you do not hold');
    });

    it('blocks editing a role that already holds permissions the actor lacks', () => {
      const actor = delegated(['settings:manage', 'audit:read']);
      // Even shrinking it: the actor is not senior enough to manage this role at all.
      expect(() =>
        assertCanModifyRole(actor, role('director', false, ['audit:read', 'report:approve:final']), ['audit:read']),
      ).toThrow('permissions you do not hold');
    });

    it('allows managing a role wholly within the actor’s own authority', () => {
      const actor = delegated(['settings:manage', 'audit:read', 'audit:write']);
      expect(() =>
        assertCanModifyRole(actor, role('custom', false, ['audit:read']), ['audit:read', 'audit:write']),
      ).not.toThrow();
    });

    it('treats a name/description edit (no new permissions) with the same seniority rule', () => {
      const actor = delegated(['settings:manage', 'audit:read']);
      expect(() => assertCanModifyRole(actor, role('cae', false, ['report:approve:oversight']))).toThrow();
    });
  });

  describe('assertSuperAdminRoleNotRenamed', () => {
    it('blocks renaming super_admin, even for a super admin', () => {
      expect(() => assertSuperAdminRoleNotRenamed('super_admin', 'owner')).toThrow('cannot be renamed');
    });
    it('allows re-sending the same name', () => {
      expect(() => assertSuperAdminRoleNotRenamed('super_admin', 'super_admin')).not.toThrow();
    });
    it('allows editing super_admin without a name change', () => {
      expect(() => assertSuperAdminRoleNotRenamed('super_admin', undefined)).not.toThrow();
    });
    it('does not restrict other roles', () => {
      expect(() => assertSuperAdminRoleNotRenamed('auditor', 'senior_auditor')).not.toThrow();
    });
  });
});

type Mocked = Record<string, Record<string, jest.Mock> | jest.Mock>;
const db = prisma as unknown as Mocked;
const roleFindUnique = (db.role as Record<string, jest.Mock>).findUnique;
const permissionFindMany = (db.permission as Record<string, jest.Mock>).findMany;
const userRoleFindMany = (db.user_Role as Record<string, jest.Mock>).findMany;
const rolePermission = db.role_Permission as Record<string, jest.Mock>;
const transaction = db.$transaction as jest.Mock;
const revoke = revokeUserSessions as jest.Mock;

const perm = (slug: string) => ({
  permission: { id: `id-${slug}`, slug, name: slug, module: 'm', action: 'a', description: null },
});
// Serves both lookups UserService makes on a role: the narrow snapshot select
// and the wider include used to build the response.
const storedRole = (name: string, isSystem: boolean, slugs: string[]) => ({
  id: 'role-1',
  name,
  description: null,
  is_system: isSystem,
  role_permissions: slugs.map(perm),
});

describe('UserService.replaceRolePermissions', () => {
  const service = new UserService();

  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockResolvedValue([]);
  });

  it('revokes the sessions of every holder of the role after the change (stale-permission fix)', async () => {
    roleFindUnique.mockResolvedValue(storedRole('auditor', false, ['audit:read', 'audit:write']));
    permissionFindMany.mockResolvedValue([{ id: 'id-audit:read', slug: 'audit:read' }]);
    userRoleFindMany.mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }]);

    // Reduction: audit:write is being removed from the role.
    await service.replaceRolePermissions('role-1', { permissionIds: ['id-audit:read'] }, superAdmin);

    expect(revoke).toHaveBeenCalledTimes(3);
    expect(revoke.mock.calls.map((c) => c[0]).sort()).toEqual(['u1', 'u2', 'u3']);
  });

  it('revokes only after the permission write has committed', async () => {
    roleFindUnique.mockResolvedValue(storedRole('auditor', false, ['audit:read']));
    permissionFindMany.mockResolvedValue([{ id: 'id-audit:read', slug: 'audit:read' }]);
    userRoleFindMany.mockResolvedValue([{ user_id: 'u1' }]);
    const order: string[] = [];
    transaction.mockImplementation(async () => { order.push('commit'); return []; });
    revoke.mockImplementation(async () => { order.push('revoke'); });

    await service.replaceRolePermissions('role-1', { permissionIds: ['id-audit:read'] }, superAdmin);

    expect(order).toEqual(['commit', 'revoke']);
  });

  it('refuses a non-super-admin granting a permission they do not hold — and writes nothing', async () => {
    roleFindUnique.mockResolvedValue(storedRole('custom', false, ['audit:read']));
    permissionFindMany.mockResolvedValue([
      { id: 'id-audit:read', slug: 'audit:read' },
      { id: 'id-user:admin', slug: 'user:admin' },
    ]);

    await expect(
      service.replaceRolePermissions(
        'role-1',
        { permissionIds: ['id-audit:read', 'id-user:admin'] },
        delegated(['settings:manage', 'audit:read']),
      ),
    ).rejects.toThrow('permissions you do not hold');

    expect(transaction).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it('refuses a non-super-admin editing super_admin — and writes nothing', async () => {
    roleFindUnique.mockResolvedValue(storedRole('super_admin', true, ['audit:read']));
    permissionFindMany.mockResolvedValue([{ id: 'id-audit:read', slug: 'audit:read' }]);

    await expect(
      service.replaceRolePermissions(
        'role-1',
        { permissionIds: ['id-audit:read'] },
        delegated(['settings:manage', 'audit:read']),
      ),
    ).rejects.toThrow('system role');

    expect(transaction).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });

  it('404s on an unknown role without touching anything', async () => {
    roleFindUnique.mockResolvedValue(null);
    await expect(
      service.replaceRolePermissions('nope', { permissionIds: [] }, superAdmin),
    ).rejects.toThrow('not found');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an invalid permission id', async () => {
    roleFindUnique.mockResolvedValue(storedRole('custom', false, []));
    permissionFindMany.mockResolvedValue([]); // none of the requested ids exist
    await expect(
      service.replaceRolePermissions('role-1', { permissionIds: ['bogus'] }, superAdmin),
    ).rejects.toThrow('invalid');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('copes with a role nobody holds', async () => {
    roleFindUnique.mockResolvedValue(storedRole('custom', false, ['audit:read']));
    permissionFindMany.mockResolvedValue([]);
    userRoleFindMany.mockResolvedValue([]);
    await service.replaceRolePermissions('role-1', { permissionIds: [] }, superAdmin);
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe('UserService.updateRole', () => {
  const service = new UserService();
  const update = (db.role as Record<string, jest.Mock>);

  beforeEach(() => {
    jest.clearAllMocks();
    (update as unknown as Record<string, jest.Mock>).update = jest.fn();
  });

  it('refuses to rename super_admin, even for a super admin', async () => {
    roleFindUnique.mockResolvedValue(storedRole('super_admin', true, ['audit:read']));
    await expect(service.updateRole('role-1', { name: 'owner' }, superAdmin)).rejects.toThrow('cannot be renamed');
    expect((update as unknown as Record<string, jest.Mock>).update).not.toHaveBeenCalled();
  });

  it('refuses a non-super-admin editing a role senior to them', async () => {
    roleFindUnique.mockResolvedValue(storedRole('cae', false, ['report:approve:oversight']));
    await expect(
      service.updateRole('role-1', { description: 'x' }, delegated(['settings:manage'])),
    ).rejects.toThrow('permissions you do not hold');
  });

  it('revokes holders’ sessions when a role is renamed (the name rides in the JWT)', async () => {
    roleFindUnique
      .mockResolvedValueOnce(storedRole('auditor', false, ['audit:read'])) // existing
      .mockResolvedValueOnce(storedRole('auditor', false, ['audit:read'])) // snapshot
      .mockResolvedValueOnce(null); // name-collision lookup
    (update as unknown as Record<string, jest.Mock>).update.mockResolvedValue(
      storedRole('senior_auditor', false, ['audit:read']),
    );
    userRoleFindMany.mockResolvedValue([{ user_id: 'u1' }, { user_id: 'u2' }]);

    await service.updateRole('role-1', { name: 'senior_auditor' }, superAdmin);

    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it('does not revoke when only the description changes', async () => {
    roleFindUnique
      .mockResolvedValueOnce(storedRole('auditor', false, ['audit:read']))
      .mockResolvedValueOnce(storedRole('auditor', false, ['audit:read']));
    (update as unknown as Record<string, jest.Mock>).update.mockResolvedValue(
      storedRole('auditor', false, ['audit:read']),
    );

    await service.updateRole('role-1', { description: 'new text' }, superAdmin);

    expect(revoke).not.toHaveBeenCalled();
  });
});

describe('UserService.createRole', () => {
  const service = new UserService();
  const create = () => (db.role as Record<string, jest.Mock>).create;

  beforeEach(() => {
    jest.clearAllMocks();
    (db.role as Record<string, jest.Mock>).create = jest.fn();
  });

  it('refuses a non-super-admin creating a role with authority they lack', async () => {
    roleFindUnique.mockResolvedValue(null);
    permissionFindMany.mockResolvedValue([{ id: 'id-user:admin', slug: 'user:admin' }]);

    await expect(
      service.createRole(
        { name: 'sneaky', permissionIds: ['id-user:admin'] } as never,
        delegated(['settings:manage']),
      ),
    ).rejects.toThrow('permissions you do not hold');
    expect(create()).not.toHaveBeenCalled();
  });

  it('lets a super admin create any role', async () => {
    roleFindUnique.mockResolvedValue(null);
    permissionFindMany.mockResolvedValue([{ id: 'id-user:admin', slug: 'user:admin' }]);
    create().mockResolvedValue(storedRole('powerful', false, ['user:admin']));

    await service.createRole({ name: 'powerful', permissionIds: ['id-user:admin'] } as never, superAdmin);

    expect(create()).toHaveBeenCalledTimes(1);
  });
});
