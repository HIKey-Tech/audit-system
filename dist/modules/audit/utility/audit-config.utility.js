"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseChecklistTemplateSnapshot = exports.serializeChecklistControls = exports.getPlanningPriorityWeights = exports.DEFAULT_PLANNING_PRIORITY_WEIGHTS = exports.getApprovalMatrix = exports.DEFAULT_APPROVAL_MATRIX = exports.ENGAGEMENT_MANAGER_APPROVER = exports.setChecklistTemplateConfig = exports.getChecklistTemplateConfig = exports.CHECKLIST_TEMPLATE_CONFIG_KEY = exports.getEngagementControls = exports.getChecklistTemplateControls = exports.getAuditSlaRules = exports.getAuditLifecycleRules = exports.DEFAULT_CHECKLIST_TEMPLATE_CONFIG = exports.DEFAULT_AUDIT_SLA_RULES = exports.DEFAULT_AUDIT_LIFECYCLE_RULES = void 0;
const prisma_client_1 = require("../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../shared/utils/logger.util");
const audit_enum_1 = require("../domain/enum/audit.enum");
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
 * Authoritative control source for populating an engagement's checklist.
 *
 * Prefers the structured compliance_controls library (active controls for the
 * audit type); falls back to the legacy checklist_templates JSON / built-in
 * CONTROL_SETS when the library has no controls for that type. Callers still
 * snapshot the returned text onto the checklist row, so a populated engagement
 * is unaffected by later edits to the library.
 */
const getEngagementControls = async (auditType) => {
    const dbControls = await prisma_client_1.prisma.compliance_Control.findMany({
        where: { audit_type: auditType, is_active: true, deleted_at: null },
        orderBy: { control_reference: 'asc' },
        select: { control_reference: true, control_description: true, test_procedure: true },
    });
    if (dbControls.length > 0) {
        return dbControls.map((control) => ({
            controlReference: control.control_reference,
            controlDescription: control.control_description,
            testProcedure: control.test_procedure,
        }));
    }
    return (0, exports.getChecklistTemplateControls)(auditType);
};
exports.getEngagementControls = getEngagementControls;
exports.CHECKLIST_TEMPLATE_CONFIG_KEY = 'checklist_templates';
/**
 * Full per-audit-type checklist template config: saved overrides for each audit
 * type, falling back to the built-in CONTROL_SETS where nothing is configured.
 */
const getChecklistTemplateConfig = async () => {
    const parsed = await getJsonConfig(exports.CHECKLIST_TEMPLATE_CONFIG_KEY, {});
    const result = {};
    for (const auditType of Object.values(audit_enum_1.AuditType)) {
        const saved = parsed[auditType];
        const controls = Array.isArray(saved) && saved.length > 0
            ? saved.filter(isChecklistTemplateControl)
            : (audit_utility_1.CONTROL_SETS[auditType] ?? []);
        result[auditType] = controls.map((control) => ({
            controlReference: control.controlReference,
            controlDescription: control.controlDescription,
            testProcedure: control.testProcedure,
        }));
    }
    return result;
};
exports.getChecklistTemplateConfig = getChecklistTemplateConfig;
/** Validates and persists (upserts) the full checklist template config. */
const setChecklistTemplateConfig = async (config, actorId) => {
    const clean = {};
    for (const auditType of Object.values(audit_enum_1.AuditType)) {
        const controls = config[auditType];
        if (!controls)
            continue;
        clean[auditType] = controls
            .filter(isChecklistTemplateControl)
            .map((control) => ({
            controlReference: control.controlReference.trim(),
            controlDescription: control.controlDescription.trim(),
            testProcedure: control.testProcedure.trim(),
        }))
            .filter((control) => control.controlReference.length > 0);
    }
    await prisma_client_1.prisma.system_Config.upsert({
        where: { key: exports.CHECKLIST_TEMPLATE_CONFIG_KEY },
        create: {
            key: exports.CHECKLIST_TEMPLATE_CONFIG_KEY,
            value: JSON.stringify(clean),
            description: 'Per-audit-type checklist control templates used to populate engagement checklists.',
            updated_by_id: actorId,
        },
        update: { value: JSON.stringify(clean), updated_by_id: actorId },
    });
    logger_util_1.logger.info('Checklist templates updated', { actorId });
    return (0, exports.getChecklistTemplateConfig)();
};
exports.setChecklistTemplateConfig = setChecklistTemplateConfig;
/**
 * Sentinel chain entry: resolve this level to the entity's assigned engagement
 * manager (a specific person) rather than to a permission holder.
 */
exports.ENGAGEMENT_MANAGER_APPROVER = 'engagement_manager';
exports.DEFAULT_APPROVAL_MATRIX = {
    auditPlan: ['plan:approve'],
    workingPaper: [exports.ENGAGEMENT_MANAGER_APPROVER],
    auditReport: [exports.ENGAGEMENT_MANAGER_APPROVER, 'report:approve:oversight', 'report:approve:final'],
    findingClosure: [exports.ENGAGEMENT_MANAGER_APPROVER],
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
exports.DEFAULT_PLANNING_PRIORITY_WEIGHTS = {
    riskScore: 40,
    openFindings: 25,
    overdueForAudit: 20,
    neverAudited: 10,
    timeSinceLastAudit: 5,
};
const getPlanningPriorityWeights = async () => {
    const parsed = await getJsonConfig('planning_priority_weights', {});
    return { ...exports.DEFAULT_PLANNING_PRIORITY_WEIGHTS, ...parsed };
};
exports.getPlanningPriorityWeights = getPlanningPriorityWeights;
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
/**
 * Serialize a per-engagement checklist control set for storage on the engagement.
 * Returns null when there is nothing to store (so populate falls back to the
 * global per-audit-type template).
 */
const serializeChecklistControls = (controls) => {
    if (!Array.isArray(controls) || controls.length === 0)
        return null;
    const clean = controls
        .filter(isChecklistTemplateControl)
        .map((control) => ({
        controlReference: control.controlReference.trim(),
        controlDescription: control.controlDescription.trim(),
        testProcedure: control.testProcedure.trim(),
    }))
        .filter((control) => control.controlReference.length > 0);
    return clean.length > 0 ? JSON.stringify(clean) : null;
};
exports.serializeChecklistControls = serializeChecklistControls;
/**
 * Parse a per-engagement checklist control snapshot stored on the engagement.
 * Returns null when absent or invalid, signalling callers to fall back to the
 * global per-audit-type template.
 */
const parseChecklistTemplateSnapshot = (value) => {
    if (!value)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        return null;
    }
    if (!Array.isArray(parsed))
        return null;
    const controls = parsed.filter(isChecklistTemplateControl).map((control) => ({
        controlReference: control.controlReference,
        controlDescription: control.controlDescription,
        testProcedure: control.testProcedure,
    }));
    return controls.length > 0 ? controls : null;
};
exports.parseChecklistTemplateSnapshot = parseChecklistTemplateSnapshot;
//# sourceMappingURL=audit-config.utility.js.map