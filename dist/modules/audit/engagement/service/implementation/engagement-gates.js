"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canClose = exports.canEnterReported = exports.canEnterUnderReview = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_config_utility_1 = require("../../../utility/audit-config.utility");
/** True when an in_progress engagement satisfies every gate to enter under_review. */
const canEnterUnderReview = async (engagementId) => {
    const rules = await (0, audit_config_utility_1.getAuditLifecycleRules)();
    if (rules.requireAllChecklistsTestedBeforeUnderReview) {
        const [total, notTested] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Checklist.count({ where: { engagement_id: engagementId } }),
            prisma_client_1.prisma.audit_Checklist.count({ where: { engagement_id: engagementId, result: 'not_tested' } }),
        ]);
        if (total === 0 || notTested > 0)
            return false;
    }
    if (rules.requireApprovedWorkingPaperBeforeUnderReview) {
        const [totalPapers, unapproved] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null } }),
            prisma_client_1.prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null, status: { not: 'approved' } } }),
        ]);
        if (totalPapers === 0 || unapproved > 0)
            return false;
    }
    return true;
};
exports.canEnterUnderReview = canEnterUnderReview;
/** True when an under_review engagement has an issued report (the deliberate human act). */
const canEnterReported = async (engagementId) => {
    const rules = await (0, audit_config_utility_1.getAuditLifecycleRules)();
    if (!rules.requireReportIssuedBeforeReported)
        return true;
    const issued = await prisma_client_1.prisma.audit_Report.count({
        where: { engagement_id: engagementId, deleted_at: null, status: 'issued' },
    });
    return issued > 0;
};
exports.canEnterReported = canEnterReported;
/** True when a reported engagement has no findings left open/awaiting closure. */
const canClose = async (engagementId) => {
    const rules = await (0, audit_config_utility_1.getAuditLifecycleRules)();
    if (!rules.requireClosedFindingsBeforeClose)
        return true;
    const open = await prisma_client_1.prisma.audit_Finding.count({
        where: { engagement_id: engagementId, deleted_at: null, status: { not: audit_enum_1.FindingStatus.Closed } },
    });
    return open === 0;
};
exports.canClose = canClose;
//# sourceMappingURL=engagement-gates.js.map