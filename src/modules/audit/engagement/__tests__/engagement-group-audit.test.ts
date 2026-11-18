jest.mock('../../../../shared/prisma/prisma.client', () => ({
  prisma: { audit_Universe: { findFirst: jest.fn() } },
}));

import { prisma } from '../../../../shared/prisma/prisma.client';
import { EngagementService } from '../service/implementation/engagement.service';

const universe = prisma.audit_Universe.findFirst as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service: any = new (EngagementService as any)();
service.userService = { getUserById: jest.fn().mockResolvedValue({ isActive: true }) };
const ctx = { leadId: 'lead', managerId: 'mgr', auditeeId: 'main', universeId: 'u-primary' };

beforeEach(() => {
  jest.clearAllMocks();
  universe.mockResolvedValue({ id: 'x' });
  service.userService.getUserById.mockResolvedValue({ isActive: true });
});

describe('group audit scope', () => {
  it('leaves a set alone when it is not supplied', async () => {
    expect(await service._validateGroupScope({}, ctx)).toEqual({});
  });

  it('lists each further auditee and area once, never repeating the main auditee or the primary entity', async () => {
    const r = await service._validateGroupScope(
      { additionalAuditeeIds: ['a1', 'a1', 'main', 'a2'], additionalUniverseIds: ['u2', 'u-primary', 'u2', 'u3'] },
      ctx,
    );
    expect(r.auditeeIds).toEqual(['a1', 'a2']);
    expect(r.universeIds).toEqual(['u2', 'u3']);
  });

  it('an empty list is a real instruction: it clears the set', async () => {
    expect(await service._validateGroupScope({ additionalAuditeeIds: [], additionalUniverseIds: [] }, ctx)).toEqual({
      auditeeIds: [],
      universeIds: [],
    });
  });

  it('the lead auditor or the manager cannot also be one of the people being audited', async () => {
    await expect(service._validateGroupScope({ additionalAuditeeIds: ['lead'] }, ctx)).rejects.toThrow(/cannot also be/);
    await expect(service._validateGroupScope({ additionalAuditeeIds: ['mgr'] }, ctx)).rejects.toThrow(/cannot also be/);
  });

  it('refuses a deactivated auditee', async () => {
    service.userService.getUserById.mockResolvedValue({ isActive: false });
    await expect(service._validateGroupScope({ additionalAuditeeIds: ['a1'] }, ctx)).rejects.toThrow(/deactivated/);
  });

  it('refuses an area that is not in the audit universe', async () => {
    universe.mockResolvedValue(null);
    await expect(service._validateGroupScope({ additionalUniverseIds: ['nope'] }, ctx)).rejects.toThrow();
  });
});

describe('who can see a group audit', () => {
  const actor = { id: 'u9', permissions: ['engagement:read'] };

  it('a person named as an additional auditee can open the engagement', () => {
    const scope = service._actorScope(actor);
    expect(scope.OR).toContainEqual({ additional_auditees: { some: { user_id: 'u9' } } });
  });

  it('oversight still sees everything', () => {
    expect(service._actorScope({ id: 'u9', permissions: ['engagement:read_all'] })).toBeUndefined();
  });
});
