"use strict";
// Resource-optimization helpers for staff assignment: skill matching, workload
// weighting and capacity rules. Kept as pure functions so the service stays
// stateless and the logic is unit-testable in isolation.
Object.defineProperty(exports, "__esModule", { value: true });
exports.rangesOverlap = exports.getRecommendationScore = exports.priorityWeight = exports.getSkillScore = exports.getMatchedSkills = exports.isRelevantSkill = exports.HEAVY_WORKLOAD_THRESHOLD = exports.MAX_CONCURRENT_ENGAGEMENTS = exports.ACTIVE_ENGAGEMENT_STATUSES = void 0;
const audit_enum_1 = require("../../../audit/domain/enum/audit.enum");
/** Statuses that count as an auditor's *active* workload (not yet finished). */
exports.ACTIVE_ENGAGEMENT_STATUSES = [
    audit_enum_1.EngagementStatus.Planned,
    audit_enum_1.EngagementStatus.InProgress,
    audit_enum_1.EngagementStatus.UnderReview,
];
/** Hard cap on concurrent overlapping engagements per auditor. */
exports.MAX_CONCURRENT_ENGAGEMENTS = 5;
/** Workload at or above this is rendered as "heavy" (advisory only). */
exports.HEAVY_WORKLOAD_THRESHOLD = 3;
/** Audit-type → relevant skill keywords. Multi-word entries match as a phrase;
 *  single words match a whole token so short keys like "ap"/"dr"/"it" don't
 *  produce false positives (e.g. "ap" inside "capacity"). */
const AUDIT_TYPE_KEYWORDS = {
    it: ['it', 'cyber', 'security', 'iso 27001', 'iso27001', 'network', 'system', 'vulnerability', 'firewall', 'cloud', 'itgc', 'sast'],
    financial: ['financial', 'finance', 'ap', 'ledger', 'reconciliation', 'maker', 'checker', 'asset', 'audit', 'tax'],
    compliance: ['compliance', 'regulation', 'standard', 'iso 9001', 'iso9001', 'iso 22301', 'iso22301', 'ndpr', 'privacy', 'dpo', 'policy', 'gdpr'],
    systems: ['systems', 'infrastructure', 'configuration', 'change', 'cab', 'disaster', 'dr', 'replication', 'capacity', 'performance'],
};
const PRIORITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };
const tokenize = (value) => new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
/** Whether a single skill is relevant to the given audit type. */
const isRelevantSkill = (skill, auditType) => {
    const keywords = AUDIT_TYPE_KEYWORDS[auditType.toLowerCase()] ?? [];
    const lower = skill.toLowerCase();
    const tokens = tokenize(skill);
    return keywords.some((kw) => (kw.includes(' ') ? lower.includes(kw) : tokens.has(kw)));
};
exports.isRelevantSkill = isRelevantSkill;
/** The subset of a candidate's skills relevant to the audit type. */
const getMatchedSkills = (skills, auditType) => skills.filter((s) => (0, exports.isRelevantSkill)(s, auditType));
exports.getMatchedSkills = getMatchedSkills;
/** Skill-fit score: 2 points per matched skill. */
const getSkillScore = (skills, auditType) => (0, exports.getMatchedSkills)(skills, auditType).length * 2;
exports.getSkillScore = getSkillScore;
const priorityWeight = (priority) => PRIORITY_WEIGHT[priority.toLowerCase()] ?? PRIORITY_WEIGHT.medium;
exports.priorityWeight = priorityWeight;
/** Overall recommendation score. Skill fit dominates; workload breaks ties and
 *  is penalised more heavily for higher-priority engagements (so critical work
 *  prefers less-loaded auditors). Higher is better. */
const getRecommendationScore = (skillScore, activeEngagementCount, priority) => skillScore * 100 - activeEngagementCount * (0, exports.priorityWeight)(priority);
exports.getRecommendationScore = getRecommendationScore;
/** Inclusive overlap test for two date ranges. */
const rangesOverlap = (startA, endA, startB, endB) => startA <= endB && startB <= endA;
exports.rangesOverlap = rangesOverlap;
//# sourceMappingURL=assignment-matching.util.js.map