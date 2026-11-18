jest.mock('../../../../shared/prisma/prisma.client', () => ({
  prisma: {
    system_Config: { findUnique: jest.fn(), upsert: jest.fn() },
    compliance_Framework: { findMany: jest.fn(), count: jest.fn() },
  },
}));

import { prisma } from '../../../../shared/prisma/prisma.client';
import { ComplianceService } from '../service/implementation/compliance.service';

const m = prisma as unknown as {
  system_Config: { findUnique: jest.Mock; upsert: jest.Mock };
  compliance_Framework: { findMany: jest.Mock; count: jest.Mock };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = new (ComplianceService as any)();
const manager = { id: 'u1', email: 'a@b.test', displayName: 'A', roles: ['compliance_auditor'], permissions: ['control:manage'] };
const other = { ...manager, permissions: ['control:read'] };

beforeEach(() => jest.clearAllMocks());

describe('default frameworks per audit type', () => {
  it('returns nothing when none are configured', async () => {
    m.system_Config.findUnique.mockResolvedValue(null);
    expect(await service.getDefaultFrameworks()).toEqual({});
  });

  it('drops frameworks that no longer exist or are inactive', async () => {
    m.system_Config.findUnique.mockResolvedValue({ value: JSON.stringify({ compliance: ['f1', 'gone'], it: ['f2'] }) });
    m.compliance_Framework.findMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);
    expect(await service.getDefaultFrameworks()).toEqual({ compliance: ['f1'], it: ['f2'] });
  });

  it('ignores a corrupt stored value instead of failing', async () => {
    m.system_Config.findUnique.mockResolvedValue({ value: '{not json' });
    expect(await service.getDefaultFrameworks()).toEqual({});
  });

  it('can only be changed by someone who manages controls', async () => {
    await expect(service.setDefaultFrameworks({ it: ['f1'] }, other)).rejects.toThrow();
    expect(m.system_Config.upsert).not.toHaveBeenCalled();
  });

  it('refuses a framework that does not exist', async () => {
    m.compliance_Framework.count.mockResolvedValue(0);
    await expect(service.setDefaultFrameworks({ it: ['nope'] }, manager)).rejects.toThrow(/do not exist/);
  });

  it('saves the choice, without duplicates', async () => {
    m.compliance_Framework.count.mockResolvedValue(1);
    const saved = await service.setDefaultFrameworks({ it: ['f1', 'f1'] }, manager);
    expect(saved).toEqual({ it: ['f1'] });
    expect(JSON.parse(m.system_Config.upsert.mock.calls[0][0].create.value)).toEqual({ it: ['f1'] });
  });
});
