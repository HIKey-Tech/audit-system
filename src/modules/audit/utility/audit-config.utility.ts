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

export interface ApprovalMatrix {
  /** Ordered list of role names whose holders approve each level, per entity type. */
  auditPlan: string[];
  workingPaper: string[];
  auditReport: string[];
}

export const DEFAULT_APPROVAL_MATRIX: ApprovalMatrix = {
  auditPlan: ['cae'],
  workingPaper: ['audit_manager'],
  auditReport: ['audit_manager', 'director', 'cae'],
};

/**
 * Reads the GBB-configurable approval matrix from system_config. Admins edit this
 * in Settings to control who signs off on plans, working papers, and reports — the
 * approval engine resolves these role names to users instead of hardcoding them.
 */
export const getApprovalMatrix = async (): Promise<ApprovalMatrix> => {
  const parsed = await getJsonConfig<Partial<ApprovalMatrix>>('approval_matrix', {});
  return { ...DEFAULT_APPROVAL_MATRIX, ...parsed };
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
