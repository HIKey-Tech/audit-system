import { AppError } from '../../../shared/errors/app.error';
import { prisma } from '../../../shared/prisma/prisma.client';
import { logger } from '../../../shared/utils/logger.util';

/** Permission-based authorization gate (see audit.utility for rationale). */
export const assertHasPermission = (
  permissions: string[],
  required: string,
  message = 'Insufficient permission for this action',
): void => {
  if (!permissions.includes(required)) {
    throw AppError.forbidden(message);
  }
};

/**
 * Admin-configurable escalation matrix. Maps escalation tiers to the role names
 * whose holders are notified once an escalation passes the entity's own
 * assignees (lead auditor / engagement manager / current approver). Stored in
 * `system_config` under `escalation_matrix` and editable in Settings, mirroring
 * the approval matrix — so escalation targets are not hardcoded role names.
 */
export interface EscalationMatrix {
  auditEngagement: { level3: string[]; beyond: string[] };
  workflowApproval: { level3: string[]; level4: string[]; otherwise: string[] };
}

export const DEFAULT_ESCALATION_MATRIX: EscalationMatrix = {
  auditEngagement: { level3: ['director'], beyond: ['cae'] },
  workflowApproval: { level3: ['director'], level4: ['cae'], otherwise: ['audit_manager'] },
};

export const getEscalationMatrix = async (): Promise<EscalationMatrix> => {
  const parsed = await getJsonConfig<{
    auditEngagement?: Partial<EscalationMatrix['auditEngagement']>;
    workflowApproval?: Partial<EscalationMatrix['workflowApproval']>;
  }>('escalation_matrix', {});

  return {
    auditEngagement: { ...DEFAULT_ESCALATION_MATRIX.auditEngagement, ...parsed.auditEngagement },
    workflowApproval: { ...DEFAULT_ESCALATION_MATRIX.workflowApproval, ...parsed.workflowApproval },
  };
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

export const hoursAgo = (hours: number): Date => {
  const value = new Date();
  value.setHours(value.getHours() - hours);
  return value;
};

export const hasElapsed = (from: Date, hours: number, now = new Date()): boolean =>
  now.getTime() - from.getTime() >= hours * 60 * 60 * 1000;
