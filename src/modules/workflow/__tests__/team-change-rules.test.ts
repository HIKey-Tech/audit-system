jest.mock('../../../shared/prisma/prisma.client', () => ({ prisma: {} }));
jest.mock('../../messaging/service/implementation/notification-queue.service', () => ({ notificationQueueService: {} }));
jest.mock('../approval/service/implementation/approval.service', () => ({ workflowApprovalService: {} }));

import { assertCanManageTeam, assertCanSubstitute } from '../assignment/service/implementation/assignment.service';

const head = { id: 'head', permissions: ['engagement:read_all', 'assignment:create'] } as never;
const lead = { id: 'lead', permissions: ['assignment:create'] } as never;
const manager = { id: 'mgr', permissions: ['assignment:create'] } as never;
const other = { id: 'other', permissions: ['assignment:create'] } as never;
const team = { lead_auditor_id: 'lead', audit_manager_id: 'mgr' };
const sole = { lead_auditor_id: 'lead', audit_manager_id: 'lead' };

describe('who may reassign an audit', () => {
  it('a sole auditor’s audit can be reassigned only by the Head of Internal Audit', () => {
    expect(() => assertCanSubstitute(sole, head, 'lead_auditor')).not.toThrow();
    expect(() => assertCanSubstitute(sole, lead, 'lead_auditor')).toThrow(/Head of Internal Audit/);
    expect(() => assertCanSubstitute(sole, other, 'lead_auditor')).toThrow(/Head of Internal Audit/);
  });

  it('on a team audit the lead or the manager can reassign the lead or a supporting auditor', () => {
    for (const who of [lead, manager]) {
      expect(() => assertCanSubstitute(team, who, 'lead_auditor')).not.toThrow();
      expect(() => assertCanSubstitute(team, who, 'supporting_auditor')).not.toThrow();
    }
  });

  it('replacing the audit manager is the Head’s call, not the lead’s or the manager’s own', () => {
    expect(() => assertCanSubstitute(team, head, 'audit_manager')).not.toThrow();
    expect(() => assertCanSubstitute(team, lead, 'audit_manager')).toThrow(/Head of Internal Audit/);
    expect(() => assertCanSubstitute(team, manager, 'audit_manager')).toThrow(/Head of Internal Audit/);
  });

  it('an auditor who is not on the audit cannot reassign it, even holding the assignment permission', () => {
    expect(() => assertCanSubstitute(team, other, 'supporting_auditor')).toThrow();
  });
});

describe('who may add or remove helpers on an audit', () => {
  it('the Head, the lead and the manager (a sole auditor is both) may; nobody else', () => {
    expect(() => assertCanManageTeam(team, head)).not.toThrow();
    expect(() => assertCanManageTeam(team, lead)).not.toThrow();
    expect(() => assertCanManageTeam(team, manager)).not.toThrow();
    expect(() => assertCanManageTeam(sole, lead)).not.toThrow();
    expect(() => assertCanManageTeam(team, other)).toThrow();
  });
});
