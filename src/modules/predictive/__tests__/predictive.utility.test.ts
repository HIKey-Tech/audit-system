import {
  scoreEngagementDeliveryRisk,
  scoreEvidenceRequestDelayRisk,
  scoreFindingRemediationRisk,
} from '../utility/predictive.utility';

describe('predictive early-warning rules', () => {
  const now = new Date('2026-09-20T12:00:00.000Z');

  it('raises a high engagement warning when progress is behind and the SLA is close', () => {
    const result = scoreEngagementDeliveryRisk({
      status: 'in_progress',
      plannedStartDate: new Date('2026-09-01T00:00:00.000Z'),
      actualStartDate: null,
      slaDeadline: new Date('2026-09-23T00:00:00.000Z'),
      checklistTotal: 10,
      checklistTested: 2,
      workingPaperTotal: 2,
      workingPaperApproved: 0,
      openEvidenceRequests: 2,
      plannedHours: 40,
      actualHours: 38,
    }, now);

    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(['high', 'critical']).toContain(result.severity);
    expect(result.rationale.map((factor) => factor.code)).toEqual(expect.arrayContaining([
      'progress_behind_schedule',
      'sla_due_soon',
      'open_evidence_requests',
      'budget_nearly_exhausted',
    ]));
  });

  it('marks an overdue, unresponsive critical finding as critical attention', () => {
    const result = scoreFindingRemediationRisk({
      status: 'open',
      severity: 'critical',
      dueDate: new Date('2026-09-15T00:00:00.000Z'),
      hasManagementResponse: false,
      hasRemediationEvidence: false,
    }, now);

    expect(result.severity).toBe('critical');
    expect(result.rationale.map((factor) => factor.code)).toEqual(expect.arrayContaining([
      'remediation_overdue',
      'no_management_response',
      'finding_severity',
    ]));
  });

  it('does not invent an evidence-request warning without a due date', () => {
    expect(scoreEvidenceRequestDelayRisk({ dueDate: null, status: 'open' }, now)).toEqual({
      score: 0,
      severity: 'low',
      rationale: [],
    });
  });
});
