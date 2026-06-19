import { ActorContext } from '../../domain/entity/audit.entity';
import { ViewerContext } from '../dto/response/engagement.response.dto';
interface EngagementParties {
    lead_auditor_id: string | null;
    audit_manager_id: string | null;
    auditee_id: string | null;
}
/** A "pure auditee" is the auditee and nothing else — not team, not oversight. */
export declare const resolveViewerContext: (engagementId: string, parties: EngagementParties, actor: ActorContext) => Promise<ViewerContext>;
/** Throws 403 for a pure auditee trying to read internal engagement artifacts. */
export declare const assertCanViewInternalArtifacts: (engagementId: string, actor: ActorContext) => Promise<void>;
export {};
//# sourceMappingURL=engagement-visibility.util.d.ts.map