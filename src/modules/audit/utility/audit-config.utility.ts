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

export const DEFAULT_CHECKLIST_TEMPLATE_CONFIG: ChecklistTemplateConfig = CONTROL_SETS;

export const getAuditLifecycleRules = async (): Promise<AuditLifecycleRules> => {
  const parsed = await getJsonConfig<Partial<AuditLifecycleRules>>('audit_lifecycle_rules', {});
  return { ...DEFAULT_AUDIT_LIFECYCLE_RULES, ...parsed };
};

export const getAuditSlaRules = async (): Promise<AuditSlaRules> => {
  const parsed = await getJsonConfig<Partial<AuditSlaRules>>('audit_sla_rules', {});
  return { ...DEFAULT_AUDIT_SLA_RULES, ...parsed };
};

export const getChecklistTemplateControls = async (
  auditType: AuditType,
): Promise<ChecklistTemplateControl[]> => {
  const parsed = await getJsonConfig<ChecklistTemplateConfig>(
    'checklist_templates',
    DEFAULT_CHECKLIST_TEMPLATE_CONFIG,
  );
  const controls = parsed[auditType];
  if (!Array.isArray(controls) || controls.length === 0) {
    return CONTROL_SETS[auditType] ?? [];
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
      : (CONTROL_SETS[auditType] ?? []);
    result[auditType] = controls.map((control) => ({
      controlReference: control.controlReference,
      controlDescription: control.controlDescription,
      testProcedure: control.testProcedure,
    }));
  }
  return result;
};

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
