import { prisma } from '../../../shared/prisma/prisma.client';
import { logger } from '../../../shared/utils/logger.util';
import { AuditType } from '../domain/enum/audit.enum';
import { CONTROL_SETS } from './audit.utility';

export interface AuditLifecycleRules {
  requireAllChecklistsTestedBeforeUnderReview: boolean;
  requireApprovedWorkingPaperBeforeUnderReview: boolean;
  requireReportIssuedBeforeReported: boolean;
  requireClosedFindingsBeforeClose: boolean;
}

export interface AuditSlaRules {
  defaultEngagementSlaDays: number;
  defaultFindingDueDays: number;
  highRiskFindingDueDays: number;
  criticalFindingDueDays: number;
}

export interface ChecklistTemplateControl {
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
}

export type ChecklistTemplateConfig = Partial<Record<AuditType, ChecklistTemplateControl[]>>;

export const DEFAULT_AUDIT_LIFECYCLE_RULES: AuditLifecycleRules = {
  requireAllChecklistsTestedBeforeUnderReview: true,
  requireApprovedWorkingPaperBeforeUnderReview: true,
  requireReportIssuedBeforeReported: true,
  requireClosedFindingsBeforeClose: true,
};

export const DEFAULT_AUDIT_SLA_RULES: AuditSlaRules = {
  defaultEngagementSlaDays: 30,
  defaultFindingDueDays: 90,
  highRiskFindingDueDays: 60,
  criticalFindingDueDays: 30,
};

export const DEFAULT_SLA_CONFIG: Record<string, number> = {
  [AuditType.It]: 30,
  [AuditType.Systems]: 30,
  [AuditType.Financial]: 30,
  [AuditType.Compliance]: 30,
  [AuditType.Operational]: 30,
  [AuditType.Pension]: 30,
  [AuditType.Procurement]: 30,
  [AuditType.HrPayroll]: 30,
  [AuditType.Project]: 30,
  [AuditType.Special]: 30,
};

export const DEFAULT_CHECKLIST_TEMPLATES: Record<AuditType, ChecklistTemplateControl[]> = {
  [AuditType.It]: CONTROL_SETS[AuditType.It] ?? [],
  [AuditType.Systems]: CONTROL_SETS[AuditType.Systems] ?? [],
  [AuditType.Financial]: CONTROL_SETS[AuditType.Financial] ?? [],
  [AuditType.Compliance]: CONTROL_SETS[AuditType.Compliance] ?? [],
  [AuditType.Operational]: [
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
  [AuditType.Pension]: [
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
  [AuditType.Procurement]: [
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
  [AuditType.HrPayroll]: [
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
  [AuditType.Project]: [
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
  [AuditType.Special]: [
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
Object.assign(CONTROL_SETS, DEFAULT_CHECKLIST_TEMPLATES);

export const DEFAULT_CHECKLIST_TEMPLATE_CONFIG: ChecklistTemplateConfig = DEFAULT_CHECKLIST_TEMPLATES;

export const getAuditLifecycleRules = async (): Promise<AuditLifecycleRules> => {
  const parsed = await getJsonConfig<Partial<AuditLifecycleRules>>('audit_lifecycle_rules', {});
  return { ...DEFAULT_AUDIT_LIFECYCLE_RULES, ...parsed };
};

export const getAuditSlaRules = async (): Promise<AuditSlaRules> => {
  const parsed = await getJsonConfig<Partial<AuditSlaRules>>('audit_sla_rules', {});
  return { ...DEFAULT_AUDIT_SLA_RULES, ...parsed };
};

export const getSlaDaysForAuditType = async (auditType?: string): Promise<number> => {
  const slaRules = await getAuditSlaRules();
  if (auditType && DEFAULT_SLA_CONFIG[auditType]) {
    return slaRules.defaultEngagementSlaDays || DEFAULT_SLA_CONFIG[auditType];
  }
  return slaRules.defaultEngagementSlaDays || 30;
};

export const getChecklistTemplateControls = async (
  auditType: AuditType | string,
): Promise<ChecklistTemplateControl[]> => {
  const parsed = await getJsonConfig<ChecklistTemplateConfig>(
    'checklist_templates',
    DEFAULT_CHECKLIST_TEMPLATE_CONFIG,
  );
  const key = auditType as AuditType;
  const controls = parsed[key];
  if (!Array.isArray(controls) || controls.length === 0) {
    return (
      DEFAULT_CHECKLIST_TEMPLATES[key] ??
      CONTROL_SETS[key] ??
      DEFAULT_CHECKLIST_TEMPLATES[AuditType.Compliance] ??
      []
    );
  }
  return controls
    .filter(isChecklistTemplateControl)
    .map((control) => ({
      controlReference: control.controlReference,
      controlDescription: control.controlDescription,
      testProcedure: control.testProcedure,
    }));
};

/**
 * Authoritative control source for populating an engagement's checklist.
 *
 * Prefers the structured compliance_controls library (active controls for the
 * audit type); falls back to the legacy checklist_templates JSON / built-in
 * CONTROL_SETS when the library has no controls for that type. Callers still
 * snapshot the returned text onto the checklist row, so a populated engagement
 * is unaffected by later edits to the library.
 */
export const getEngagementControls = async (
  auditType: AuditType,
): Promise<ChecklistTemplateControl[]> => {
  const dbControls = await prisma.compliance_Control.findMany({
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
  return getChecklistTemplateControls(auditType);
};

export const CHECKLIST_TEMPLATE_CONFIG_KEY = 'checklist_templates';

/**
 * Full per-audit-type checklist template config: saved overrides for each audit
 * type, falling back to the built-in CONTROL_SETS where nothing is configured.
 */
export const getChecklistTemplateConfig = async (): Promise<Record<AuditType, ChecklistTemplateControl[]>> => {
  const parsed = await getJsonConfig<ChecklistTemplateConfig>(CHECKLIST_TEMPLATE_CONFIG_KEY, {});
  const result = {} as Record<AuditType, ChecklistTemplateControl[]>;
  for (const auditType of Object.values(AuditType)) {
    const saved = parsed[auditType];
    const controls = Array.isArray(saved) && saved.length > 0
      ? saved.filter(isChecklistTemplateControl)
      : (DEFAULT_CHECKLIST_TEMPLATES[auditType] ?? CONTROL_SETS[auditType] ?? []);
    result[auditType] = controls.map((control) => ({
      controlReference: control.controlReference,
      controlDescription: control.controlDescription,
      testProcedure: control.testProcedure,
    }));
  }
  return result;
};

export const getChecklistTemplates = getChecklistTemplateControls;

/** Validates and persists (upserts) the full checklist template config. */
export const setChecklistTemplateConfig = async (
  config: ChecklistTemplateConfig,
  actorId: string,
): Promise<Record<AuditType, ChecklistTemplateControl[]>> => {
  const clean: ChecklistTemplateConfig = {};
  for (const auditType of Object.values(AuditType)) {
    const controls = config[auditType];
    if (!controls) continue;
    clean[auditType] = controls
      .filter(isChecklistTemplateControl)
      .map((control) => ({
        controlReference: control.controlReference.trim(),
        controlDescription: control.controlDescription.trim(),
        testProcedure: control.testProcedure.trim(),
      }))
      .filter((control) => control.controlReference.length > 0);
  }
  await prisma.system_Config.upsert({
    where: { key: CHECKLIST_TEMPLATE_CONFIG_KEY },
    create: {
      key: CHECKLIST_TEMPLATE_CONFIG_KEY,
      value: JSON.stringify(clean),
      description: 'Per-audit-type checklist control templates used to populate engagement checklists.',
      updated_by_id: actorId,
    },
    update: { value: JSON.stringify(clean), updated_by_id: actorId },
  });
  logger.info('Checklist templates updated', { actorId });
  return getChecklistTemplateConfig();
};

/**
 * Sentinel chain entry: resolve this level to the entity's assigned engagement
 * manager (a specific person) rather than to a permission holder.
 */
export const ENGAGEMENT_MANAGER_APPROVER = 'engagement_manager';

export interface ApprovalMatrix {
  /**
   * Ordered approver chain per entity type. Each level is either the
   * ENGAGEMENT_MANAGER_APPROVER sentinel (resolved to the entity's engagement
   * manager) or a permission slug (resolved to an active holder of that
   * permission). Approvers are never resolved by role name — roles matter only
   * insofar as an admin grants these permissions to them.
   */
  auditPlan: string[];
  workingPaper: string[];
  auditReport: string[];
  findingClosure: string[];
}

export const DEFAULT_APPROVAL_MATRIX: ApprovalMatrix = {
  auditPlan: ['plan:approve'],
  workingPaper: [ENGAGEMENT_MANAGER_APPROVER],
  auditReport: [ENGAGEMENT_MANAGER_APPROVER, 'report:approve:oversight', 'report:approve:final'],
  findingClosure: [ENGAGEMENT_MANAGER_APPROVER],
};

/**
 * Reads the GBB-configurable approval matrix from system_config. Admins edit this
 * in Settings to control who signs off on plans, working papers, and reports — the
 * approval engine resolves each level to a permission holder (or the engagement
 * manager), never to a hardcoded role.
 */
export const getApprovalMatrix = async (): Promise<ApprovalMatrix> => {
  const parsed = await getJsonConfig<Partial<ApprovalMatrix>>('approval_matrix', {});
  return { ...DEFAULT_APPROVAL_MATRIX, ...parsed };
};

/**
 * Relative importance of each signal in the audit-planning priority score.
 * Values are relative weights (any scale — they are normalized by their sum),
 * editable by admins in Settings so GBB defines what "priority" means.
 */
export interface PlanningPriorityWeights {
  riskScore: number;
  openFindings: number;
  overdueForAudit: number;
  neverAudited: number;
  timeSinceLastAudit: number;
}

export const DEFAULT_PLANNING_PRIORITY_WEIGHTS: PlanningPriorityWeights = {
  riskScore: 40,
  openFindings: 25,
  overdueForAudit: 20,
  neverAudited: 10,
  timeSinceLastAudit: 5,
};

export const getPlanningPriorityWeights = async (): Promise<PlanningPriorityWeights> => {
  const parsed = await getJsonConfig<Partial<PlanningPriorityWeights>>('planning_priority_weights', {});
  return { ...DEFAULT_PLANNING_PRIORITY_WEIGHTS, ...parsed };
};

const getJsonConfig = async <T>(key: string, fallback: T): Promise<T> => {
  const config = await prisma.system_Config.findUnique({
    where: { key },
    select: { value: true },
  });
  if (!config?.value) return fallback;

  try {
    return JSON.parse(config.value) as T;
  } catch (err) {
    logger.warn('Invalid JSON system config; using fallback', { key, err });
    return fallback;
  }
};

const isChecklistTemplateControl = (value: unknown): value is ChecklistTemplateControl => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.controlReference === 'string'
    && typeof record.controlDescription === 'string'
    && typeof record.testProcedure === 'string';
};

/**
 * Serialize a per-engagement checklist control set for storage on the engagement.
 * Returns null when there is nothing to store (so populate falls back to the
 * global per-audit-type template).
 */
export const serializeChecklistControls = (
  controls: ChecklistTemplateControl[] | undefined | null,
): string | null => {
  if (!Array.isArray(controls) || controls.length === 0) return null;
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

/**
 * Parse a per-engagement checklist control snapshot stored on the engagement.
 * Returns null when absent or invalid, signalling callers to fall back to the
 * global per-audit-type template.
 */
export const parseChecklistTemplateSnapshot = (
  value: string | null | undefined,
): ChecklistTemplateControl[] | null => {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const controls = parsed.filter(isChecklistTemplateControl).map((control) => ({
    controlReference: control.controlReference,
    controlDescription: control.controlDescription,
    testProcedure: control.testProcedure,
  }));
  return controls.length > 0 ? controls : null;
};
