"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const api_response_type_1 = require("../../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const approval_service_1 = require("../../../../workflow/approval/service/implementation/approval.service");
const workflow_enum_1 = require("../../../../workflow/domain/enum/workflow.enum");
const audit_enum_1 = require("../../../domain/enum/audit.enum");
const audit_utility_1 = require("../../../utility/audit.utility");
const planning_response_dto_1 = require("../../dto/response/planning.response.dto");
const planInclude = {
    approved_by: { select: { display_name: true, first_name: true, last_name: true } },
    items: {
        include: { universe: true, engagements: { select: { id: true }, where: { deleted_at: null } } },
        orderBy: { created_at: 'asc' },
    },
};
class PlanningService {
    approvalService;
    constructor(approvalService = approval_service_1.workflowApprovalService) {
        this.approvalService = approvalService;
    }
    async createPlan(dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:create');
        const existingCount = await prisma_client_1.prisma.audit_Plan.count({
            where: { year: dto.year, deleted_at: null },
        });
        const plan = await prisma_client_1.prisma.audit_Plan.create({
            data: {
                title: dto.title,
                year: dto.year,
                description: dto.description ?? null,
                created_by_id: actor.id,
            },
            include: planInclude,
        });
        logger_util_1.logger.info('Audit plan created', { planId: plan.id, year: plan.year, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.plan.create',
            module: 'audit',
            entityType: 'audit_plan',
            entityId: plan.id,
        });
        return (0, planning_response_dto_1.mapPlanToResponse)(plan, existingCount > 0 ? [`A plan for ${dto.year} already exists`] : undefined);
    }
    async updatePlan(planId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:update');
        if (dto.title === undefined && dto.year === undefined && dto.description === undefined) {
            throw app_error_1.AppError.badRequest('At least one field is required');
        }
        await this._assertDraftPlan(planId);
        const updated = await prisma_client_1.prisma.audit_Plan.update({
            where: { id: planId },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.year !== undefined && { year: dto.year }),
                ...(dto.description !== undefined && { description: dto.description }),
            },
            include: planInclude,
        });
        logger_util_1.logger.info('Audit plan updated', { planId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.plan.update',
            module: 'audit',
            entityType: 'audit_plan',
            entityId: planId,
            newValues: dto,
        });
        return (0, planning_response_dto_1.mapPlanToResponse)(updated);
    }
    async deletePlan(planId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:update');
        await this._assertDraftPlan(planId);
        const engagementCount = await prisma_client_1.prisma.audit_Engagement.count({
            where: {
                deleted_at: null,
                plan_item: { plan_id: planId },
            },
        });
        if (engagementCount > 0) {
            throw app_error_1.AppError.badRequest('Cannot delete a plan after engagements have been created from it');
        }
        await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Plan_Item.deleteMany({ where: { plan_id: planId } }),
            prisma_client_1.prisma.audit_Plan.update({
                where: { id: planId },
                data: { deleted_at: new Date() },
            }),
        ]);
        logger_util_1.logger.info('Audit plan deleted', { planId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.plan.delete',
            module: 'audit',
            entityType: 'audit_plan',
            entityId: planId,
        });
    }
    async addPlanItem(planId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:add_item');
        await this._assertDraftPlan(planId);
        await this._assertUniverseExists(dto.universeId);
        await prisma_client_1.prisma.audit_Plan_Item.create({
            data: {
                plan_id: planId,
                universe_id: dto.universeId,
                audit_type: dto.auditType,
                planned_start_date: new Date(dto.plannedStartDate),
                planned_end_date: new Date(dto.plannedEndDate),
                priority: dto.priority,
                notes: dto.notes ?? null,
            },
        });
        logger_util_1.logger.info('Audit plan item added', { planId, universeId: dto.universeId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.plan.item.add',
            module: 'audit',
            entityType: 'audit_plan',
            entityId: planId,
            newValues: dto,
        });
        return this.getPlanById(planId);
    }
    async removePlanItem(planId, itemId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:add_item');
        await this._assertDraftPlan(planId);
        const item = await prisma_client_1.prisma.audit_Plan_Item.findFirst({
            where: { id: itemId, plan_id: planId },
        });
        if (!item)
            throw app_error_1.AppError.notFound('Audit plan item');
        if (item.engagement_created) {
            throw app_error_1.AppError.badRequest('Cannot remove a plan item after an engagement has been created');
        }
        await prisma_client_1.prisma.audit_Plan_Item.delete({ where: { id: itemId } });
        logger_util_1.logger.info('Audit plan item removed', { planId, itemId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.plan.item.remove',
            module: 'audit',
            entityType: 'audit_plan_item',
            entityId: itemId,
        });
    }
    async submitPlanForApproval(planId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:submit');
        const plan = await this._getPlanForMutation(planId);
        if (plan.status !== audit_enum_1.PlanStatus.Draft)
            throw app_error_1.AppError.badRequest('Only draft plans can be submitted');
        if (plan.items.length === 0)
            throw app_error_1.AppError.badRequest('Plan must have at least one item before submission');
        const { submittedPlan, approval } = await prisma_client_1.prisma.$transaction(async (tx) => {
            const submittedPlan = await tx.audit_Plan.update({
                where: { id: planId },
                data: { status: audit_enum_1.PlanStatus.Submitted, rejection_reason: null },
                include: planInclude,
            });
            const approval = await this.approvalService.createApproval({
                entityType: workflow_enum_1.WorkflowEntityType.AuditPlan,
                entityId: planId,
            }, actor, tx);
            return { submittedPlan, approval };
        }, { timeout: 15000 });
        this.approvalService.queueApprovalRequiredNotification(approval);
        logger_util_1.logger.info('Audit plan submitted', { planId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.plan.submit', module: 'audit', entityType: 'audit_plan', entityId: planId });
        return (0, planning_response_dto_1.mapPlanToResponse)(submittedPlan);
    }
    async approvePlan(planId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:approve');
        const plan = await this._getPlanForMutation(planId);
        if (plan.status !== audit_enum_1.PlanStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted plans can be approved');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditPlan, planId);
        await this.approvalService.approve(approval.id, actor);
        const updated = await this.getPlanById(planId);
        logger_util_1.logger.info('Audit plan approved', { planId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.plan.approve', module: 'audit', entityType: 'audit_plan', entityId: planId });
        return updated;
    }
    async rejectPlan(planId, reason, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:reject');
        const plan = await this._getPlanForMutation(planId);
        if (plan.status !== audit_enum_1.PlanStatus.Submitted)
            throw app_error_1.AppError.badRequest('Only submitted plans can be rejected');
        const approval = await this.approvalService.getApprovalByEntity(workflow_enum_1.WorkflowEntityType.AuditPlan, planId);
        await this.approvalService.reject(approval.id, actor, reason);
        const updated = await this.getPlanById(planId);
        logger_util_1.logger.info('Audit plan rejected', { planId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({ userId: actor.id, action: 'audit.plan.reject', module: 'audit', entityType: 'audit_plan', entityId: planId, newValues: { reason } });
        return updated;
    }
    async getPlanById(id) {
        const plan = await prisma_client_1.prisma.audit_Plan.findFirst({
            where: { id, deleted_at: null },
            include: planInclude,
        });
        if (!plan)
            throw app_error_1.AppError.notFound('Audit plan');
        return (0, planning_response_dto_1.mapPlanToResponse)(plan);
    }
    async listPlans(query) {
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            deleted_at: null,
            ...(query.status && { status: query.status }),
            ...(query.year !== undefined && { year: query.year }),
        };
        const [total, plans] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Plan.count({ where }),
            prisma_client_1.prisma.audit_Plan.findMany({
                where,
                include: { _count: { select: { items: true } } },
                orderBy: { [query.sortBy]: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return { plans: plans.map((plan) => (0, planning_response_dto_1.mapPlanToResponse)(plan)), meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize) };
    }
    async _getPlanForMutation(planId) {
        const plan = await prisma_client_1.prisma.audit_Plan.findFirst({
            where: { id: planId, deleted_at: null },
            include: { items: true },
        });
        if (!plan)
            throw app_error_1.AppError.notFound('Audit plan');
        return plan;
    }
    async _assertDraftPlan(planId) {
        const plan = await prisma_client_1.prisma.audit_Plan.findFirst({
            where: { id: planId, deleted_at: null },
            select: { status: true },
        });
        if (!plan)
            throw app_error_1.AppError.notFound('Audit plan');
        if (plan.status !== audit_enum_1.PlanStatus.Draft)
            throw app_error_1.AppError.badRequest('Plan must be in draft status');
    }
    async _assertUniverseExists(universeId) {
        const universe = await prisma_client_1.prisma.audit_Universe.findFirst({
            where: { id: universeId, deleted_at: null },
            select: { id: true },
        });
        if (!universe)
            throw app_error_1.AppError.notFound('Audit universe entity');
    }
}
exports.PlanningService = PlanningService;
//# sourceMappingURL=planning.service.js.map