import { AuditFrequency, AuditPriority } from '../../domain/enum/audit.enum';
import { PlanningRecommendationDto } from '../service/interface/planning.service.interface';

/** Months per periodic audit-frequency value; `on_demand` has no recurring cycle. */
export const FREQUENCY_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
};

export type UniverseDueStatus = 'overdue' | 'never_audited' | 'due_in_year' | 'on_track' | 'on_demand';

export interface PlanningPriorityWeights {
  riskScore: number;
  openFindings: number;
  overdueForAudit: number;
  neverAudited: number;
  timeSinceLastAudit: number;
}

export const monthsSince = (date: Date, now: Date): number =>
  (now.getTime() - date.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

export const recommendedPriorityFromRiskScore = (riskScore: number | null | undefined): AuditPriority => {
  const score = riskScore ?? 0;
  if (score >= 20) return AuditPriority.Critical;
  if (score >= 13) return AuditPriority.High;
  if (score >= 6) return AuditPriority.Medium;
  return AuditPriority.Low;
};

/**
 * Classifies whether a universe entity is due for audit within `targetYear`.
 * `on_demand` entities are event-driven and never flagged as overdue or never-audited.
 */
export const classifyUniverseDueStatus = (
  auditFrequency: string,
  lastAuditedAt: Date | null,
  targetYear: number,
  now: Date = new Date(),
): UniverseDueStatus => {
  if (auditFrequency === AuditFrequency.OnDemand) return 'on_demand';
  const frequencyMonths = FREQUENCY_MONTHS[auditFrequency];
  if (!frequencyMonths) return 'on_demand';
  if (!lastAuditedAt) return 'never_audited';

  const elapsedMonths = monthsSince(lastAuditedAt, now);
  if (elapsedMonths > frequencyMonths) return 'overdue';

  const nextDue = new Date(lastAuditedAt);
  nextDue.setUTCMonth(nextDue.getUTCMonth() + frequencyMonths);
  if (nextDue.getUTCFullYear() <= targetYear) return 'due_in_year';

  return 'on_track';
};

export const computeEntityRecommendation = (
  entity: {
    id: string;
    name: string;
    category: string;
    riskScore: number;
    auditFrequency: string;
    lastAuditedAt: Date | null;
  },
  openCount: number,
  weights: PlanningPriorityWeights,
  now: Date = new Date(),
): PlanningRecommendationDto => {
  const isOnDemand = entity.auditFrequency === AuditFrequency.OnDemand;
  const frequencyMonths = isOnDemand ? undefined : FREQUENCY_MONTHS[entity.auditFrequency];
  const monthsSinceAudit = entity.lastAuditedAt ? monthsSince(entity.lastAuditedAt, now) : null;
  const overdue =
    !isOnDemand &&
    monthsSinceAudit !== null &&
    frequencyMonths !== undefined &&
    monthsSinceAudit > frequencyMonths;

  const components = {
    riskScore: Math.min((entity.riskScore / 25) * 100, 100),
    openFindings: Math.min(openCount * 25, 100),
    overdueForAudit: overdue ? 100 : 0,
    // On-demand entities are audited only when triggered, never penalized as never-audited/stale.
    neverAudited: !isOnDemand && entity.lastAuditedAt === null ? 100 : 0,
    timeSinceLastAudit: isOnDemand
      ? 0
      : monthsSinceAudit === null
        ? 100
        : Math.min((monthsSinceAudit / 24) * 100, 100),
  };

  const weightSum =
    weights.riskScore +
    weights.openFindings +
    weights.overdueForAudit +
    weights.neverAudited +
    weights.timeSinceLastAudit;

  const score =
    weightSum <= 0
      ? 0
      : (weights.riskScore * components.riskScore +
          weights.openFindings * components.openFindings +
          weights.overdueForAudit * components.overdueForAudit +
          weights.neverAudited * components.neverAudited +
          weights.timeSinceLastAudit * components.timeSinceLastAudit) /
        weightSum;

  const reasons: string[] = [];
  if (entity.riskScore >= 13) reasons.push(`High risk score (${entity.riskScore})`);
  if (openCount > 0) reasons.push(`${openCount} unresolved finding${openCount === 1 ? '' : 's'}`);
  if (!isOnDemand) {
    if (entity.lastAuditedAt === null) reasons.push('Never audited');
    else if (overdue) reasons.push(`Audit overdue (${entity.auditFrequency} cycle)`);
    else if (monthsSinceAudit !== null && monthsSinceAudit >= 12) {
      reasons.push(`Last audited ${Math.floor(monthsSinceAudit)} months ago`);
    }
  }

  return {
    universeId: entity.id,
    name: entity.name,
    category: entity.category,
    riskScore: entity.riskScore,
    auditFrequency: entity.auditFrequency,
    lastAuditedAt: entity.lastAuditedAt?.toISOString() ?? null,
    openFindingsCount: openCount,
    score: Math.round(score),
    components: {
      riskScore: Math.round(components.riskScore),
      openFindings: Math.round(components.openFindings),
      overdueForAudit: components.overdueForAudit,
      neverAudited: components.neverAudited,
      timeSinceLastAudit: Math.round(components.timeSinceLastAudit),
    },
    reasons,
  };
};
