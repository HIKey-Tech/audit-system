jest.mock('../../../../shared/prisma/prisma.client', () => ({
  prisma: {
    audit_Engagement_Area: { findMany: jest.fn() },
    audit_Finding: { count: jest.fn() },
    audit_Evidence_Request: { count: jest.fn(), findMany: jest.fn() },
    audit_Engagement: { findFirst: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    workflow_Approval: { update: jest.fn() },
    audit_Plan: { updateMany: jest.fn() },
  },
}));

import { prisma } from '../../../../shared/prisma/prisma.client';
import { EngagementService } from '../service/implementation/engagement.service';
import { EvidenceRequestService } from '../../evidence-request/service/implementation/evidence-request.service';
import { ApprovalService } from '../../../workflow/approval/service/implementation/approval.service';

const m = prisma as unknown as {
  audit_Engagement_Area: { findMany: jest.Mock };
  audit_Finding: { count: jest.Mock };
  audit_Evidence_Request: { count: jest.Mock };
  audit_Engagement: { findFirst: jest.Mock };
  user: { findUnique: jest.Mock; findMany: jest.Mock };
  workflow_Approval: { update: jest.Mock };
  audit_Plan: { updateMany: jest.Mock };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const engagements: any = new (EngagementService as any)();

beforeEach(() => {
  jest.clearAllMocks();
  m.audit_Finding.count.mockResolvedValue(0);
  m.audit_Evidence_Request.count.mockResolvedValue(0);
  m.user.findUnique.mockResolvedValue({ display_name: 'Ngozi Eze', first_name: 'Ngozi', last_name: 'Eze' });
  m.audit_Engagement_Area.findMany.mockResolvedValue([{ universe_id: 'a1', universe: { name: 'Payroll Unit' } }]);
});

describe('taking an area or a person out of a group audit', () => {
  it('an area that has findings recorded against it cannot be removed', async () => {
    m.audit_Finding.count.mockResolvedValue(2);
    await expect(engagements._assertGroupRemovalsSafe('e1', { universeIds: [] }, new Set())).rejects.toThrow(/'Payroll Unit' cannot be removed: 2 finding/);
  });

  it('an area with no findings can be removed', async () => {
    await expect(engagements._assertGroupRemovalsSafe('e1', { universeIds: [] }, new Set())).resolves.toBeUndefined();
  });

  it('keeping an area is never a problem, even with findings', async () => {
    m.audit_Finding.count.mockResolvedValue(5);
    await expect(engagements._assertGroupRemovalsSafe('e1', { universeIds: ['a1'] }, new Set())).resolves.toBeUndefined();
  });

  it('a person still answering findings or evidence requests cannot be removed', async () => {
    m.audit_Finding.count.mockResolvedValue(1);
    m.audit_Evidence_Request.count.mockResolvedValue(3);
    await expect(engagements._assertGroupRemovalsSafe('e1', { auditeeIds: [] }, new Set(['u9']))).rejects.toThrow(/Ngozi Eze cannot be removed.*1 finding.*3 evidence/);
  });

  it('a person with nothing outstanding can be removed', async () => {
    await expect(engagements._assertGroupRemovalsSafe('e1', { auditeeIds: [] }, new Set(['u9']))).resolves.toBeUndefined();
  });

  it('a set that was not supplied is left alone', async () => {
    await expect(engagements._assertGroupRemovalsSafe('e1', {}, new Set(['u9']))).resolves.toBeUndefined();
    expect(m.audit_Finding.count).not.toHaveBeenCalled();
  });
});

describe('who an evidence request can be sent to in a group audit', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const erService = new (EvidenceRequestService as any)();
  const actor = { id: 'u1', email: 'a@b.test', displayName: 'A', roles: [], permissions: ['evidence:request'] };
  const user = (id: string, name: string) => ({ id, display_name: name, first_name: name, last_name: '', email: `${id}@x`, department: null, job_title: null });

  it('puts the main auditee first, then the other people being audited, then everyone else', async () => {
    m.audit_Engagement.findFirst.mockResolvedValue({ id: 'e1', auditee_id: 'main', additional_auditees: [{ user_id: 'x1' }, { user_id: 'x2' }] });
    m.user.findMany
      .mockResolvedValueOnce([user('x2', 'Zed'), user('main', 'Main'), user('x1', 'Ada')]) // the group, in any order
      .mockResolvedValueOnce([user('o1', 'Other')]);
    const list: Array<{ id: string }> = await erService.listAssignableUsers('e1', actor);
    expect(list.map((u) => u.id)).toEqual(['main', 'x1', 'x2', 'o1']);
    expect(list.find((u) => u.id === 'main')).toMatchObject({ isAuditee: true, isGroupAuditee: false });
    expect(list.find((u) => u.id === 'x1')).toMatchObject({ isAuditee: false, isGroupAuditee: true });
    expect(list.find((u) => u.id === 'o1')).toMatchObject({ isAuditee: false, isGroupAuditee: false });
  });

  it('the group is looked up by id, so a long directory cannot push them out of the list', async () => {
    m.audit_Engagement.findFirst.mockResolvedValue({ id: 'e1', auditee_id: 'main', additional_auditees: [] });
    m.user.findMany.mockResolvedValue([]);
    await erService.listAssignableUsers('e1', actor);
    expect(m.user.findMany.mock.calls[0][0].where.id).toEqual({ in: ['main'] });
    expect(m.user.findMany.mock.calls[1][0].where.id).toEqual({ notIn: ['main'] });
  });
});

describe('cancelling an approval', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approvals: any = new (ApprovalService as any)();
  const cancel = async (entityType: string) => {
    approvals._getPendingApproval = jest.fn().mockResolvedValue({ id: 'ap1', entity_type: entityType, entity_id: 'p1', steps: [] });
    approvals._stepRecipientIds = jest.fn().mockResolvedValue([]);
    m.workflow_Approval.update.mockResolvedValue({ id: 'ap1', steps: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await approvals.cancelApproval('ap1', { id: 'head', permissions: ['approval:cancel'] } as any).catch(() => undefined);
  };

  it('returns a programme that was only submitted to draft, so it is not stuck', async () => {
    await cancel('audit_plan');
    expect(m.audit_Plan.updateMany).toHaveBeenCalledWith({ where: { id: 'p1', status: 'submitted' }, data: { status: 'draft' } });
  });

  it('leaves an approved programme (additions under approval) approved', async () => {
    await cancel('audit_plan');
    // the update is conditional on status 'submitted', so an approved programme matches nothing and is untouched
    expect(m.audit_Plan.updateMany.mock.calls[0][0].where.status).toBe('submitted');
  });

  it('does not touch plans when something else is cancelled', async () => {
    await cancel('audit_report');
    expect(m.audit_Plan.updateMany).not.toHaveBeenCalled();
  });
});
