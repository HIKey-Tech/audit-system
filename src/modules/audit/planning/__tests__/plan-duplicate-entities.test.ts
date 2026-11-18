jest.mock('../../../../shared/prisma/prisma.client', () => ({
  prisma: {
    audit_Plan: { findFirst: jest.fn() },
    audit_Universe: { findFirst: jest.fn(), findMany: jest.fn() },
    audit_Plan_Item: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), createMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({ audit_Plan_Item: { createMany: jest.fn() } })),
  },
}));
jest.mock('../../../../modules/logging/service/implementation/audit-log.service', () => ({
  auditLogService: { logAsync: jest.fn(), log: jest.fn() },
}));

import { prisma } from '../../../../shared/prisma/prisma.client';
import { AuditPriority } from '../../domain/enum/audit.enum';
import { PlanningService } from '../service/implementation/planning.service';

const actor = { id: 'u1', email: 'a@b.test', displayName: 'A', roles: ['auditor'], permissions: ['plan:add_item'] };
const dates = { plannedStartDate: '2029-01-01T00:00:00.000Z', plannedEndDate: '2029-03-31T00:00:00.000Z', priority: AuditPriority.Low };
const m = prisma as unknown as {
  audit_Plan: { findFirst: jest.Mock };
  audit_Universe: { findFirst: jest.Mock; findMany: jest.Mock };
  audit_Plan_Item: { findMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = new PlanningService({} as any);
service.getPlanById = jest.fn().mockResolvedValue({ id: 'p1' });

beforeEach(() => {
  jest.clearAllMocks();
  m.audit_Plan.findFirst.mockResolvedValue({ status: 'draft' });
  m.audit_Universe.findFirst.mockResolvedValue({ id: 'e1', name: 'Treasury', status: 'active' });
  m.audit_Universe.findMany.mockResolvedValue([{ id: 'e1', name: 'Treasury', status: 'active' }, { id: 'e2', name: 'Payroll', status: 'active' }]);
  m.audit_Plan_Item.findMany.mockResolvedValue([]);
  m.audit_Plan_Item.create.mockResolvedValue({ id: 'i1' });
});

describe('an entity can be in a programme once', () => {
  it('adds an entity that is not yet in the programme', async () => {
    await service.addPlanItem('p1', { universeId: 'e1', ...dates }, actor);
    expect(m.audit_Plan_Item.create).toHaveBeenCalledTimes(1);
  });

  it('refuses to add an entity that is already in the programme, naming it', async () => {
    m.audit_Plan_Item.findMany.mockResolvedValue([{ universe: { name: 'Treasury' } }]);
    await expect(service.addPlanItem('p1', { universeId: 'e1', ...dates }, actor)).rejects.toThrow(/'Treasury' is already in this programme/);
    expect(m.audit_Plan_Item.create).not.toHaveBeenCalled();
  });

  it('bulk add refuses if any selected entity is already in the programme, and adds nothing', async () => {
    m.audit_Plan_Item.findMany.mockResolvedValue([{ universe: { name: 'Payroll' } }]);
    await expect(
      service.bulkAddPlanItems('p1', { items: [{ universeId: 'e1', ...dates }, { universeId: 'e2', ...dates }] }, actor),
    ).rejects.toThrow(/'Payroll' is already in this programme/);
    expect((prisma.$transaction as jest.Mock)).not.toHaveBeenCalled();
  });

  it('bulk add refuses the same entity listed twice in one request', async () => {
    await expect(
      service.bulkAddPlanItems('p1', { items: [{ universeId: 'e1', ...dates }, { universeId: 'e1', ...dates }] }, actor),
    ).rejects.toThrow(/more than once/);
  });

  it('bulk add accepts a fresh set of entities', async () => {
    await service.bulkAddPlanItems('p1', { items: [{ universeId: 'e1', ...dates }, { universeId: 'e2', ...dates }] }, actor);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('editing an item may keep its own entity, but not switch to one already in the programme', async () => {
    m.audit_Plan_Item.findFirst.mockResolvedValue({ id: 'i1', universe_id: 'e1', engagement_created: false, planned_start_date: new Date('2029-01-01'), planned_end_date: new Date('2029-03-01') });
    m.audit_Plan_Item.update.mockResolvedValue({ universe_id: 'e1', priority: 'low', planned_start_date: new Date('2029-01-01'), planned_end_date: new Date('2029-03-01'), notes: 'same entity' });
    await service.updatePlanItem('p1', 'i1', { universeId: 'e1', notes: 'same entity' }, actor);
    expect(m.audit_Plan_Item.update).toHaveBeenCalledTimes(1);

    m.audit_Plan_Item.findMany.mockResolvedValue([{ universe: { name: 'Payroll' } }]);
    await expect(service.updatePlanItem('p1', 'i1', { universeId: 'e2' }, actor)).rejects.toThrow(/'Payroll' is already in this programme/);
    // The check must ignore the item being edited.
    expect(m.audit_Plan_Item.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 'i1' } }) }),
    );
  });
});
