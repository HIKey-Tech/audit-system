import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { ActorContext } from '../../domain/entity/audit.entity';
import { ViewerContext } from '../dto/response/engagement.response.dto';

interface EngagementParties {
  lead_auditor_id: string | null;
  audit_manager_id: string | null;
  auditee_id: string | null;
}

const isAssignee = async (engagementId: string, userId: string): Promise<boolean> => {
  const a = await prisma.workflow_Assignment.findFirst({
    where: { engagement_id: engagementId, user_id: userId },
    select: { id: true },
  });
  return a !== null;
};

/**
 * Engagements whose documents an actor may see in the central audit repository.
 * The repository holds internal auditor material only — working papers,
 * supporting documents, engagement and follow-up evidence, reports — so a
 * *pure auditee* gets nothing here (the auditee branch is deliberately omitted),
 * mirroring `assertCanViewInternalArtifacts`. Oversight (`engagement:read_all`)
 * is unrestricted. Returns `undefined` for unrestricted access.
 */
export const repositoryEngagementScope = (
  actor: ActorContext,
): Prisma.Audit_EngagementWhereInput | undefined => {
  if (actor.permissions.includes('engagement:read_all')) return undefined;
  return {
    OR: [
      { lead_auditor_id: actor.id },
      { audit_manager_id: actor.id },
      { workflow_assignments: { some: { user_id: actor.id } } },
    ],
  };
};

/** A "pure auditee" is the auditee and nothing else — not team, not oversight. */
export const resolveViewerContext = async (
  engagementId: string,
  parties: EngagementParties,
  actor: ActorContext,
): Promise<ViewerContext> => {
  const isOversight = actor.permissions.includes('engagement:read_all');
  const isTeam =
    actor.id === parties.lead_auditor_id ||
    actor.id === parties.audit_manager_id ||
    (await isAssignee(engagementId, actor.id));
  const isAuditee = actor.id === parties.auditee_id;
  const pureAuditee = isAuditee && !isOversight && !isTeam;

  const role: ViewerContext['role'] = isOversight ? 'oversight' : pureAuditee ? 'auditee' : 'team';
  const full = !pureAuditee;
  return {
    role,
    canViewWorkingPapers: full,
    canViewInternalEvidence: full,
    canViewChecklists: full,
    canViewDraftFindings: full,
  };
};

/** Throws 403 for a pure auditee trying to read internal engagement artifacts. */
export const assertCanViewInternalArtifacts = async (engagementId: string, actor: ActorContext): Promise<void> => {
  const eng = await prisma.audit_Engagement.findFirst({
    where: { id: engagementId, deleted_at: null },
    select: { lead_auditor_id: true, audit_manager_id: true, auditee_id: true },
  });
  if (!eng) return; // existence handled by the caller's own lookup
  const ctx = await resolveViewerContext(engagementId, eng, actor);
  if (ctx.role === 'auditee') {
    const { AppError } = await import('../../../../shared/errors/app.error');
    throw AppError.forbidden('Auditees cannot view internal audit working papers, checklists, or draft evidence');
  }
};
