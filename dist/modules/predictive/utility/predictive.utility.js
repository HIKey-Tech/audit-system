"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreEvidenceRequestDelayRisk = exports.scoreFindingRemediationRisk = exports.scoreEngagementDeliveryRisk = exports.severityForScore = void 0;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const daysBetween = (from, to) => Math.floor((to.getTime() - from.getTime()) / 86_400_000);
const severityForScore = (score) => {
    if (score >= 75)
        return 'critical';
    if (score >= 55)
        return 'high';
    if (score >= 35)
        return 'medium';
    return 'low';
};
exports.severityForScore = severityForScore;
/**
 * Produces an explainable delivery-risk score from live workflow state. It is
 * intentionally a rules score rather than an asserted statistical probability;
 * the later model can be evaluated against the snapshots/outcomes it creates.
 */
const scoreEngagementDeliveryRisk = (input, now) => {
    const rationale = [];
    let score = 0;
    const start = input.actualStartDate ?? input.plannedStartDate;
    const totalScheduleDays = Math.max(1, daysBetween(start, input.slaDeadline));
    const elapsedRatio = clamp(daysBetween(start, now) / totalScheduleDays, 0, 1.5);
    const checklistProgress = input.checklistTotal === 0
        ? 1
        : input.checklistTested / input.checklistTotal;
    const paperProgress = input.workingPaperTotal === 0
        ? 1
        : input.workingPaperApproved / input.workingPaperTotal;
    const completionRatio = (checklistProgress * 0.7) + (paperProgress * 0.3);
    const progressGap = elapsedRatio - completionRatio;
    const daysToDeadline = daysBetween(now, input.slaDeadline);
    if (progressGap >= 0.15) {
        const weight = Math.round(clamp(progressGap * 70, 12, 38));
        score += weight;
        rationale.push({
            code: 'progress_behind_schedule',
            label: 'Work is behind the expected schedule progress',
            value: `${Math.round(completionRatio * 100)}% complete after ${Math.round(clamp(elapsedRatio, 0, 1) * 100)}% of the available time`,
            weight,
        });
    }
    if (daysToDeadline < 0) {
        const weight = Math.min(28, 18 + Math.abs(daysToDeadline));
        score += weight;
        rationale.push({
            code: 'sla_overdue',
            label: 'SLA deadline has passed',
            value: `${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) === 1 ? '' : 's'} overdue`,
            weight,
        });
    }
    else if (daysToDeadline <= 7) {
        score += 18;
        rationale.push({
            code: 'sla_due_soon',
            label: 'SLA deadline is close',
            value: `Due in ${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'}`,
            weight: 18,
        });
    }
    else if (daysToDeadline <= 21) {
        score += 8;
        rationale.push({
            code: 'sla_approaching',
            label: 'SLA deadline is approaching',
            value: `Due in ${daysToDeadline} days`,
            weight: 8,
        });
    }
    if (input.openEvidenceRequests > 0) {
        const weight = Math.min(18, input.openEvidenceRequests * 5);
        score += weight;
        rationale.push({
            code: 'open_evidence_requests',
            label: 'Evidence is still outstanding',
            value: `${input.openEvidenceRequests} open evidence request${input.openEvidenceRequests === 1 ? '' : 's'}`,
            weight,
        });
    }
    if (input.plannedHours && input.plannedHours > 0) {
        const hoursRatio = input.actualHours / input.plannedHours;
        if (hoursRatio >= 1) {
            score += 18;
            rationale.push({
                code: 'over_budget',
                label: 'Budgeted engagement hours are exhausted',
                value: `${Math.round(hoursRatio * 100)}% of budget used`,
                weight: 18,
            });
        }
        else if (hoursRatio >= 0.85) {
            score += 8;
            rationale.push({
                code: 'budget_nearly_exhausted',
                label: 'Budgeted engagement hours are nearly exhausted',
                value: `${Math.round(hoursRatio * 100)}% of budget used`,
                weight: 8,
            });
        }
    }
    return { score: clamp(Math.round(score), 0, 100), severity: (0, exports.severityForScore)(score), rationale };
};
exports.scoreEngagementDeliveryRisk = scoreEngagementDeliveryRisk;
const scoreFindingRemediationRisk = (input, now) => {
    const rationale = [];
    const daysToDeadline = daysBetween(now, input.dueDate);
    let score = 0;
    if (daysToDeadline < 0) {
        const weight = Math.min(72, 55 + Math.abs(daysToDeadline));
        score += weight;
        rationale.push({
            code: 'remediation_overdue',
            label: 'Remediation due date has passed',
            value: `${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) === 1 ? '' : 's'} overdue`,
            weight,
        });
    }
    else if (daysToDeadline <= 7) {
        score += 38;
        rationale.push({
            code: 'remediation_due_soon',
            label: 'Remediation due date is close',
            value: `Due in ${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'}`,
            weight: 38,
        });
    }
    else if (daysToDeadline <= 30) {
        score += 18;
        rationale.push({
            code: 'remediation_approaching',
            label: 'Remediation due date is approaching',
            value: `Due in ${daysToDeadline} days`,
            weight: 18,
        });
    }
    if (!input.hasManagementResponse) {
        score += 18;
        rationale.push({
            code: 'no_management_response',
            label: 'Management response is still outstanding',
            value: 'No response has been submitted',
            weight: 18,
        });
    }
    if (input.status === 'in_remediation' && !input.hasRemediationEvidence) {
        score += 10;
        rationale.push({
            code: 'no_remediation_evidence',
            label: 'Remediation has no verification evidence',
            value: 'Evidence has not been uploaded',
            weight: 10,
        });
    }
    const severityWeight = { critical: 15, high: 10, medium: 5 };
    const weight = severityWeight[input.severity] ?? 0;
    if (weight > 0) {
        score += weight;
        rationale.push({
            code: 'finding_severity',
            label: 'Finding severity increases attention needed',
            value: `${input.severity} severity`,
            weight,
        });
    }
    return { score: clamp(Math.round(score), 0, 100), severity: (0, exports.severityForScore)(score), rationale };
};
exports.scoreFindingRemediationRisk = scoreFindingRemediationRisk;
const scoreEvidenceRequestDelayRisk = (input, now) => {
    if (!input.dueDate) {
        return { score: 0, severity: 'low', rationale: [] };
    }
    const daysToDeadline = daysBetween(now, input.dueDate);
    const rationale = [];
    let score = 0;
    if (daysToDeadline < 0) {
        const weight = Math.min(80, 60 + Math.abs(daysToDeadline));
        score += weight;
        rationale.push({
            code: 'evidence_request_overdue',
            label: 'Evidence request is overdue',
            value: `${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) === 1 ? '' : 's'} overdue`,
            weight,
        });
    }
    else if (daysToDeadline <= 7) {
        score += 42;
        rationale.push({
            code: 'evidence_request_due_soon',
            label: 'Evidence request is due soon',
            value: `Due in ${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'}`,
            weight: 42,
        });
    }
    else if (daysToDeadline <= 21) {
        score += 20;
        rationale.push({
            code: 'evidence_request_approaching',
            label: 'Evidence request deadline is approaching',
            value: `Due in ${daysToDeadline} days`,
            weight: 20,
        });
    }
    if (input.status === 'open') {
        score += 8;
        rationale.push({
            code: 'evidence_not_submitted',
            label: 'Requested evidence has not been submitted',
            value: 'Request remains open',
            weight: 8,
        });
    }
    return { score: clamp(Math.round(score), 0, 100), severity: (0, exports.severityForScore)(score), rationale };
};
exports.scoreEvidenceRequestDelayRisk = scoreEvidenceRequestDelayRisk;
//# sourceMappingURL=predictive.utility.js.map