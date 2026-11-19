jest.mock('../../../shared/prisma/prisma.client', () => ({ prisma: {} }));
jest.mock('../../audit/utility/audit-config.utility', () => ({
  getApprovalMatrix: jest.fn().mockResolvedValue({
    auditPlan: [],
    auditReport: ['engagement_manager', 'report:approve:oversight', 'report:approve:final'],
    workingPaper: ['engagement_manager'],
    findingClosure: [],
  }),
  ENGAGEMENT_MANAGER_APPROVER: 'engagement_manager',
}));

import { ApprovalService } from '../approval/service/implementation/approval.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = new (ApprovalService as any)();

/** A db with an engagement whose lead/manager are as given, and a report sign-off choice. */
const db = (lead: string, manager: string, signOff?: 'cae_only' | 'cae_and_dg') => ({
  audit_Report: { findFirst: jest.fn().mockResolvedValue({ id: 'r1', engagement: { lead_auditor_id: lead, audit_manager_id: manager } }) },
  audit_Working_Paper: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', engagement: { lead_auditor_id: lead, audit_manager_id: manager } }) },
  system_Config: { findUnique: jest.fn().mockResolvedValue(signOff ? { value: signOff } : null) },
  user: { findFirst: jest.fn().mockResolvedValue({ id: 'someone' }) },
});

describe('report approval for a sole auditor', () => {
  it('skips the manager step: the report goes straight to the Head, then the DG', async () => {
    const levels = await service._resolveApproverChain(db('ada', 'ada'), 'audit_report', 'r1', 'ada');
    expect(levels).toEqual([
      { approverId: null, requiredPermission: 'report:approve:oversight' },
      { approverId: null, requiredPermission: 'report:approve:final' },
    ]);
  });

  it('"Head only" sign-off is a single step: the Head', async () => {
    const levels = await service._resolveApproverChain(db('ada', 'ada', 'cae_only'), 'audit_report', 'r1', 'ada');
    expect(levels).toEqual([{ approverId: null, requiredPermission: 'report:approve:oversight' }]);
  });

  it('"Head and DG" is two steps', async () => {
    const levels = await service._resolveApproverChain(db('ada', 'ada', 'cae_and_dg'), 'audit_report', 'r1', 'ada');
    expect(levels.map((l: { requiredPermission: string }) => l.requiredPermission)).toEqual(['report:approve:oversight', 'report:approve:final']);
  });
});

describe('report approval for an audit with a team is unchanged', () => {
  it('still starts with the audit manager, pinned to them', async () => {
    const levels = await service._resolveApproverChain(db('ada', 'bola'), 'audit_report', 'r1', 'ada');
    expect(levels[0]).toEqual({ approverId: 'bola', requiredPermission: 'report:approve' });
    expect(levels).toHaveLength(3);
  });
});
