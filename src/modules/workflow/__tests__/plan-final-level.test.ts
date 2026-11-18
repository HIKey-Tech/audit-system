jest.mock('../../../shared/prisma/prisma.client', () => ({ prisma: {} }));
jest.mock('../../audit/utility/audit-config.utility', () => ({
  getApprovalMatrix: jest.fn().mockResolvedValue({
    auditPlan: ['plan:approve', 'plan:approve:final'],
    auditReport: ['report:approve:oversight', 'report:approve:final'],
    workingPaper: [], findingClosure: [],
  }),
  ENGAGEMENT_MANAGER_APPROVER: 'engagement_manager',
}));

import { ApprovalService } from '../approval/service/implementation/approval.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = new (ApprovalService as any)();

/** A db where only the listed permissions have an active holder. */
const dbWithHolders = (held: string[]) => ({
  audit_Plan: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
  audit_Report: { findFirst: jest.fn().mockResolvedValue({ id: 'r1', sign_off_mode: 'cae_and_dg', engagement: { audit_manager_id: 'm1' } }) },
  user: {
    findFirst: jest.fn(async (args: { where: { user_roles?: unknown } }) => {
      const wanted = JSON.stringify(args.where);
      return held.some((p) => wanted.includes(`"${p}"`)) ? { id: 'someone' } : null;
    }),
  },
});

describe('programme approval chain when the DG has no account yet', () => {
  it('still builds both levels; the final one waits for whoever gets the DG permission', async () => {
    const db = dbWithHolders(['plan:approve']);
    const levels = await service._resolveApproverChain(db, 'audit_plan', 'p1', 'creator');
    expect(levels).toEqual([
      { approverId: null, requiredPermission: 'plan:approve' },
      { approverId: null, requiredPermission: 'plan:approve:final' },
    ]);
  });

  it('still insists that the first level (the Head) has someone to approve', async () => {
    const db = dbWithHolders([]);
    await expect(service._resolveApproverChain(db, 'audit_plan', 'p1', 'creator')).rejects.toThrow(/plan:approve/);
  });

  it('does not relax the rule for other entities such as reports', async () => {
    const db = dbWithHolders(['report:approve:oversight']);
    await expect(service._resolveApproverChain(db, 'audit_report', 'r1', 'creator')).rejects.toThrow(/report:approve:final/);
  });
});
