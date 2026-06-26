"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCanViewInternalArtifacts = exports.resolveViewerContext = exports.repositoryEngagementScope = void 0;
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const isAssignee = async (engagementId, userId) => {
    const a = await prisma_client_1.prisma.workflow_Assignment.findFirst({
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
const repositoryEngagementScope = (actor) => {
    if (actor.permissions.includes('engagement:read_all'))
        return undefined;
    return {
        OR: [
            { lead_auditor_id: actor.id },
            { audit_manager_id: actor.id },
            { workflow_assignments: { some: { user_id: actor.id } } },
        ],
    };
};
exports.repositoryEngagementScope = repositoryEngagementScope;
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
const resolveViewerContext = async (engagementId, parties, actor) => {
    const isOversight = actor.permissions.includes('engagement:read_all');
    const isTeam = actor.id === parties.lead_auditor_id ||
        actor.id === parties.audit_manager_id ||
        (await isAssignee(engagementId, actor.id));
    const role = isOversight ? 'oversight' : isTeam ? 'team' : 'auditee';
    const full = isOversight || isTeam;
    return {
        role,
        canViewWorkingPapers: full,
        canViewInternalEvidence: full,
        canViewChecklists: full,
        canViewDraftFindings: full,
    };
};
exports.resolveViewerContext = resolveViewerContext;
/** Throws 403 for a pure auditee trying to read internal engagement artifacts. */
const assertCanViewInternalArtifacts = async (engagementId, actor) => {
    const eng = await prisma_client_1.prisma.audit_Engagement.findFirst({
        where: { id: engagementId, deleted_at: null },
        select: { lead_auditor_id: true, audit_manager_id: true, auditee_id: true },
    });
    if (!eng)
        return; // existence handled by the caller's own lookup
    const ctx = await (0, exports.resolveViewerContext)(engagementId, eng, actor);
    if (ctx.role === 'auditee') {
        const { AppError } = await Promise.resolve().then(() => __importStar(require('../../../../shared/errors/app.error')));
        throw AppError.forbidden('Auditees cannot view internal audit working papers, checklists, or draft evidence');
    }
};
exports.assertCanViewInternalArtifacts = assertCanViewInternalArtifacts;
//# sourceMappingURL=engagement-visibility.util.js.map