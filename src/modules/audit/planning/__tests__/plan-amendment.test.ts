jest.mock('../../../../shared/prisma/prisma.client', () => ({
  prisma: {
    audit_Plan: { findFirst: jest.fn() },
    audit_Universe: { findFirst: jest.fn(), findMany: jest.fn() },
    audit_Plan_Item: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    workflow_Approval: { count: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({ audit_Plan_Item: { createMany: jest.fn() } })),
  },
}));
jest.mock('../../../../modules/logging/service/implementation/audit-log.service', () => ({
  auditLogService: { logAsync: jest.fn(), log: jest.fn() },
}));

import { prisma } from '../../../../shared/prisma/prisma.client';
import { AuditPriority } from '../../domain/enum/audit.enum';
import { PlanningService } from '../service/implementation/planning.service';
import { ApprovalStatusService } from '../../approval-status/service/implementation/approval-status.service';

const actor = { id: 'u1', email: 'a@b.test', displayName: 'A', roles: ['auditor'], permissions: ['plan:add_item'] };
const dates = { plannedStartDate: '2029-01-01T00:00:00.000Z', plannedEndDate: '2029-03-31T00:00:00.000Z', priority: AuditPriority.Low };
const m = prisma as unknown as {
  audit_Plan: { findFirst: jest.Mock };
  audit_Universe: { findFirst: jest.Mock };
  audit_Plan_Item: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  workflow_Approval: { count: jest.Mock };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = new PlanningService({} as any);
service.getPlanById = jest.fn().mockResolvedValue({ id: 'p1' });

beforeEach(() => {
  jest.clearAllMocks();
  m.audit_Plan.findFirst.mockResolvedValue({ status: 'approved' });
  m.audit_Universe.findFirst.mockResolvedValue({ id: 'e1', name: 'Treasury', status: 'active' });
  m.audit_Plan_Item.findMany.mockResolvedValue([]);
  m.audit_Plan_Item.create.mockResolvedValue({ id: 'i1' });
  m.workflow_Approval.count.mockResolvedValue(0);
});

describe('adding to a programme that is already approved', () => {
  it('adds the entity flagged as awaiting approval; the programme itself is not touched', async () => {
    await service.addPlanItem('p1', { universeId: 'e1', ...dates }, actor);
    expect(m.audit_Plan_Item.create.mock.calls[0][0].data.pending_approval).toBe(true);
  });

  it('a draft programme gets ordinary items, not flagged', async () => {
    m.audit_Plan.findFirst.mockResolvedValue({ status: 'draft' });
    await service.addPlanItem('p1', { universeId: 'e1', ...dates }, actor);
    expect(m.audit_Plan_Item.create.mock.calls[0][0].data.pending_approval).toBe(false);
  });

  it('is refused while earlier additions are still waiting for a decision', async () => {
    m.workflow_Approval.count.mockResolvedValue(1);
    await expect(service.addPlanItem('p1', { universeId: 'e1', ...dates }, actor)).rejects.toThrow(/already waiting for approval/);
    expect(m.audit_Plan_Item.create).not.toHaveBeenCalled();
  });

  it('is still refused for a programme that is submitted (not draft, rejected or approved)', async () => {
    m.audit_Plan.findFirst.mockResolvedValue({ status: 'submitted' });
    await expect(service.addPlanItem('p1', { universeId: 'e1', ...dates }, actor)).rejects.toThrow(/draft or rejected/);
  });

  it('an item of the approved programme cannot be edited or removed', async () => {
    m.audit_Plan_Item.findFirst.mockResolvedValue({ id: 'i0', universe_id: 'e9', pending_approval: false, engagement_created: false });
    await expect(service.updatePlanItem('p1', 'i0', { priority: AuditPriority.High }, actor)).rejects.toThrow(/part of the approved programme/);
    await expect(service.removePlanItem('p1', 'i0', actor)).rejects.toThrow(/part of the approved programme/);
    expect(m.audit_Plan_Item.delete).not.toHaveBeenCalled();
  });

  it('a newly added item can still be removed before it is submitted', async () => {
    m.audit_Plan_Item.findFirst.mockResolvedValue({
      id: 'i1', universe_id: 'e1', pending_approval: true, engagement_created: false,
      priority: 'low', planned_start_date: new Date(), planned_end_date: new Date(), notes: null,
    });
    await service.removePlanItem('p1', 'i1', actor);
    expect(m.audit_Plan_Item.delete).toHaveBeenCalledTimes(1);
  });
});

describe('what happens to the programme when the additions are decided', () => {
  const status = new ApprovalStatusService();
  const tx = () => ({
    audit_Plan: { findUnique: jest.fn(), update: jest.fn() },
    audit_Plan_Item: { updateMany: jest.fn() },
  });
  const run = async (fn: (t: ReturnType<typeof tx>) => Promise<void>, planStatus: string) => {
    const t = tx();
    t.audit_Plan.findUnique.mockResolvedValue({ status: planStatus });
    await fn(t);
    return t;
  };

  it('approving the additions makes them usable and keeps the original approval record', async () => {
    const t = await run((x) => status.markApproved(x as never, 'audit_plan', 'p1', 'dg', new Date()), 'approved');
    expect(t.audit_Plan_Item.updateMany.mock.calls[0][0].data).toEqual({ pending_approval: false });
    expect(t.audit_Plan.update.mock.calls[0][0].data).toEqual({ rejection_reason: null });
  });

  it('approving a first submission approves the programme', async () => {
    const t = await run((x) => status.markApproved(x as never, 'audit_plan', 'p1', 'dg', new Date()), 'submitted');
    expect(t.audit_Plan.update.mock.calls[0][0].data.status).toBe('approved');
    expect(t.audit_Plan.update.mock.calls[0][0].data.approved_by_id).toBe('dg');
  });

  it('rejecting the additions leaves the programme approved and records the reason', async () => {
    const t = await run((x) => status.markRejected(x as never, 'audit_plan', 'p1', 'dg', 'Not now'), 'approved');
    expect(t.audit_Plan.update.mock.calls[0][0].data).toEqual({ rejection_reason: 'Not now' });
    expect(t.audit_Plan_Item.updateMany).not.toHaveBeenCalled();
  });

  it('rejecting a first submission rejects the programme', async () => {
    const t = await run((x) => status.markRejected(x as never, 'audit_plan', 'p1', 'dg', 'No'), 'submitted');
    expect(t.audit_Plan.update.mock.calls[0][0].data.status).toBe('rejected');
  });
});
