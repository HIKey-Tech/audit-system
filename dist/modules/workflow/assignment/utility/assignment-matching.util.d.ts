import { EngagementStatus } from '../../../audit/domain/enum/audit.enum';
/** Statuses that count as an auditor's *active* workload (not yet finished). */
export declare const ACTIVE_ENGAGEMENT_STATUSES: EngagementStatus[];
/** Hard cap on concurrent overlapping engagements per auditor. */
export declare const MAX_CONCURRENT_ENGAGEMENTS = 5;
/** Workload at or above this is rendered as "heavy" (advisory only). */
export declare const HEAVY_WORKLOAD_THRESHOLD = 3;
/** Whether a single skill is relevant to the given audit type. */
export declare const isRelevantSkill: (skill: string, auditType: string) => boolean;
/** The subset of a candidate's skills relevant to the audit type. */
export declare const getMatchedSkills: (skills: string[], auditType: string) => string[];
/** Skill-fit score: 2 points per matched skill. */
export declare const getSkillScore: (skills: string[], auditType: string) => number;
export declare const priorityWeight: (priority: string) => number;
/** Overall recommendation score. Skill fit dominates; workload breaks ties and
 *  is penalised more heavily for higher-priority engagements (so critical work
 *  prefers less-loaded auditors). Higher is better. */
export declare const getRecommendationScore: (skillScore: number, activeEngagementCount: number, priority: string) => number;
/** Inclusive overlap test for two date ranges. */
export declare const rangesOverlap: (startA: Date, endA: Date, startB: Date, endB: Date) => boolean;
//# sourceMappingURL=assignment-matching.util.d.ts.map