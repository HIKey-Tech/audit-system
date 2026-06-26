import { Prisma } from '@prisma/client';
import { ActorContext } from '../../domain/entity/audit.entity';
import { ViewerContext } from '../dto/response/engagement.response.dto';
interface EngagementParties {
    lead_auditor_id: string | null;
    audit_manager_id: string | null;
    auditee_id: string | null;
}
/**
 * Engagements whose documents an actor may see in the central audit repository.
 * The repository holds internal auditor material only — working papers,
 * supporting documents, engagement and follow-up evidence, reports — so a
 * *pure auditee* gets nothing here (the auditee branch is deliberately omitted),
 * mirroring `assertCanViewInternalArtifacts`. Oversight (`engagement:read_all`)
 * is unrestricted. Returns `undefined` for unrestricted access.
 */
export declare const repositoryEngagementScope: (actor: ActorContext) => Prisma.Audit_EngagementWhereInput | undefined;
/**
 * Resolves how a viewer sees one engagement's internal artifacts.
 *
 * Secure by default: only the audit team (lead, manager, or an assigned member)
 * and oversight (`engagement:read_all`) get full visibility. Everyone else — the
 * named auditee, a finding co-responder, or any other `engagement:read` holder
 * who is not on the team — is treated as a restricted `auditee` and cannot see
 * working papers, checklists, or draft evidence. We never fall back to the more
 * privileged `team` role for an unrecognised viewer.
 */
export declare const resolveViewerContext: (engagementId: string, parties: EngagementParties, actor: ActorContext) => Promise<ViewerContext>;
/** Throws 403 for a pure auditee trying to read internal engagement artifacts. */
export declare const assertCanViewInternalArtifacts: (engagementId: string, actor: ActorContext) => Promise<void>;
export {};
//# sourceMappingURL=engagement-visibility.util.d.ts.map