jest.mock('../../../../shared/prisma/prisma.client', () => ({
  prisma: { audit_Plan_Item: { findUnique: jest.fn() } },
}));

import { prisma } from '../../../../shared/prisma/prisma.client';
import { EngagementService } from '../service/implementation/engagement.service';

const actor = { id: 'u1', email: 'a@b.test', displayName: 'A', roles: ['auditor'], permissions: ['engagement:create'] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = new (EngagementService as any)();
const dto = {
  title: 't', leadAuditorId: 'a', auditManagerId: 'b', auditeeId: 'c',
  plannedStartDate: '2029-01-01T00:00:00.000Z', plannedEndDate: '2029-02-01T00:00:00.000Z', slaDeadline: '2029-02-01T00:00:00.000Z',
};

describe('starting an audit from a programme item', () => {
  it('is refused for an item added after approval that is still waiting for approval', async () => {
    (prisma.audit_Plan_Item.findUnique as jest.Mock).mockResolvedValue({
      id: 'i1', engagement_created: false, pending_approval: true, plan: { status: 'approved' },
    });
    await expect(service.createFromPlanItem('i1', dto, actor)).rejects.toThrow(/still waiting for approval/);
  });
});
