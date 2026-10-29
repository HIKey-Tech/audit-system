"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseChecklistTemplateSnapshot = exports.serializeChecklistControls = exports.getPlanningPriorityWeights = exports.DEFAULT_PLANNING_PRIORITY_WEIGHTS = exports.getApprovalMatrix = exports.DEFAULT_APPROVAL_MATRIX = exports.ENGAGEMENT_MANAGER_APPROVER = exports.setChecklistTemplateConfig = exports.getChecklistTemplates = exports.getChecklistTemplateConfig = exports.CHECKLIST_TEMPLATE_CONFIG_KEY = exports.getEngagementControls = exports.getChecklistTemplateControls = exports.getSlaDaysForAuditType = exports.getAuditSlaRules = exports.getAuditLifecycleRules = exports.DEFAULT_CHECKLIST_TEMPLATE_CONFIG = exports.DEFAULT_CHECKLIST_TEMPLATES = exports.DEFAULT_SLA_CONFIG = exports.DEFAULT_AUDIT_SLA_RULES = exports.DEFAULT_AUDIT_LIFECYCLE_RULES = void 0;
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
exports.DEFAULT_SLA_CONFIG = {
    [audit_enum_1.AuditType.It]: 30,
    [audit_enum_1.AuditType.Systems]: 30,
    [audit_enum_1.AuditType.Financial]: 30,
    [audit_enum_1.AuditType.Compliance]: 30,
    [audit_enum_1.AuditType.Operational]: 30,
    [audit_enum_1.AuditType.Pension]: 30,
    [audit_enum_1.AuditType.Procurement]: 30,
    [audit_enum_1.AuditType.HrPayroll]: 30,
    [audit_enum_1.AuditType.Project]: 30,
    [audit_enum_1.AuditType.Special]: 30,
};
exports.DEFAULT_CHECKLIST_TEMPLATES = {
    [audit_enum_1.AuditType.It]: audit_utility_1.CONTROL_SETS[audit_enum_1.AuditType.It] ?? [],
    [audit_enum_1.AuditType.Systems]: audit_utility_1.CONTROL_SETS[audit_enum_1.AuditType.Systems] ?? [],
    [audit_enum_1.AuditType.Financial]: audit_utility_1.CONTROL_SETS[audit_enum_1.AuditType.Financial] ?? [],
    [audit_enum_1.AuditType.Compliance]: audit_utility_1.CONTROL_SETS[audit_enum_1.AuditType.Compliance] ?? [],
    [audit_enum_1.AuditType.Operational]: [
        {
            controlReference: 'OPS-SOP-001',
            controlDescription: 'Standard Operating Procedures (SOPs) are documented, approved by management, and reviewed periodically for all core operational processes.',
            testProcedure: 'Obtain the inventory of operational SOPs, verify management sign-off and review dates, and walkthrough a sample of processes to confirm adherence.',
        },
        {
            controlReference: 'OPS-KPI-002',
            controlDescription: 'Operational service levels, turnaround times, and key performance indicators (KPIs) are tracked, reported, and escalated when breached.',
            testProcedure: 'Inspect monthly operational performance reports, compare actual turnaround times against target OLAs/SLAs, and review root-cause actions for breaches.',
        },
        {
            controlReference: 'OPS-QA-003',
            controlDescription: 'Supervisory review and quality assurance checks are performed over daily operational outputs and exception logs.',
            testProcedure: 'Sample daily operational logs and exception reports to confirm evidence of independent supervisory review and timely resolution of exceptions.',
        },
        {
            controlReference: 'OPS-RES-004',
            controlDescription: 'Resource utilization, inventory/consumables custody, and operational handovers are logged and reconciled.',
            testProcedure: 'Inspect shift/process handover logs and custody registers, and trace a sample of operational movements to supporting authorization records.',
        },
    ],
    [audit_enum_1.AuditType.Pension]: [
        {
            controlReference: 'PEN-PRA-001',
            controlDescription: 'Monthly employee and employer pension contributions are deducted in accordance with the Pension Reform Act (PRA 2014) rates and remitted to PFAs/PFCs within 7 working days of salary payment.',
            testProcedure: 'Recalculate statutory employer (min. 10%) and employee (min. 8%) contributions from the payroll summary, and trace remittance schedules and payment receipts to confirm remittance within 7 working days per PENCOM guidelines.',
        },
        {
            controlReference: 'PEN-REC-002',
            controlDescription: 'Monthly pension remittance schedules are reconciled with Pension Fund Administrators (PFAs) and uncredited/rejected RSA contributions are resolved promptly.',
            testProcedure: 'Inspect monthly PFA reconciliation statements, review the schedule of uncredited or returned contributions, and verify evidence of RSA PIN regularization with affected staff and PFAs.',
        },
        {
            controlReference: 'PEN-BEN-003',
            controlDescription: 'Group Life Insurance Policy (minimum 3x annual total emolument under PRA 2014 Section 4(5)) and death/retirement benefit documentation are maintained and current.',
            testProcedure: 'Inspect the active Group Life Insurance certificate, verify coverage value against current staff emoluments, and sample deceased/retired employee files for complete PENCOM notification and benefit processing documentation.',
        },
        {
            controlReference: 'PEN-RSA-004',
            controlDescription: 'All eligible employees have valid Retirement Savings Account (RSA) PINs captured on onboarding, and nominal roll changes are reflected in pension schedules.',
            testProcedure: 'Compare the active HR nominal roll against the monthly pension contribution schedule to identify any employees without RSA PINs or discrepancies in contribution bases.',
        },
    ],
    [audit_enum_1.AuditType.Procurement]: [
        {
            controlReference: 'PROC-PPA-001',
            controlDescription: 'Procurement activities comply with the Public Procurement Act (PPA 2007) / institutional procurement policy competitive bidding and BPP approval thresholds.',
            testProcedure: 'Sample procurement files across value bands, verify that appropriate solicitation methods (open competitive bidding, RFQ, or restricted tendering) were used in line with BPP/policy thresholds, and check for contract splitting.',
        },
        {
            controlReference: 'PROC-VDD-002',
            controlDescription: 'Vendor pre-qualification and due diligence (CAC registration, Tax Clearance Certificate, PENCOM, ITF, NSITF, BPP IRR) are verified prior to contract award.',
            testProcedure: 'Inspect vendor onboarding and bid evaluation files to confirm valid statutory compliance certificates and conflict-of-interest declarations were verified before award.',
        },
        {
            controlReference: 'PROC-EVAL-003',
            controlDescription: 'Bid opening, technical and financial evaluation, and Tenders Board / Procurement Committee approvals are transparently documented.',
            testProcedure: 'Review bid opening registers, technical/financial evaluation score sheets, and Tenders Board minutes to confirm awards were made to the lowest evaluated responsive bidder.',
        },
        {
            controlReference: 'PROC-GRN-004',
            controlDescription: 'Three-way matching (Purchase Order, Goods Received Note / Job Completion Certificate, and Vendor Invoice) is enforced prior to payment disbursement.',
            testProcedure: 'Sample procurement payments and verify that signed POs, independent inspection/GRN or JCC sign-offs, and invoices match in quantity, specification, and price before payment approval.',
        },
    ],
    [audit_enum_1.AuditType.HrPayroll]: [
        {
            controlReference: 'HRP-NOM-001',
            controlDescription: 'Monthly payroll register is reconciled against the approved HR nominal roll to prevent unauthorized additions or ghost workers.',
            testProcedure: 'Perform a headcount and bank-account reconciliation between the HR master file (nominal roll) and the monthly payroll disbursement file; investigate duplicate bank accounts, BVN mismatches, or unapproved staff entries.',
        },
        {
            controlReference: 'HRP-JML-002',
            controlDescription: 'Joiners, movers (promotions/transfers), and leavers (resignations, dismissals, retirements) are promptly updated on payroll with formal authorization.',
            testProcedure: 'Sample new hires, promotions, and separated staff during the audit period; verify appointment/exit letters and confirm leavers were removed from payroll before the next pay cycle.',
        },
        {
            controlReference: 'HRP-STAT-003',
            controlDescription: 'Statutory payroll deductions (PAYE tax, Pension, NHF, NSITF, ITF) are accurately computed and remitted to the relevant regulatory authorities within statutory deadlines.',
            testProcedure: 'Recalculate PAYE, NHF, NSITF, and pension deductions for a sample of staff across grade levels, and inspect official tax/regulatory remittance receipts and filing acknowledgements.',
        },
        {
            controlReference: 'HRP-VAR-004',
            controlDescription: 'Month-on-month payroll variance analysis and payroll register sign-off are performed prior to salary disbursement.',
            testProcedure: 'Inspect monthly payroll variance reports comparing current and prior month gross/net pay, and verify independent HR and Finance approval before bank upload.',
        },
    ],
    [audit_enum_1.AuditType.Project]: [
        {
            controlReference: 'PRJ-CHR-001',
            controlDescription: 'Projects have an approved Project Charter, business case, budget, and governance structure prior to commencement.',
            testProcedure: 'Inspect the project charter, feasibility/business case approval, and budget allocation records to confirm formal authorization before project kick-off.',
        },
        {
            controlReference: 'PRJ-MLS-002',
            controlDescription: 'Project deliverables and milestones are independently inspected, tested, and signed off before milestone payments are released.',
            testProcedure: 'Sample milestone completion certificates and user acceptance sign-offs, and trace them to project schedule deliverables and milestone payment vouchers.',
        },
        {
            controlReference: 'PRJ-VAR-003',
            controlDescription: 'Scope changes, variation orders, and timeline extensions require formal impact assessment and approval within delegated authority limits.',
            testProcedure: 'Review all project variation orders and change requests, verify cost/schedule impact assessments, and confirm formal Steering Committee or Tenders Board approval.',
        },
        {
            controlReference: 'PRJ-CLS-004',
            controlDescription: 'Project expenditure is tracked against budget, and post-implementation review and project closure handover are documented.',
            testProcedure: 'Compare cumulative project spend against approved budget, review retention fee accounting, and inspect project closure and lessons-learned reports.',
        },
    ],
    [audit_enum_1.AuditType.Special]: [
        {
            controlReference: 'SPC-TOR-001',
            controlDescription: 'Special investigation or ad-hoc audit is conducted under a formal Terms of Reference (ToR) defining mandate, scope, and reporting lines.',
            testProcedure: 'Inspect the approved Terms of Reference or management/board mandate, and verify that investigation activities and scope align with the authorized mandate.',
        },
        {
            controlReference: 'SPC-EVD-002',
            controlDescription: 'Chain of custody, forensic evidence preservation, and access logs are maintained for all records and digital/physical artifacts collected.',
            testProcedure: 'Review the evidence collection log, verify hash/integrity records and chain-of-custody sign-offs, and confirm secure storage of original records.',
        },
        {
            controlReference: 'SPC-INT-003',
            controlDescription: 'Fact-finding interviews, walkthroughs, and transaction reconstructions are Contemporaneously documented and corroborated with independent evidence.',
            testProcedure: 'Inspect interview notes, written statements, and transaction tracing schedules to confirm every conclusion is supported by corroborated documentary or system evidence.',
        },
        {
            controlReference: 'SPC-REM-004',
            controlDescription: 'Control breakdowns, financial loss quantification, and disciplinary/remediation recommendations are documented and tracked to closure.',
            testProcedure: 'Review the root-cause analysis and loss quantification schedule, and verify that recommended control enhancements and recovery actions are assigned to owners with due dates.',
        },
    ],
};
// Ensure CONTROL_SETS also has entries for all audit types at runtime
Object.assign(audit_utility_1.CONTROL_SETS, exports.DEFAULT_CHECKLIST_TEMPLATES);
exports.DEFAULT_CHECKLIST_TEMPLATE_CONFIG = exports.DEFAULT_CHECKLIST_TEMPLATES;
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
const getSlaDaysForAuditType = async (auditType) => {
    const slaRules = await (0, exports.getAuditSlaRules)();
    if (auditType && exports.DEFAULT_SLA_CONFIG[auditType]) {
        return slaRules.defaultEngagementSlaDays || exports.DEFAULT_SLA_CONFIG[auditType];
    }
    return slaRules.defaultEngagementSlaDays || 30;
};
exports.getSlaDaysForAuditType = getSlaDaysForAuditType;
const getChecklistTemplateControls = async (auditType) => {
    const parsed = await getJsonConfig('checklist_templates', exports.DEFAULT_CHECKLIST_TEMPLATE_CONFIG);
    const key = auditType;
    const controls = parsed[key];
    if (!Array.isArray(controls) || controls.length === 0) {
        return (exports.DEFAULT_CHECKLIST_TEMPLATES[key] ??
            audit_utility_1.CONTROL_SETS[key] ??
            exports.DEFAULT_CHECKLIST_TEMPLATES[audit_enum_1.AuditType.Compliance] ??
            []);
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
            : (exports.DEFAULT_CHECKLIST_TEMPLATES[auditType] ?? audit_utility_1.CONTROL_SETS[auditType] ?? []);
        result[auditType] = controls.map((control) => ({
            controlReference: control.controlReference,
            controlDescription: control.controlDescription,
            testProcedure: control.testProcedure,
        }));
    }
    return result;
};
exports.getChecklistTemplateConfig = getChecklistTemplateConfig;
exports.getChecklistTemplates = exports.getChecklistTemplateControls;
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