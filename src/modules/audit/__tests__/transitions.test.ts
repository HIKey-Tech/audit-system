import {
  assertTransition,
  ENGAGEMENT_TRANSITIONS,
  FINDING_TRANSITIONS,
} from '../utility/audit.utility';
import { EngagementStatus, FindingStatus } from '../domain/enum/audit.enum';

describe('lifecycle state machines', () => {
  describe('finding transitions', () => {
    it('allows the forward remediation path', () => {
      expect(() =>
        assertTransition(FindingStatus.Open, FindingStatus.ManagementResponseReceived, FINDING_TRANSITIONS, 'finding'),
      ).not.toThrow();
      expect(() =>
        assertTransition(FindingStatus.ManagementResponseReceived, FindingStatus.InRemediation, FINDING_TRANSITIONS, 'finding'),
      ).not.toThrow();
      expect(() =>
        assertTransition(FindingStatus.InRemediation, FindingStatus.Verified, FINDING_TRANSITIONS, 'finding'),
      ).not.toThrow();
    });

    it('rejects skipping remediation (open → verified)', () => {
      expect(() =>
        assertTransition(FindingStatus.Open, FindingStatus.Verified, FINDING_TRANSITIONS, 'finding'),
      ).toThrow('Invalid finding status transition');
    });

    it('rejects reopening a closed finding', () => {
      expect(() =>
        assertTransition(FindingStatus.Closed, FindingStatus.Open, FINDING_TRANSITIONS, 'finding'),
      ).toThrow('Invalid finding status transition');
    });

    it('rejects verifying without a management response', () => {
      expect(() =>
        assertTransition(FindingStatus.Open, FindingStatus.InRemediation, FINDING_TRANSITIONS, 'finding'),
      ).toThrow('Invalid finding status transition');
    });
  });

  describe('engagement transitions', () => {
    it('allows planned → in_progress → under_review → reported → closed', () => {
      const path: EngagementStatus[] = [
        EngagementStatus.Planned,
        EngagementStatus.InProgress,
        EngagementStatus.UnderReview,
        EngagementStatus.Reported,
        EngagementStatus.Closed,
      ];
      for (let i = 0; i < path.length - 1; i += 1) {
        expect(() => assertTransition(path[i], path[i + 1], ENGAGEMENT_TRANSITIONS, 'engagement')).not.toThrow();
      }
    });

    it('rejects closing an engagement straight from planned', () => {
      expect(() =>
        assertTransition(EngagementStatus.Planned, EngagementStatus.Closed, ENGAGEMENT_TRANSITIONS, 'engagement'),
      ).toThrow('Invalid engagement status transition');
    });

    it('rejects moving backwards (reported → in_progress)', () => {
      expect(() =>
        assertTransition(EngagementStatus.Reported, EngagementStatus.InProgress, ENGAGEMENT_TRANSITIONS, 'engagement'),
      ).toThrow('Invalid engagement status transition');
    });
  });
});
