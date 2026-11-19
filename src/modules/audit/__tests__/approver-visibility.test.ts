const mockStepFindMany = jest.fn();
const mockReportFindMany = jest.fn();
const mockAssignmentFindFirst = jest.fn();
jest.mock('../../../shared/prisma/prisma.client', () => ({
  prisma: {
    workflow_Approval_Step: { findMany: (...a: unknown[]) => mockStepFindMany(...a) },
    audit_Report: { findMany: (...a: unknown[]) => mockReportFindMany(...a) },
    workflow_Assignment: { findFirst: (...a: unknown[]) => mockAssignmentFindFirst(...a) },
  },
}));

import { approverEngagementIds, resolveViewerContext } from '../engagement/utility/engagement-visibility.util';

const dg = { id: 'dg', permissions: ['report:approve:final', 'report:read'] } as never;
const parties = { lead_auditor_id: 'ada', audit_manager_id: 'ada', auditee_id: 'chidi' };

beforeEach(() => {
  jest.clearAllMocks();
  mockAssignmentFindFirst.mockResolvedValue(null);
});

describe('the audit sent to the DG to sign', () => {
  it('opens up once the report is at the DG’s level', async () => {
    mockStepFindMany.mockResolvedValue([{ level: 2, approver_id: null, approval: { entity_id: 'r1', current_level: 2 } }]);
    mockReportFindMany.mockResolvedValue([{ engagement_id: 'e1' }]);
    expect(await approverEngagementIds(dg)).toEqual(['e1']);
    const ctx = await resolveViewerContext('e1', parties, dg);
    expect(ctx.canViewWorkingPapers && ctx.canViewChecklists && ctx.canViewInternalEvidence && ctx.canViewReports).toBe(true);
  });

  it('stays closed while the report is still with the Head (the DG’s step is not current yet)', async () => {
    mockStepFindMany.mockResolvedValue([{ level: 2, approver_id: null, approval: { entity_id: 'r1', current_level: 1 } }]);
    expect(await approverEngagementIds(dg)).toEqual([]);
    expect((await resolveViewerContext('e1', parties, dg)).canViewWorkingPapers).toBe(false);
  });

  it('stays open after the DG has signed it', async () => {
    mockStepFindMany.mockResolvedValue([{ level: 2, approver_id: 'dg', approval: { entity_id: 'r1', current_level: 2 } }]);
    mockReportFindMany.mockResolvedValue([{ engagement_id: 'e1' }]);
    expect((await resolveViewerContext('e1', parties, dg)).canViewWorkingPapers).toBe(true);
  });

  it('does not open a different audit', async () => {
    mockStepFindMany.mockResolvedValue([{ level: 2, approver_id: null, approval: { entity_id: 'r1', current_level: 2 } }]);
    mockReportFindMany.mockResolvedValue([{ engagement_id: 'e1' }]);
    expect((await resolveViewerContext('e2', parties, dg)).canViewWorkingPapers).toBe(false);
  });
});
