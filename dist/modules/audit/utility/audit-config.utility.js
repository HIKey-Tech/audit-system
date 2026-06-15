"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApprovalMatrix = exports.DEFAULT_APPROVAL_MATRIX = exports.ENGAGEMENT_MANAGER_APPROVER = exports.getChecklistTemplateControls = exports.getAuditSlaRules = exports.getAuditLifecycleRules = exports.DEFAULT_CHECKLIST_TEMPLATE_CONFIG = exports.DEFAULT_AUDIT_SLA_RULES = exports.DEFAULT_AUDIT_LIFECYCLE_RULES = void 0;
const prisma_client_1 = require("../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../shared/utils/logger.util");
const audit_utility_1 = require("./audit.utility");
exports.DEFAULT_AUDIT_LIFECYCLE_RULES = {
    requireAllChecklistsTestedBeforeUnderReview: true,
    requireApprovedWorkingPaperBeforeUnderReview: true,
    requireReportIssuedBeforeReported: true,
    requireClosedFindingsBeforeClose: true,
};
exports.DEFAULT_AUDIT_SLA_RULES = {
    defaultEngagementSlaDays: 30,
    defaultFindingDueDays: 90,
    highRiskFindingDueDays: 60,
    criticalFindingDueDays: 30,
};
exports.DEFAULT_CHECKLIST_TEMPLATE_CONFIG = audit_utility_1.CONTROL_SETS;
const getAuditLifecycleRules = async () => {
    const parsed = await getJsonConfig('audit_lifecycle_rules', {});
    return { ...exports.DEFAULT_AUDIT_LIFECYCLE_RULES, ...parsed };
};
exports.getAuditLifecycleRules = getAuditLifecycleRules;
const getAuditSlaRules = async () => {
    const parsed = await getJsonConfig('audit_sla_rules', {});
    return { ...exports.DEFAULT_AUDIT_SLA_RULES, ...parsed };
};
exports.getAuditSlaRules = getAuditSlaRules;
const getChecklistTemplateControls = async (auditType) => {
    const parsed = await getJsonConfig('checklist_templates', exports.DEFAULT_CHECKLIST_TEMPLATE_CONFIG);
    const controls = parsed[auditType];
    if (!Array.isArray(controls) || controls.length === 0) {
        return audit_utility_1.CONTROL_SETS[auditType] ?? [];
    }
    return controls
        .filter(isChecklistTemplateControl)
        .map((control) => ({
        controlReference: control.controlReference,
        controlDescription: control.controlDescription,
        testProcedure: control.testProcedure,
    }));
};
exports.getChecklistTemplateControls = getChecklistTemplateControls;
/**
 * Sentinel chain entry: resolve this level to the entity's assigned engagement
 * manager (a specific person) rather than to a permission holder.
 */
exports.ENGAGEMENT_MANAGER_APPROVER = 'engagement_manager';
exports.DEFAULT_APPROVAL_MATRIX = {
    auditPlan: ['plan:approve'],
    workingPaper: [exports.ENGAGEMENT_MANAGER_APPROVER],
    auditReport: [exports.ENGAGEMENT_MANAGER_APPROVER, 'report:approve:oversight', 'report:approve:final'],
};
/**
 * Reads the GBB-configurable approval matrix from system_config. Admins edit this
 * in Settings to control who signs off on plans, working papers, and reports — the
 * approval engine resolves each level to a permission holder (or the engagement
 * manager), never to a hardcoded role.
 */
const getApprovalMatrix = async () => {
    const parsed = await getJsonConfig('approval_matrix', {});
    return { ...exports.DEFAULT_APPROVAL_MATRIX, ...parsed };
};
exports.getApprovalMatrix = getApprovalMatrix;
const getJsonConfig = async (key, fallback) => {
    const config = await prisma_client_1.prisma.system_Config.findUnique({
        where: { key },
        select: { value: true },
    });
    if (!config?.value)
        return fallback;
    try {
        return JSON.parse(config.value);
    }
    catch (err) {
        logger_util_1.logger.warn('Invalid JSON system config; using fallback', { key, err });
        return fallback;
    }
};
const isChecklistTemplateControl = (value) => {
    if (!value || typeof value !== 'object')
        return false;
    const record = value;
    return typeof record.controlReference === 'string'
        && typeof record.controlDescription === 'string'
        && typeof record.testProcedure === 'string';
};
//# sourceMappingURL=audit-config.utility.js.map