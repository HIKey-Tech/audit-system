jest.mock('../../../shared/prisma/prisma.client', () => ({
  prisma: {
    audit_Engagement: { count: jest.fn() },
    audit_Finding: { count: jest.fn() },
    role: { findFirst: jest.fn() },
    user_Role: { findFirst: jest.fn(), create: jest.fn() },
    permission: { findMany: jest.fn().mockResolvedValue([]) },
    role_Permission: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn() },
  },
}));
jest.mock('../../../shared/security/session-guard', () => ({ revokeUserSessions: jest.fn() }));

import { prisma } from '../../../shared/prisma/prisma.client';
import { revokeUserSessions } from '../../../shared/security/session-guard';
import { ensureAuditeeRoleIfNamed } from '../utility/auditee-role.utility';

const m = prisma as unknown as {
  audit_Engagement: { count: jest.Mock };
  audit_Finding: { count: jest.Mock };
  role: { findFirst: jest.Mock };
  user_Role: { findFirst: jest.Mock; create: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  m.role.findFirst.mockResolvedValue({ id: 'auditee-role' });
  m.user_Role.findFirst.mockResolvedValue(null);
});

describe('the Auditee role is checked when someone signs in', () => {
  it('gives the role to a person who has been named auditee, without logging them out', async () => {
    m.audit_Engagement.count.mockResolvedValue(1);
    m.audit_Finding.count.mockResolvedValue(0);
    await ensureAuditeeRoleIfNamed('u1');
    expect(m.user_Role.create).toHaveBeenCalledTimes(1);
    expect(revokeUserSessions).not.toHaveBeenCalled();
  });

  it('does nothing for someone who is not an auditee on anything', async () => {
    m.audit_Engagement.count.mockResolvedValue(0);
    m.audit_Finding.count.mockResolvedValue(0);
    await ensureAuditeeRoleIfNamed('u1');
    expect(m.user_Role.create).not.toHaveBeenCalled();
  });

  it('never blocks sign-in if the check fails', async () => {
    m.audit_Engagement.count.mockRejectedValue(new Error('db down'));
    await expect(ensureAuditeeRoleIfNamed('u1')).resolves.toBeUndefined();
  });
});
