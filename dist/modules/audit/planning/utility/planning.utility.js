"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeEntityRecommendation = exports.classifyUniverseDueStatus = exports.recommendedPriorityFromRiskScore = exports.monthsSince = exports.FREQUENCY_MONTHS = void 0;
const audit_enum_1 = require("../../domain/enum/audit.enum");
/** Months per periodic audit-frequency value; `on_demand` has no recurring cycle. */
exports.FREQUENCY_MONTHS = {
    monthly: 1,
    quarterly: 3,
    biannual: 6,
    annual: 12,
};
const monthsSince = (date, now) => (now.getTime() - date.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
exports.monthsSince = monthsSince;
const recommendedPriorityFromRiskScore = (riskScore) => {
    const score = riskScore ?? 0;
    if (score >= 20)
        return audit_enum_1.AuditPriority.Critical;
    if (score >= 13)
        return audit_enum_1.AuditPriority.High;
    if (score >= 6)
        return audit_enum_1.AuditPriority.Medium;
    return audit_enum_1.AuditPriority.Low;
};
exports.recommendedPriorityFromRiskScore = recommendedPriorityFromRiskScore;
/**
 * Classifies whether a universe entity is due for audit within `targetYear`.
 * `on_demand` entities are event-driven and never flagged as overdue or never-audited.
 */
const classifyUniverseDueStatus = (auditFrequency, lastAuditedAt, targetYear, now = new Date()) => {
    if (auditFrequency === audit_enum_1.AuditFrequency.OnDemand)
        return 'on_demand';
    const frequencyMonths = exports.FREQUENCY_MONTHS[auditFrequency];
    if (!frequencyMonths)
        return 'on_demand';
    if (!lastAuditedAt)
        return 'never_audited';
    const elapsedMonths = (0, exports.monthsSince)(lastAuditedAt, now);
    if (elapsedMonths > frequencyMonths)
        return 'overdue';
    const nextDue = new Date(lastAuditedAt);
    nextDue.setUTCMonth(nextDue.getUTCMonth() + frequencyMonths);
    if (nextDue.getUTCFullYear() <= targetYear)
        return 'due_in_year';
    return 'on_track';
};
exports.classifyUniverseDueStatus = classifyUniverseDueStatus;
const computeEntityRecommendation = (entity, openCount, weights, now = new Date()) => {
    const isOnDemand = entity.auditFrequency === audit_enum_1.AuditFrequency.OnDemand;
    const frequencyMonths = isOnDemand ? undefined : exports.FREQUENCY_MONTHS[entity.auditFrequency];
    const monthsSinceAudit = entity.lastAuditedAt ? (0, exports.monthsSince)(entity.lastAuditedAt, now) : null;
    const overdue = !isOnDemand &&
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
    const weightSum = weights.riskScore +
        weights.openFindings +
        weights.overdueForAudit +
        weights.neverAudited +
        weights.timeSinceLastAudit;
    const score = weightSum <= 0
        ? 0
        : (weights.riskScore * components.riskScore +
            weights.openFindings * components.openFindings +
            weights.overdueForAudit * components.overdueForAudit +
            weights.neverAudited * components.neverAudited +
            weights.timeSinceLastAudit * components.timeSinceLastAudit) /
            weightSum;
    const reasons = [];
    if (entity.riskScore >= 13)
        reasons.push(`High risk score (${entity.riskScore})`);
    if (openCount > 0)
        reasons.push(`${openCount} unresolved finding${openCount === 1 ? '' : 's'}`);
    if (!isOnDemand) {
        if (entity.lastAuditedAt === null)
            reasons.push('Never audited');
        else if (overdue)
            reasons.push(`Audit overdue (${entity.auditFrequency} cycle)`);
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
exports.computeEntityRecommendation = computeEntityRecommendation;
//# sourceMappingURL=planning.utility.js.map