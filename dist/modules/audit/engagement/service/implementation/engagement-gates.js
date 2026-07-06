"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEngagementGateStatus = exports.canClose = exports.canEnterReported = exports.canEnterUnderReview = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_config_utility_1 = require("../../../utility/audit-config.utility");
/** True when an in_progress engagement satisfies every gate to enter under_review. */
const canEnterUnderReview = async (engagementId) => {
    const rules = await (0, audit_config_utility_1.getAuditLifecycleRules)();
    const unmet = [];
    if (rules.requireAllChecklistsTestedBeforeUnderReview) {
        const [total, notTested] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Checklist.count({ where: { engagement_id: engagementId } }),
            prisma_client_1.prisma.audit_Checklist.count({ where: { engagement_id: engagementId, result: 'not_tested' } }),
        ]);
        if (total === 0) {
            unmet.push('No checklist items have been created yet');
        }
        else if (notTested > 0) {
            unmet.push(`${notTested} of ${total} checklist item${total === 1 ? '' : 's'} not yet tested`);
        }
    }
    if (rules.requireApprovedWorkingPaperBeforeUnderReview) {
        const [totalPapers, unapproved] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null } }),
            prisma_client_1.prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null, status: { not: 'approved' } } }),
        ]);
        if (totalPapers === 0) {
            unmet.push('No working papers have been created yet');
        }
        else if (unapproved > 0) {
            unmet.push(`${unapproved} of ${totalPapers} working paper${totalPapers === 1 ? '' : 's'} not yet approved`);
        }
    }
    return { met: unmet.length === 0, unmet };
};
exports.canEnterUnderReview = canEnterUnderReview;
/** True when an under_review engagement has an issued report (the deliberate human act). */
const canEnterReported = async (engagementId) => {
    const rules = await (0, audit_config_utility_1.getAuditLifecycleRules)();
    if (!rules.requireReportIssuedBeforeReported)
        return { met: true, unmet: [] };
    const issued = await prisma_client_1.prisma.audit_Report.count({
        where: { engagement_id: engagementId, deleted_at: null, status: 'issued' },
    });
    if (issued > 0)
        return { met: true, unmet: [] };
    return { met: false, unmet: ['Report has not been issued yet'] };
};
exports.canEnterReported = canEnterReported;
/** True when a reported engagement has no findings left open/awaiting closure. */
const canClose = async (engagementId) => {
    const rules = await (0, audit_config_utility_1.getAuditLifecycleRules)();
    if (!rules.requireClosedFindingsBeforeClose)
        return { met: true, unmet: [] };
    const open = await prisma_client_1.prisma.audit_Finding.count({
        where: { engagement_id: engagementId, deleted_at: null, status: { not: audit_enum_1.FindingStatus.Closed } },
    });
    if (open === 0)
        return { met: true, unmet: [] };
    return { met: false, unmet: [`${open} finding${open === 1 ? '' : 's'} not yet closed`] };
};
exports.canClose = canClose;
/** Resolve which gate applies to the engagement's current status and return its
 * result, for surfacing "why hasn't this advanced" in the UI. Returns null for
 * statuses with no forward gate (planned, closed). */
const getEngagementGateStatus = async (engagementId, status) => {
    if (status === audit_enum_1.EngagementStatus.InProgress)
        return (0, exports.canEnterUnderReview)(engagementId);
    if (status === audit_enum_1.EngagementStatus.UnderReview)
        return (0, exports.canEnterReported)(engagementId);
    if (status === audit_enum_1.EngagementStatus.Reported)
        return (0, exports.canClose)(engagementId);
    return null;
};
exports.getEngagementGateStatus = getEngagementGateStatus;
//# sourceMappingURL=engagement-gates.js.map