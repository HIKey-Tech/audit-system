// Resource-optimization helpers for staff assignment: skill matching, workload
// weighting and capacity rules. Kept as pure functions so the service stays
// stateless and the logic is unit-testable in isolation.

import { EngagementStatus } from '../../../audit/domain/enum/audit.enum';

/** Statuses that count as an auditor's *active* workload (not yet finished). */
export const ACTIVE_ENGAGEMENT_STATUSES: EngagementStatus[] = [
  EngagementStatus.Planned,
  EngagementStatus.InProgress,
  EngagementStatus.UnderReview,
];

/** Hard cap on concurrent overlapping engagements per auditor. */
export const MAX_CONCURRENT_ENGAGEMENTS = 5;

/** Workload at or above this is rendered as "heavy" (advisory only). */
export const HEAVY_WORKLOAD_THRESHOLD = 3;

/** Audit-type → relevant skill keywords. Multi-word entries match as a phrase;
 *  single words match a whole token so short keys like "ap"/"dr"/"it" don't
 *  produce false positives (e.g. "ap" inside "capacity"). */
const AUDIT_TYPE_KEYWORDS: Record<string, string[]> = {
  // `it` is the merged System/IT domain, so its keywords are the union of the
  // former IT and Systems domains. `systems` is kept as an alias so engagements
  // created before the merge still match the same auditors.
  it: ['it', 'cyber', 'security', 'iso 27001', 'iso27001', 'network', 'system', 'vulnerability', 'firewall', 'cloud', 'itgc', 'sast', 'systems', 'infrastructure', 'configuration', 'change', 'cab', 'disaster', 'dr', 'replication', 'capacity', 'performance'],
  financial: ['financial', 'finance', 'ap', 'ledger', 'reconciliation', 'maker', 'checker', 'asset', 'audit', 'tax'],
  compliance: ['compliance', 'regulation', 'standard', 'iso 9001', 'iso9001', 'iso 22301', 'iso22301', 'ndpr', 'privacy', 'dpo', 'policy', 'gdpr'],
};
AUDIT_TYPE_KEYWORDS.systems = AUDIT_TYPE_KEYWORDS.it;

const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const tokenize = (value: string): Set<string> =>
  new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

/** Whether a single skill is relevant to the given audit type. */
export const isRelevantSkill = (skill: string, auditType: string): boolean => {
  const keywords = AUDIT_TYPE_KEYWORDS[auditType.toLowerCase()] ?? [];
  const lower = skill.toLowerCase();
  const tokens = tokenize(skill);
  return keywords.some((kw) => (kw.includes(' ') ? lower.includes(kw) : tokens.has(kw)));
};

/** The subset of a candidate's skills relevant to the audit type. */
export const getMatchedSkills = (skills: string[], auditType: string): string[] =>
  skills.filter((s) => isRelevantSkill(s, auditType));

/** Skill-fit score: 2 points per matched skill. */
export const getSkillScore = (skills: string[], auditType: string): number =>
  getMatchedSkills(skills, auditType).length * 2;

export const priorityWeight = (priority: string): number =>
  PRIORITY_WEIGHT[priority.toLowerCase()] ?? PRIORITY_WEIGHT.medium;

/** Overall recommendation score. Skill fit dominates; workload breaks ties and
 *  is penalised more heavily for higher-priority engagements (so critical work
 *  prefers less-loaded auditors). Higher is better. */
export const getRecommendationScore = (
  skillScore: number,
  activeEngagementCount: number,
  priority: string,
): number => skillScore * 100 - activeEngagementCount * priorityWeight(priority);

/** Inclusive overlap test for two date ranges. */
export const rangesOverlap = (startA: Date, endA: Date, startB: Date, endB: Date): boolean =>
  startA <= endB && startB <= endA;
