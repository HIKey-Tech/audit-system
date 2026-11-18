import { EngagementQuerySchema } from '../dto/request/engagement.request.dto';

jest.mock('../../../../shared/prisma/prisma.client', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  return {
    prisma: {
      audit_Engagement: { findMany, count },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    },
  };
});

import { prisma } from '../../../../shared/prisma/prisma.client';
import { EngagementService } from '../service/implementation/engagement.service';

const actor = { id: 'u1', email: 'a@b.test', displayName: 'A', roles: ['super_admin'], permissions: ['*'] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = new (EngagementService as any)();
const lastWhere = (): Record<string, unknown> => (prisma.audit_Engagement.count as jest.Mock).mock.calls.at(-1)![0].where;

describe('engagement list filters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('parses overdue from the query string, treating "false" as false', () => {
    expect(EngagementQuerySchema.parse({ overdue: 'true' }).overdue).toBe(true);
    expect(EngagementQuerySchema.parse({ overdue: 'false' }).overdue).toBe(false);
    expect(EngagementQuerySchema.parse({}).overdue).toBe(false);
  });

  it('overdue = past its OLA deadline and not yet reported or closed', async () => {
    await service.listEngagements(EngagementQuerySchema.parse({ overdue: 'true' }), actor);
    const where = lastWhere() as { sla_deadline: { lt: Date }; status: { notIn: string[] } };
    expect(where.sla_deadline.lt).toBeInstanceOf(Date);
    expect(where.status.notIn).toEqual(['reported', 'closed']);
  });

  it('without overdue the list is not narrowed by deadline or status', async () => {
    await service.listEngagements(EngagementQuerySchema.parse({}), actor);
    const where = lastWhere();
    expect(where).not.toHaveProperty('sla_deadline');
    expect(where).not.toHaveProperty('status');
  });

  it('search matches reference number or title, and priority filters exactly', async () => {
    await service.listEngagements(EngagementQuerySchema.parse({ search: 'treasury', priority: 'high' }), actor);
    const where = lastWhere() as { AND: unknown[]; OR: unknown[]; priority: string };
    expect(where.priority).toBe('high');
    expect(where.AND).toEqual([{ OR: [{ title: { contains: 'treasury' } }, { reference_number: { contains: 'treasury' } }] }]);
    // The caller's access scope (their own engagements) must still apply alongside the search.
    expect(where.OR).toContainEqual({ lead_auditor_id: 'u1' });
  });
});
