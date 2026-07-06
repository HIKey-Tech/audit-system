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
exports.workflowApprovalService = exports.ApprovalService = void 0;
const client_1 = require("@prisma/client");
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const notification_queue_service_1 = require("../../../../messaging/service/implementation/notification-queue.service");
const approval_status_service_1 = require("../../../../audit/approval-status/service/implementation/approval-status.service");
const audit_config_utility_1 = require("../../../../audit/utility/audit-config.utility");
const workflow_enum_1 = require("../../../domain/enum/workflow.enum");
const workflow_utility_1 = require("../../../utility/workflow.utility");
const approval_response_dto_1 = require("../../dto/response/approval.response.dto");
const signature_service_1 = require("../../../../user/service/implementation/signature.service");
const workflowUserSelect = client_1.Prisma.validator()({
    id: true,
    email: true,
    display_name: true,
    first_name: true,
    last_name: true,
    department: true,
    job_title: true,
});
const approvalInclude = client_1.Prisma.validator()({
    submitted_by: { select: workflowUserSelect },
    steps: {
        include: { approver: { select: workflowUserSelect } },
        orderBy: { level: 'asc' },
    },
});
/** Capability permission a user must hold to act as an engagement's manager-level approver. */
const ENGAGEMENT_MANAGER_PERMISSION = {
    [workflow_enum_1.WorkflowEntityType.AuditWorkingPaper]: 'working_paper:approve',
    [workflow_enum_1.WorkflowEntityType.AuditReport]: 'report:approve',
    [workflow_enum_1.WorkflowEntityType.AuditFindingClosure]: 'finding:close',
};
class ApprovalService {
    approvalStatusService;
    constructor(approvalStatusService = approval_status_service_1.approvalStatusService) {
        this.approvalStatusService = approvalStatusService;
    }
    async createApproval(dto, submittedBy, tx) {
        const db = tx ?? prisma_client_1.prisma;
        const existing = await db.workflow_Approval.findFirst({
            where: {
                entity_type: dto.entityType,
                entity_id: dto.entityId,
                status: workflow_enum_1.WorkflowApprovalStatus.Pending,
            },
            select: { id: true },
        });
        if (existing)
            throw app_error_1.AppError.conflict('A pending approval already exists for this entity');
        const levels = await this._resolveApproverChain(db, dto.entityType, dto.entityId);
        if (levels.length === 0)
            throw app_error_1.AppError.badRequest('No approvers configured for this approval');
        const createApprovalRecord = async (client) => {
            const created = await client.workflow_Approval.create({
                data: {
                    entity_type: dto.entityType,
                    entity_id: dto.entityId,
                    submitted_by_id: submittedBy.id,
                    current_level: 1,
                },
            });
            await client.workflow_Approval_Step.createMany({
                data: levels.map((spec, index) => ({
                    approval_id: created.id,
                    level: index + 1,
                    approver_id: spec.approverId,
                    required_permission: spec.requiredPermission,
                })),
            });
            return client.workflow_Approval.findUniqueOrThrow({
                where: { id: created.id },
                include: approvalInclude,
            });
        };
        const approval = tx
            ? await createApprovalRecord(tx)
            : await prisma_client_1.prisma.$transaction(createApprovalRecord, { timeout: 15000 });
        if (!tx)
            this.queueApprovalRequiredNotification((0, approval_response_dto_1.mapApprovalToResponse)(approval));
        logger_util_1.logger.info('Workflow approval created', {
            approvalId: approval.id,
            entityType: dto.entityType,
            entityId: dto.entityId,
            actorId: submittedBy.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: submittedBy.id,
            action: 'workflow.approval.create',
            module: 'workflow',
            entityType: dto.entityType,
            entityId: dto.entityId,
            newValues: { approvalId: approval.id, levels },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(approval);
    }
    queueApprovalRequiredNotification(approval) {
        const currentStep = approval.steps?.find((step) => step.level === approval.currentLevel);
        if (!currentStep)
            return;
        void this._queueApprovalCreatedAsync(approval, {
            approverId: currentStep.approverId,
            requiredPermission: currentStep.requiredPermission,
        });
    }
    async _queueApprovalCreatedAsync(approval, step) {
        const recipientIds = await this._stepRecipientIds(step);
        if (recipientIds.length === 0)
            return;
        const [entityReference, submitterName] = await Promise.all([
            this._resolveEntityReference(approval.entityType, approval.entityId),
            this._resolveActorName(approval.submittedById),
        ]);
        for (const recipientId of recipientIds) {
            this._queueNotification(recipientId, {
                title: 'Approval required',
                body: `A ${approval.entityType} requires your approval.`,
                type: 'info',
                referenceType: 'workflow_approval',
                referenceId: approval.id,
            }, {
                eventKey: 'workflow.approval.created',
                variables: {
                    entityType: approval.entityType,
                    entityReference,
                    submitterName,
                    submittedAt: approval.createdAt,
                },
            });
        }
    }
    async _queueApprovalApprovedAsync(approval, approverId, comment) {
        const [entityReference, submitterName, approverName] = await Promise.all([
            this._resolveEntityReference(approval.entity_type, approval.entity_id),
            this._resolveActorName(approval.submitted_by_id),
            this._resolveActorName(approverId),
        ]);
        this._queueNotification(approval.submitted_by_id, {
            title: 'Approval completed',
            body: `Your ${approval.entity_type} has been approved.`,
            type: 'success',
            referenceType: approval.entity_type,
            referenceId: approval.entity_id,
        }, {
            eventKey: 'workflow.approval.approved',
            variables: {
                entityType: approval.entity_type,
                entityReference,
                submitterName,
                approverName,
                comment: comment ?? '',
            },
        });
    }
    async _queueApprovalRejectedAsync(approval, approverId, reason) {
        const [entityReference, submitterName, approverName] = await Promise.all([
            this._resolveEntityReference(approval.entity_type, approval.entity_id),
            this._resolveActorName(approval.submitted_by_id),
            this._resolveActorName(approverId),
        ]);
        this._queueNotification(approval.submitted_by_id, {
            title: 'Approval rejected',
            body: `Your ${approval.entity_type} was rejected: ${reason}`,
            type: 'warning',
            referenceType: approval.entity_type,
            referenceId: approval.entity_id,
        }, {
            eventKey: 'workflow.approval.rejected',
            variables: {
                entityType: approval.entity_type,
                entityReference,
                submitterName,
                approverName,
                rejectionReason: reason,
            },
        });
    }
    async approve(approvalId, actor, comment, edits) {
        const approval = await this._getPendingApproval(approvalId);
        const currentStep = this._getActionableStep(approval, actor);
        const nextStep = approval.steps.find((step) => step.level === approval.current_level + 1);
        const now = new Date();
        const hasEdits = !!edits && Object.keys(edits).length > 0;
        if (hasEdits) {
            const isReport = approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditReport;
            const isWorkingPaper = approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper;
            if (!isReport && !isWorkingPaper) {
                throw app_error_1.AppError.badRequest('Approve-with-edit is only supported for audit report and working paper approvals');
            }
            if (isReport && edits.content !== undefined) {
                throw app_error_1.AppError.badRequest('`content` edits apply to working papers only');
            }
            if (isWorkingPaper && (edits.executiveSummary !== undefined || edits.scope !== undefined || edits.methodology !== undefined)) {
                throw app_error_1.AppError.badRequest('Working paper approvals only accept `content` edits');
            }
        }
        // Approve & Sign: record the approver's active signature on the step (null if none).
        const sigRef = await signature_service_1.userSignatureService.getActiveSignatureRef(actor.id);
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            // Atomically claim the step: only succeeds while it is still pending, so two
            // concurrent approvers can't both act — the loser matches 0 rows and aborts.
            const claimed = await tx.workflow_Approval_Step.updateMany({
                where: { id: currentStep.id, status: workflow_enum_1.WorkflowApprovalStepStatus.Pending },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStepStatus.Approved,
                    approver_id: actor.id,
                    comment: comment ?? null,
                    acted_at: now,
                    signature_id: sigRef?.id ?? null,
                },
            });
            if (claimed.count === 0) {
                throw app_error_1.AppError.conflict('This approval step has already been actioned');
            }
            // Approve-with-edit: apply the approver's fix in the same transaction as
            // the step claim, so the chain simply continues instead of the entity
            // being rejected and having to restart a full resubmission at level 1.
            if (hasEdits && approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditReport) {
                await tx.audit_Report.update({
                    where: { id: approval.entity_id },
                    data: {
                        ...(edits.executiveSummary !== undefined && { executive_summary: edits.executiveSummary }),
                        ...(edits.scope !== undefined && { scope: edits.scope }),
                        ...(edits.methodology !== undefined && { methodology: edits.methodology }),
                    },
                });
            }
            if (hasEdits && approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper && edits.content !== undefined) {
                await tx.audit_Working_Paper.update({
                    where: { id: approval.entity_id },
                    data: { content: edits.content },
                });
            }
            if (nextStep) {
                await tx.workflow_Approval.update({
                    where: { id: approvalId },
                    data: { current_level: nextStep.level },
                });
            }
            else {
                await tx.workflow_Approval.update({
                    where: { id: approvalId },
                    data: {
                        status: workflow_enum_1.WorkflowApprovalStatus.Approved,
                        completed_at: now,
                    },
                });
                await this.approvalStatusService.markApproved(tx, approval.entity_type, approval.entity_id, actor.id, now);
            }
            return tx.workflow_Approval.findUniqueOrThrow({
                where: { id: approvalId },
                include: approvalInclude,
            });
        }, { timeout: 15000 });
        if (nextStep) {
            void this._queueApprovalCreatedAsync((0, approval_response_dto_1.mapApprovalToResponse)(updated), {
                approverId: nextStep.approver_id,
                requiredPermission: nextStep.required_permission,
            });
        }
        else {
            void this._queueApprovalApprovedAsync(approval, actor.id, comment);
            // Freeze the signed artifact once, post-commit. Dynamic import avoids the
            // audit↔workflow module cycle (the audit generator imports this service);
            // it resolves fine at runtime, long after startup. Fire-and-forget.
            void Promise.resolve().then(() => __importStar(require('../../../../audit/approval-signature/service/implementation/approval-signed-document.service'))).then((m) => m.approvalSignedDocumentService.generateForCompletedApproval(approvalId))
                .catch((err) => logger_util_1.logger.warn('Approval freeze enqueue failed', { approvalId, err }));
            // A final working-paper / finding-closure approval may complete an engagement
            // gate — reconcile its status post-commit. Dynamic import avoids the
            // audit↔workflow module cycle (same pattern as the signed-document freeze).
            if (approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper ||
                approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditFindingClosure) {
                const reconcileEntityType = approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper
                    ? 'audit_working_paper'
                    : 'audit_finding_closure';
                void Promise.resolve().then(() => __importStar(require('../../../../audit/engagement/service/implementation/engagement-status.reconciler'))).then((m) => m.reconcileEngagementForApprovalEntity(reconcileEntityType, approval.entity_id, actor.id))
                    .catch((err) => logger_util_1.logger.warn('Engagement reconcile after approval failed', { approvalId, err }));
            }
        }
        logger_util_1.logger.info('Workflow approval step approved', { approvalId, approverId: actor.id, edited: !!edits });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.approval.approve',
            module: 'workflow',
            entityType: approval.entity_type,
            entityId: approval.entity_id,
            newValues: { approvalId, comment, editedFields: edits ? Object.keys(edits) : undefined },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(updated);
    }
    async reject(approvalId, actor, reason) {
        const approval = await this._getPendingApproval(approvalId);
        const currentStep = this._getActionableStep(approval, actor);
        const now = new Date();
        const updated = await prisma_client_1.prisma.$transaction(async (tx) => {
            // Atomically claim the step (see approve): the loser of a concurrent
            // approve/reject on the same step matches 0 rows and aborts.
            const claimed = await tx.workflow_Approval_Step.updateMany({
                where: { id: currentStep.id, status: workflow_enum_1.WorkflowApprovalStepStatus.Pending },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStepStatus.Rejected,
                    approver_id: actor.id,
                    comment: reason,
                    acted_at: now,
                },
            });
            if (claimed.count === 0) {
                throw app_error_1.AppError.conflict('This approval step has already been actioned');
            }
            await tx.workflow_Approval.update({
                where: { id: approvalId },
                data: {
                    status: workflow_enum_1.WorkflowApprovalStatus.Rejected,
                    rejection_reason: reason,
                    completed_at: now,
                },
            });
            await this.approvalStatusService.markRejected(tx, approval.entity_type, approval.entity_id, actor.id, reason);
            return tx.workflow_Approval.findUniqueOrThrow({
                where: { id: approvalId },
                include: approvalInclude,
            });
        }, { timeout: 15000 });
        void this._queueApprovalRejectedAsync(approval, actor.id, reason);
        logger_util_1.logger.info('Workflow approval rejected', { approvalId, approverId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'workflow.approval.reject',
            module: 'workflow',
            entityType: approval.entity_type,
            entityId: approval.entity_id,
            newValues: { approvalId, reason },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(updated);
    }
    /**
     * When an engagement's manager changes, any already-created approval steps
     * pinned to the OLD manager (ENGAGEMENT_MANAGER_APPROVER levels — see
     * `_resolveApproverChain`) are stuck: unlike permission-pool levels, a pinned
     * level has no active-holder fallback. Migrate every still-pending pinned step
     * on this engagement's working papers / reports / finding closures to the new
     * manager so the approval can still be actioned.
     */
    async reassignEngagementManagerApprovals(engagementId, oldManagerId, newManagerId, tx = prisma_client_1.prisma) {
        if (oldManagerId === newManagerId)
            return 0;
        const [papers, reports, findings] = await Promise.all([
            tx.audit_Working_Paper.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
            tx.audit_Report.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
            tx.audit_Finding.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
        ]);
        const entityIds = [
            ...papers.map((p) => p.id),
            ...reports.map((r) => r.id),
            ...findings.map((f) => f.id),
        ];
        if (entityIds.length === 0)
            return 0;
        const result = await tx.workflow_Approval_Step.updateMany({
            where: {
                approver_id: oldManagerId,
                status: workflow_enum_1.WorkflowApprovalStepStatus.Pending,
                approval: { entity_id: { in: entityIds }, status: workflow_enum_1.WorkflowApprovalStatus.Pending },
            },
            data: { approver_id: newManagerId },
        });
        if (result.count > 0) {
            logger_util_1.logger.info('Pinned engagement-manager approval steps reassigned', {
                engagementId, oldManagerId, newManagerId, stepsReassigned: result.count,
            });
            audit_log_service_1.auditLogService.logAsync({
                userId: newManagerId,
                action: 'workflow.approval.reassign_manager',
                module: 'workflow',
                entityType: 'audit_engagement',
                entityId: engagementId,
                newValues: { oldManagerId, newManagerId, stepsReassigned: result.count },
            });
        }
        return result.count;
    }
    async getApprovalById(approvalId, actor) {
        const approval = await prisma_client_1.prisma.workflow_Approval.findUnique({
            where: { id: approvalId },
            include: approvalInclude,
        });
        if (!approval)
            throw app_error_1.AppError.notFound('Workflow approval');
        if (actor)
            await this._assertCanViewApproval(approval, actor);
        return (0, approval_response_dto_1.mapApprovalToResponse)(approval);
    }
    async getApprovalByEntity(entityType, entityId, actor) {
        const approval = await prisma_client_1.prisma.workflow_Approval.findFirst({
            where: { entity_type: entityType, entity_id: entityId },
            include: approvalInclude,
            orderBy: { created_at: 'desc' },
        });
        if (!approval)
            throw app_error_1.AppError.notFound('Workflow approval');
        if (actor)
            await this._assertCanViewApproval(approval, actor);
        return (0, approval_response_dto_1.mapApprovalToResponse)(approval);
    }
    async getPendingApprovalsForUser(actor, pagination) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(pagination);
        // A user sees a step if it is pinned to them, or it is an open permission-pool
        // step whose required permission they hold.
        const orConditions = [{ approver_id: actor.id }];
        if (actor.permissions.length > 0) {
            orConditions.push({ approver_id: null, required_permission: { in: actor.permissions } });
        }
        const candidateSteps = await prisma_client_1.prisma.workflow_Approval_Step.findMany({
            where: {
                status: workflow_enum_1.WorkflowApprovalStepStatus.Pending,
                approval: { status: workflow_enum_1.WorkflowApprovalStatus.Pending },
                OR: orConditions,
            },
            include: { approval: { include: approvalInclude } },
            orderBy: { created_at: 'asc' },
        });
        // Only the current-level step is actionable; dedupe to one entry per approval.
        const approvalsById = new Map();
        for (const step of candidateSteps) {
            if (step.level === step.approval.current_level) {
                approvalsById.set(step.approval.id, step.approval);
            }
        }
        const approvals = [...approvalsById.values()];
        const paged = approvals.slice(skip, skip + take);
        return {
            approvals: await Promise.all(paged.map((a) => this._toEnrichedResponse(a))),
            meta: (0, api_response_type_1.buildPaginationMeta)(approvals.length, page, pageSize),
        };
    }
    async getApprovalHistoryForUser(actor, pagination) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(pagination);
        // Approvals the user submitted or acted on, that have reached a terminal state.
        const where = {
            status: { not: workflow_enum_1.WorkflowApprovalStatus.Pending },
            OR: [
                { submitted_by_id: actor.id },
                { steps: { some: { approver_id: actor.id, status: { in: [workflow_enum_1.WorkflowApprovalStepStatus.Approved, workflow_enum_1.WorkflowApprovalStepStatus.Rejected] } } } },
            ],
        };
        const [total, approvals] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.workflow_Approval.count({ where }),
            prisma_client_1.prisma.workflow_Approval.findMany({
                where,
                include: approvalInclude,
                orderBy: { completed_at: 'desc' },
                skip,
                take,
            }),
        ]);
        return {
            approvals: await Promise.all(approvals.map((a) => this._toEnrichedResponse(a))),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async listSignedDocuments(approvalId, actor) {
        if (actor)
            await this.getApprovalById(approvalId, actor);
        const rows = await prisma_client_1.prisma.workflow_Approval_Signed_Document.findMany({
            where: { approval_id: approvalId },
            orderBy: { generated_at: 'asc' },
        });
        return rows.map((r) => ({
            id: r.id,
            signedDocumentId: r.signed_document_id,
            downloadUrl: `/api/proxy/documents/${r.signed_document_id}/file`,
            generatedAt: r.generated_at.toISOString(),
        }));
    }
    async cancelApproval(approvalId, cancelledBy) {
        (0, workflow_utility_1.assertHasPermission)(cancelledBy.permissions, 'approval:cancel');
        const approval = await this._getPendingApproval(approvalId);
        const updated = await prisma_client_1.prisma.workflow_Approval.update({
            where: { id: approvalId },
            data: {
                status: workflow_enum_1.WorkflowApprovalStatus.Cancelled,
                completed_at: new Date(),
            },
            include: approvalInclude,
        });
        const recipientIds = new Set();
        for (const step of approval.steps) {
            const ids = await this._stepRecipientIds({
                approverId: step.approver_id,
                requiredPermission: step.required_permission,
            });
            ids.forEach((id) => recipientIds.add(id));
        }
        recipientIds.forEach((recipientId) => this._queueNotification(recipientId, {
            title: 'Approval cancelled',
            body: `The ${approval.entity_type} approval request has been cancelled.`,
            type: 'warning',
            referenceType: 'workflow_approval',
            referenceId: approvalId,
        }));
        logger_util_1.logger.info('Workflow approval cancelled', { approvalId, actorId: cancelledBy.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: cancelledBy.id,
            action: 'workflow.approval.cancel',
            module: 'workflow',
            entityType: approval.entity_type,
            entityId: approval.entity_id,
            newValues: { approvalId },
        });
        return (0, approval_response_dto_1.mapApprovalToResponse)(updated);
    }
    async resolveChainForEntity(entityType, entityId, actor) {
        const approval = await prisma_client_1.prisma.workflow_Approval.findFirst({
            where: { entity_type: entityType, entity_id: entityId },
            include: approvalInclude,
            orderBy: { created_at: 'desc' },
        });
        // Case A: an approval exists — render its actual steps as people.
        if (approval) {
            if (actor)
                await this._assertCanViewApproval(approval, actor);
            const levels = [];
            for (const step of approval.steps) {
                const acted = step.status === 'approved' || step.status === 'rejected';
                const status = acted
                    ? step.status
                    : approval.status === 'pending' && step.level === approval.current_level
                        ? 'pending'
                        : 'upcoming';
                if (step.approver) {
                    // Pinned, or already acted by a specific person.
                    levels.push({
                        level: step.level, kind: 'person', status,
                        requiredPermission: step.required_permission,
                        resolvedApprover: (0, approval_response_dto_1.mapWorkflowUserBrief)(step.approver), candidates: [],
                    });
                }
                else {
                    // Open permission pool, not yet acted — show candidate holders.
                    const candidates = step.required_permission ? await this._activeHoldersBrief(step.required_permission) : [];
                    levels.push({
                        level: step.level, kind: 'permission', status,
                        requiredPermission: step.required_permission, resolvedApprover: null, candidates,
                    });
                }
            }
            return {
                entityType, entityId, exists: true,
                status: approval.status, currentLevel: approval.current_level, levels,
            };
        }
        // Case B: no approval yet — render the prospective chain from the matrix.
        if (actor)
            await this._assertCanViewApprovalEntity(entityType, entityId, actor);
        const matrix = await (0, audit_config_utility_1.getApprovalMatrix)();
        const chain = this._chainForEntity(matrix, entityType);
        const managerId = await this._resolveEngagementManager(prisma_client_1.prisma, entityType, entityId).catch(() => null);
        const levels = [];
        let level = 1;
        for (const entry of chain) {
            if (entry === audit_config_utility_1.ENGAGEMENT_MANAGER_APPROVER) {
                const manager = managerId
                    ? await prisma_client_1.prisma.user.findUnique({ where: { id: managerId }, select: workflowUserSelect })
                    : null;
                levels.push({
                    level, kind: 'person', status: 'upcoming',
                    requiredPermission: ENGAGEMENT_MANAGER_PERMISSION[entityType] ?? null,
                    resolvedApprover: manager ? (0, approval_response_dto_1.mapWorkflowUserBrief)(manager) : null, candidates: [],
                });
            }
            else {
                levels.push({
                    level, kind: 'permission', status: 'upcoming',
                    requiredPermission: entry, resolvedApprover: null,
                    candidates: await this._activeHoldersBrief(entry),
                });
            }
            level += 1;
        }
        return { entityType, entityId, exists: false, status: null, currentLevel: null, levels };
    }
    async _resolveApproverChain(db, entityType, entityId) {
        const matrix = await (0, audit_config_utility_1.getApprovalMatrix)();
        const chain = this._chainForEntity(matrix, entityType);
        if (chain.length === 0)
            return [];
        // Engagement-bound entities pin levels marked ENGAGEMENT_MANAGER_APPROVER to
        // the engagement's assigned manager (a specific person), so the manager who
        // owns the engagement reviews its working paper / report.
        const engagementManagerId = await this._resolveEngagementManager(db, entityType, entityId);
        const managerPermission = ENGAGEMENT_MANAGER_PERMISSION[entityType];
        const specs = [];
        for (const level of chain) {
            if (level === audit_config_utility_1.ENGAGEMENT_MANAGER_APPROVER) {
                if (!engagementManagerId) {
                    throw app_error_1.AppError.badRequest(`No engagement manager available for ${entityType} approval`);
                }
                if (!managerPermission) {
                    throw app_error_1.AppError.badRequest(`No approver permission configured for ${entityType} manager approval`);
                }
                // Pinned to the engagement's manager, who must still hold the permission to act.
                specs.push({ approverId: engagementManagerId, requiredPermission: managerPermission });
                continue;
            }
            // `level` is a permission slug: any active holder may act. Ensure at least
            // one exists so the level can't dead-end.
            const hasHolder = await this._hasActiveUserWithPermission(db, level);
            if (!hasHolder) {
                throw app_error_1.AppError.badRequest(`No active user holding permission '${level}' is available for ${entityType} approval`);
            }
            specs.push({ approverId: null, requiredPermission: level });
        }
        return specs;
    }
    _chainForEntity(matrix, entityType) {
        switch (entityType) {
            case workflow_enum_1.WorkflowEntityType.AuditPlan:
                return matrix.auditPlan;
            case workflow_enum_1.WorkflowEntityType.AuditWorkingPaper:
                return matrix.workingPaper;
            case workflow_enum_1.WorkflowEntityType.AuditReport:
                return matrix.auditReport;
            case workflow_enum_1.WorkflowEntityType.AuditFindingClosure:
                return matrix.findingClosure;
            default:
                return [];
        }
    }
    async _resolveEngagementManager(db, entityType, entityId) {
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper) {
            const paper = await db.audit_Working_Paper.findFirst({
                where: { id: entityId, deleted_at: null },
                select: { engagement: { select: { audit_manager_id: true } } },
            });
            if (!paper)
                throw app_error_1.AppError.notFound('Audit working paper');
            return paper.engagement.audit_manager_id;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditReport) {
            const report = await db.audit_Report.findFirst({
                where: { id: entityId, deleted_at: null },
                select: { engagement: { select: { audit_manager_id: true } } },
            });
            if (!report)
                throw app_error_1.AppError.notFound('Audit report');
            return report.engagement.audit_manager_id;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditFindingClosure) {
            const finding = await db.audit_Finding.findFirst({
                where: { id: entityId, deleted_at: null },
                select: { engagement: { select: { audit_manager_id: true } } },
            });
            if (!finding)
                throw app_error_1.AppError.notFound('Audit finding');
            return finding.engagement.audit_manager_id;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditPlan) {
            const plan = await db.audit_Plan.findFirst({ where: { id: entityId, deleted_at: null }, select: { id: true } });
            if (!plan)
                throw app_error_1.AppError.notFound('Audit plan');
        }
        return null;
    }
    async _hasActiveUserWithPermission(db, permissionSlug) {
        const user = await db.user.findFirst({
            where: this._activeHolderWhere(permissionSlug),
            select: { id: true },
        });
        return user !== null;
    }
    /** All active users who currently hold a permission — the pool that can act on a pool level. */
    async _stepRecipientIds(step) {
        if (step.approverId)
            return [step.approverId];
        if (!step.requiredPermission)
            return [];
        const users = await prisma_client_1.prisma.user.findMany({
            where: this._activeHolderWhere(step.requiredPermission),
            select: { id: true },
        });
        return users.map((user) => user.id);
    }
    _activeHolderWhere(permissionSlug) {
        return {
            deleted_at: null,
            is_active: true,
            user_roles: {
                some: {
                    role: { role_permissions: { some: { permission: { slug: permissionSlug } } } },
                },
            },
        };
    }
    /** All active users who currently hold a permission, resolved to display-ready briefs. */
    async _activeHoldersBrief(permissionSlug) {
        const users = await prisma_client_1.prisma.user.findMany({
            where: this._activeHolderWhere(permissionSlug),
            select: workflowUserSelect,
            orderBy: { display_name: 'asc' },
        });
        return users.map(approval_response_dto_1.mapWorkflowUserBrief);
    }
    async _getPendingApproval(approvalId) {
        const approval = await prisma_client_1.prisma.workflow_Approval.findUnique({
            where: { id: approvalId },
            include: approvalInclude,
        });
        if (!approval)
            throw app_error_1.AppError.notFound('Workflow approval');
        if (approval.status !== workflow_enum_1.WorkflowApprovalStatus.Pending) {
            throw app_error_1.AppError.badRequest('Only pending approvals can be acted on');
        }
        return approval;
    }
    _getActionableStep(approval, actor) {
        const step = approval.steps.find((item) => item.level === approval.current_level);
        if (!step)
            throw app_error_1.AppError.badRequest('Approval has no pending current step');
        if (step.status !== workflow_enum_1.WorkflowApprovalStepStatus.Pending) {
            throw app_error_1.AppError.badRequest('Current approval step has already been actioned');
        }
        // A step always requires its permission. A pinned step additionally requires
        // the actor to be that specific user (the engagement's manager); a pool step
        // is open to any holder of the permission.
        const holdsPermission = !step.required_permission || actor.permissions.includes(step.required_permission);
        const isPinnedApprover = step.approver_id === null || step.approver_id === actor.id;
        if (!holdsPermission || !isPinnedApprover) {
            throw app_error_1.AppError.forbidden('You are not authorized to act on the current approval step');
        }
        return step;
    }
    async _assertCanViewApproval(approval, actor) {
        if (actor.permissions.includes('engagement:read_all'))
            return;
        if (approval.submitted_by_id === actor.id)
            return;
        if (approval.steps.some((step) => step.approver_id === actor.id ||
            (step.approver_id === null && !!step.required_permission && actor.permissions.includes(step.required_permission)))) {
            return;
        }
        await this._assertCanViewApprovalEntity(approval.entity_type, approval.entity_id, actor);
    }
    async _assertCanViewApprovalEntity(entityType, entityId, actor) {
        if (actor.permissions.includes('engagement:read_all'))
            return;
        const teamWhere = {
            OR: [
                { lead_auditor_id: actor.id },
                { audit_manager_id: actor.id },
                { workflow_assignments: { some: { user_id: actor.id } } },
            ],
        };
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper) {
            const count = await prisma_client_1.prisma.audit_Working_Paper.count({
                where: { id: entityId, deleted_at: null, engagement: teamWhere },
            });
            if (count > 0)
                return;
            throw app_error_1.AppError.forbidden('You do not have access to this approval');
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditReport) {
            const count = await prisma_client_1.prisma.audit_Report.count({
                where: { id: entityId, deleted_at: null, engagement: teamWhere },
            });
            if (count > 0)
                return;
            throw app_error_1.AppError.forbidden('You do not have access to this approval');
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditFindingClosure) {
            const count = await prisma_client_1.prisma.audit_Finding.count({
                where: { id: entityId, deleted_at: null, engagement: teamWhere },
            });
            if (count > 0)
                return;
            throw app_error_1.AppError.forbidden('You do not have access to this approval');
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditPlan && actor.permissions.includes('audit_plan:approve'))
            return;
        throw app_error_1.AppError.forbidden('You do not have access to this approval');
    }
    async _notifyUser(userId, notification, context = {}) {
        const user = await prisma_client_1.prisma.user.findFirst({
            where: { id: userId, deleted_at: null, is_active: true },
            select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
        });
        if (!user)
            return;
        const recipientName = user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
        const variables = context.variables
            ? { recipientName, ...context.variables }
            : undefined;
        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
            userId: user.id,
            title: notification.title,
            body: notification.body,
            type: notification.type,
            referenceType: notification.referenceType,
            referenceId: notification.referenceId,
            eventKey: context.eventKey,
            variables,
        });
        await notification_queue_service_1.notificationQueueService.enqueue('email', {
            to: user.email,
            subject: notification.title,
            text: notification.body,
            eventKey: context.eventKey,
            variables,
        });
    }
    _queueNotification(userId, notification, context = {}) {
        void this._notifyUser(userId, notification, context).catch((err) => {
            logger_util_1.logger.warn('Workflow approval notification failed', { err, userId });
        });
    }
    /**
     * List-endpoint enrichment: attach a human-readable entity title and the
     * parent engagement id so the inbox can show *what* is being approved and
     * link to it, instead of a bare entity type.
     */
    async _toEnrichedResponse(approval) {
        const base = (0, approval_response_dto_1.mapApprovalToResponse)(approval);
        let entityTitle = null;
        let engagementId = null;
        try {
            if (approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditReport) {
                const report = await prisma_client_1.prisma.audit_Report.findUnique({
                    where: { id: approval.entity_id },
                    select: { title: true, engagement_id: true, engagement: { select: { reference_number: true } } },
                });
                if (report) {
                    entityTitle = `${report.title} (${report.engagement.reference_number})`;
                    engagementId = report.engagement_id;
                }
            }
            else if (approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper) {
                const wp = await prisma_client_1.prisma.audit_Working_Paper.findUnique({
                    where: { id: approval.entity_id },
                    select: { title: true, engagement_id: true },
                });
                if (wp) {
                    entityTitle = wp.title;
                    engagementId = wp.engagement_id;
                }
            }
            else if (approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditFindingClosure) {
                const finding = await prisma_client_1.prisma.audit_Finding.findUnique({
                    where: { id: approval.entity_id },
                    select: { title: true, engagement_id: true, engagement: { select: { reference_number: true } } },
                });
                if (finding) {
                    entityTitle = `${finding.title} (${finding.engagement.reference_number})`;
                    engagementId = finding.engagement_id;
                }
            }
            else if (approval.entity_type === workflow_enum_1.WorkflowEntityType.AuditPlan) {
                const plan = await prisma_client_1.prisma.audit_Plan.findUnique({
                    where: { id: approval.entity_id },
                    select: { title: true },
                });
                entityTitle = plan?.title ?? null;
            }
        }
        catch (err) {
            logger_util_1.logger.warn('Failed to resolve approval entity display', { approvalId: approval.id, err });
        }
        return { ...base, entityTitle, engagementId };
    }
    async _resolveEntityReference(entityType, entityId) {
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditReport) {
            const report = await prisma_client_1.prisma.audit_Report.findUnique({
                where: { id: entityId },
                select: { title: true, engagement: { select: { reference_number: true } } },
            });
            return report?.engagement.reference_number ?? entityId;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditWorkingPaper) {
            const wp = await prisma_client_1.prisma.audit_Working_Paper.findUnique({
                where: { id: entityId },
                select: { title: true },
            });
            return wp?.title ?? entityId;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditFindingClosure) {
            const finding = await prisma_client_1.prisma.audit_Finding.findUnique({
                where: { id: entityId },
                select: { title: true, engagement: { select: { reference_number: true } } },
            });
            return finding ? `${finding.engagement.reference_number} - ${finding.title}` : entityId;
        }
        if (entityType === workflow_enum_1.WorkflowEntityType.AuditPlan) {
            const plan = await prisma_client_1.prisma.audit_Plan.findUnique({
                where: { id: entityId },
                select: { title: true },
            });
            return plan?.title ?? entityId;
        }
        return entityId;
    }
    async _resolveActorName(userId) {
        const user = await prisma_client_1.prisma.user.findUnique({
            where: { id: userId },
            select: { display_name: true, first_name: true, last_name: true },
        });
        if (!user)
            return '';
        return user.display_name ?? `${user.first_name} ${user.last_name}`.trim();
    }
}
exports.ApprovalService = ApprovalService;
exports.workflowApprovalService = new ApprovalService();
//# sourceMappingURL=approval.service.js.map