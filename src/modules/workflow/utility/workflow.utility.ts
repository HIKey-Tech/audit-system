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
 * Segregation of duties: whoever submitted an item for approval may not also
 * approve it. Rejecting your own submission is fine — only the sign-off is gated.
 */
export const assertNotSelfApproval = (submittedById: string, actorId: string): void => {
  if (submittedById === actorId) {
    throw AppError.forbidden(
      'You submitted this item for approval and cannot also approve it (segregation of duties). It must be approved by a different authorized user.',
    );
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

/**
 * Boot-time sanity check: warn when an escalation tier targets role names
 * that no active user holds (e.g. a deployment renamed/replaced the seeded
 * director/cae roles without updating `system_config.escalation_matrix`) —
 * escalations at that tier would notify nobody. Never throws.
 */
export const warnOnUnresolvableEscalationTargets = async (): Promise<void> => {
  try {
    const matrix = await getEscalationMatrix();
    const tiers: Array<[string, string[]]> = [
      ['auditEngagement.level3', matrix.auditEngagement.level3],
      ['auditEngagement.beyond', matrix.auditEngagement.beyond],
      ['workflowApproval.level3', matrix.workflowApproval.level3],
      ['workflowApproval.level4', matrix.workflowApproval.level4],
      ['workflowApproval.otherwise', matrix.workflowApproval.otherwise],
    ];
    const roleNames = [...new Set(tiers.flatMap(([, roles]) => roles))];
    if (roleNames.length === 0) return;

    const holders = await prisma.user.findMany({
      where: {
        deleted_at: null,
        is_active: true,
        user_roles: { some: { role: { name: { in: roleNames } } } },
      },
      select: { user_roles: { select: { role: { select: { name: true } } } } },
    });
    const covered = new Set(
      holders.flatMap((user) => user.user_roles.map((userRole) => userRole.role.name)),
    );

    for (const [tier, roles] of tiers) {
      if (roles.length > 0 && !roles.some((role) => covered.has(role))) {
        logger.warn(
          `Escalation matrix tier "${tier}" targets roles [${roles.join(', ')}] but no active ` +
            'user holds any of them — escalations at this tier will notify nobody. Update ' +
            'system_config.escalation_matrix in Settings or assign the roles to users.',
        );
      }
    }
  } catch (err) {
    logger.warn('Escalation matrix startup check failed (non-fatal)', { err });
  }
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
