import { AuditPriority } from '../../domain/enum/audit.enum';
import { PlanningRecommendationDto } from '../service/interface/planning.service.interface';
/** Months per periodic audit-frequency value; `on_demand` has no recurring cycle. */
export declare const FREQUENCY_MONTHS: Record<string, number>;
export type UniverseDueStatus = 'overdue' | 'never_audited' | 'due_in_year' | 'on_track' | 'on_demand';
export interface PlanningPriorityWeights {
    riskScore: number;
    openFindings: number;
    overdueForAudit: number;
    neverAudited: number;
    timeSinceLastAudit: number;
}
export declare const monthsSince: (date: Date, now: Date) => number;
export declare const recommendedPriorityFromRiskScore: (riskScore: number | null | undefined) => AuditPriority;
/**
 * Classifies whether a universe entity is due for audit within `targetYear`.
 * `on_demand` entities are event-driven and never flagged as overdue or never-audited.
 */
export declare const classifyUniverseDueStatus: (auditFrequency: string, lastAuditedAt: Date | null, targetYear: number, now?: Date) => UniverseDueStatus;
export declare const computeEntityRecommendation: (entity: {
    id: string;
    name: string;
    category: string;
    riskScore: number;
    auditFrequency: string;
    lastAuditedAt: Date | null;
}, openCount: number, weights: PlanningPriorityWeights, now?: Date) => PlanningRecommendationDto;
//# sourceMappingURL=planning.utility.d.ts.map