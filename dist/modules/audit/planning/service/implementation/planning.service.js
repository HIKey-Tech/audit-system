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
const audit_config_utility_1 = require("../../../utility/audit-config.utility");
const universe_response_dto_1 = require("../../../universe/dto/response/universe.response.dto");
const planning_response_dto_1 = require("../../dto/response/planning.response.dto");
const planning_utility_1 = require("../../utility/planning.utility");
const recommendations_cache_utility_1 = require("../../utility/recommendations-cache.utility");
const planInclude = {
    approved_by: { select: { display_name: true, first_name: true, last_name: true } },
    items: {
        include: { universe: true, engagements: { select: { id: true }, where: { deleted_at: null } } },
        orderBy: { created_at: 'asc' },
    },
};
const candidateOwnerSelect = { id: true, display_name: true, first_name: true, last_name: true };
class PlanningService {
    approvalService;
    constructor(approvalService = approval_service_1.workflowApprovalService) {
        this.approvalService = approvalService;
    }
    /**
     * Composite audit-priority ranking over the active audit universe — the
     * defensible "what should we audit next year" list. Each signal is scored
     * 0-100 and blended with admin-configurable weights
     * (system_config.planning_priority_weights), so GBB decides what "priority"
     * means without a redeploy. The per-entity component breakdown and reasons
     * are returned so the ranking is explainable, not a black box.
     */
    async getRecommendations() {
        const cached = (0, recommendations_cache_utility_1.getCachedRecommendations)();
        if (cached)
            return cached;
        const [weights, entities, openFindings] = await Promise.all([
            (0, audit_config_utility_1.getPlanningPriorityWeights)(),
            prisma_client_1.prisma.audit_Universe.findMany({
                where: { deleted_at: null, status: audit_enum_1.UniverseStatus.Active },
                select: {
                    id: true,
                    name: true,
                    category: true,
                    risk_score: true,
                    audit_frequency: true,
                    last_audited_at: true,
                },
            }),
            prisma_client_1.prisma.audit_Finding.findMany({
                where: {
                    deleted_at: null,
                    status: { not: audit_enum_1.FindingStatus.Closed },
                    engagement: { deleted_at: null },
                },
                select: { engagement: { select: { universe_id: true } } },
            }),
        ]);
        const openByUniverse = new Map();
        for (const finding of openFindings) {
            const key = finding.engagement.universe_id;
            openByUniverse.set(key, (openByUniverse.get(key) ?? 0) + 1);
        }
        const now = new Date();
        const sorted = entities
            .map((entity) => (0, planning_utility_1.computeEntityRecommendation)({
            id: entity.id,
            name: entity.name,
            category: entity.category,
            riskScore: (0, audit_utility_1.decimalToNumber)(entity.risk_score) ?? 0,
            auditFrequency: entity.audit_frequency,
            lastAuditedAt: entity.last_audited_at,
        }, openByUniverse.get(entity.id) ?? 0, weights, now))
            .sort((a, b) => b.score - a.score);
        (0, recommendations_cache_utility_1.setCachedRecommendations)(sorted);
        return sorted;
    }
    /**
     * Returns all active audit universe entities enriched with due-cycle classification,
     * recommended priority, owners, and existing coverage within the target programme's year.
     */
    async getUniverseCandidates(planId) {
        const plan = await prisma_client_1.prisma.audit_Plan.findFirst({
            where: { id: planId, deleted_at: null },
            select: { id: true, year: true },
        });
        if (!plan)
            throw app_error_1.AppError.notFound('Audit plan');
        const [weights, entities, openFindings, yearPlanItems] = await Promise.all([
            (0, audit_config_utility_1.getPlanningPriorityWeights)(),
            prisma_client_1.prisma.audit_Universe.findMany({
                where: { deleted_at: null, status: audit_enum_1.UniverseStatus.Active },
                include: {
                    owner: { select: candidateOwnerSelect },
                    additional_owners: {
                        include: { user: { select: candidateOwnerSelect } },
                        orderBy: { created_at: 'asc' },
                    },
                },
            }),
            prisma_client_1.prisma.audit_Finding.findMany({
                where: {
                    deleted_at: null,
                    status: { not: audit_enum_1.FindingStatus.Closed },
                    engagement: { deleted_at: null },
                },
                select: { engagement: { select: { universe_id: true } } },
            }),
            prisma_client_1.prisma.audit_Plan_Item.findMany({
                where: { plan: { year: plan.year, deleted_at: null } },
                select: {
                    universe_id: true,
                    plan_id: true,
                    plan: { select: { id: true, title: true, audit_type: true, status: true } },
                },
            }),
        ]);
        const openByUniverse = new Map();
        for (const finding of openFindings) {
            const key = finding.engagement.universe_id;
            openByUniverse.set(key, (openByUniverse.get(key) ?? 0) + 1);
        }
        const thisPlanCountByUniverse = new Map();
        const otherPlansByUniverse = new Map();
        for (const item of yearPlanItems) {
            if (item.plan_id === plan.id) {
                thisPlanCountByUniverse.set(item.universe_id, (thisPlanCountByUniverse.get(item.universe_id) ?? 0) + 1);
            }
            else {
                let mapForEntity = otherPlansByUniverse.get(item.universe_id);
                if (!mapForEntity) {
                    mapForEntity = new Map();
                    otherPlansByUniverse.set(item.universe_id, mapForEntity);
                }
                mapForEntity.set(item.plan_id, {
                    planId: item.plan.id,
                    planTitle: item.plan.title,
                    auditType: item.plan.audit_type,
                    status: item.plan.status,
                });
            }
        }
        const now = new Date();
        return entities
            .map((entity) => {
            const mapped = (0, universe_response_dto_1.mapUniverseToResponse)(entity);
            const riskScore = mapped.riskScore ?? 0;
            const openCount = openByUniverse.get(entity.id) ?? 0;
            const rec = (0, planning_utility_1.computeEntityRecommendation)({
                id: entity.id,
                name: entity.name,
                category: entity.category,
                riskScore,
                auditFrequency: entity.audit_frequency,
                lastAuditedAt: entity.last_audited_at,
            }, openCount, weights, now);
            const dueStatus = (0, planning_utility_1.classifyUniverseDueStatus)(entity.audit_frequency, entity.last_audited_at, plan.year, now);
            return {
                universeId: entity.id,
                name: entity.name,
                description: entity.description,
                category: entity.category,
                ownerName: mapped.ownerName,
                owners: mapped.owners,
                riskScore,
                auditFrequency: entity.audit_frequency,
                lastAuditedAt: mapped.lastAuditedAt,
                openFindingsCount: openCount,
                score: rec.score,
                reasons: rec.reasons,
                recommendedPriority: (0, planning_utility_1.recommendedPriorityFromRiskScore)(riskScore),
                dueStatus,
                alreadyInThisPlanCount: thisPlanCountByUniverse.get(entity.id) ?? 0,
                alreadyInYearPlans: [...(otherPlansByUniverse.get(entity.id)?.values() ?? [])],
            };
        })
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    }
    async createPlan(dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:create');
        const existingCount = await prisma_client_1.prisma.audit_Plan.count({
            where: { year: dto.year, audit_type: dto.auditType, deleted_at: null },
        });
        const plan = await prisma_client_1.prisma.audit_Plan.create({
            data: {
                title: dto.title,
                year: dto.year,
                audit_type: dto.auditType,
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
        return (0, planning_response_dto_1.mapPlanToResponse)(plan, existingCount > 0
            ? [`A ${(0, audit_utility_1.auditTypeLabel)(dto.auditType)} programme for ${dto.year} already exists`]
            : undefined);
    }
    async updatePlan(planId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:update');
        if (dto.title === undefined && dto.year === undefined && dto.description === undefined) {
            throw app_error_1.AppError.badRequest('At least one field is required');
        }
        await this._assertDraftPlan(planId);
        const before = await prisma_client_1.prisma.audit_Plan.findUnique({
            where: { id: planId },
            select: { title: true, year: true, description: true },
        });
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
            oldValues: before ?? undefined,
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
        await this._assertUniverseActive(dto.universeId);
        const created = await prisma_client_1.prisma.audit_Plan_Item.create({
            data: {
                plan_id: planId,
                universe_id: dto.universeId,
                planned_start_date: new Date(dto.plannedStartDate),
                planned_end_date: new Date(dto.plannedEndDate),
                priority: dto.priority,
                notes: dto.notes ?? null,
            },
        });
        logger_util_1.logger.info('Audit plan item added', { planId, itemId: created.id, universeId: dto.universeId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.plan.item.add',
            module: 'audit',
            entityType: 'audit_plan_item',
            entityId: created.id,
            newValues: dto,
        });
        return this.getPlanById(planId);
    }
    async bulkAddPlanItems(planId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:add_item');
        await this._assertDraftPlan(planId);
        const uniqueUniverseIds = [...new Set(dto.items.map((i) => i.universeId))];
        const universeRows = await prisma_client_1.prisma.audit_Universe.findMany({
            where: { id: { in: uniqueUniverseIds }, deleted_at: null },
            select: { id: true, name: true, status: true },
        });
        const byId = new Map(universeRows.map((u) => [u.id, u]));
        for (const universeId of uniqueUniverseIds) {
            const entity = byId.get(universeId);
            if (!entity)
                throw app_error_1.AppError.notFound('Audit universe entity');
            if (entity.status !== audit_enum_1.UniverseStatus.Active) {
                throw app_error_1.AppError.badRequest(`Auditable entity '${entity.name}' is inactive and cannot be added to an audit programme`);
            }
        }
        await prisma_client_1.prisma.$transaction(async (tx) => {
            await tx.audit_Plan_Item.createMany({
                data: dto.items.map((item) => ({
                    plan_id: planId,
                    universe_id: item.universeId,
                    planned_start_date: new Date(item.plannedStartDate),
                    planned_end_date: new Date(item.plannedEndDate),
                    priority: item.priority,
                    notes: item.notes ?? null,
                })),
            });
        });
        logger_util_1.logger.info('Audit plan items bulk added', { planId, count: dto.items.length, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.plan.item.bulk_add',
            module: 'audit',
            entityType: 'audit_plan',
            entityId: planId,
            newValues: { count: dto.items.length, universeIds: uniqueUniverseIds },
        });
        return this.getPlanById(planId);
    }
    async updatePlanItem(planId, itemId, dto, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:add_item');
        await this._assertDraftPlan(planId);
        const existing = await prisma_client_1.prisma.audit_Plan_Item.findFirst({
            where: { id: itemId, plan_id: planId },
        });
        if (!existing)
            throw app_error_1.AppError.notFound('Audit plan item');
        if (existing.engagement_created) {
            throw app_error_1.AppError.badRequest('Cannot edit a plan item after an engagement has been created');
        }
        if (dto.universeId !== undefined && dto.universeId !== existing.universe_id) {
            await this._assertUniverseActive(dto.universeId);
        }
        const nextStart = dto.plannedStartDate ? new Date(dto.plannedStartDate) : existing.planned_start_date;
        const nextEnd = dto.plannedEndDate ? new Date(dto.plannedEndDate) : existing.planned_end_date;
        if (nextStart > nextEnd) {
            throw app_error_1.AppError.badRequest('Planned end date must be on or after planned start date');
        }
        const updated = await prisma_client_1.prisma.audit_Plan_Item.update({
            where: { id: itemId },
            data: {
                ...(dto.universeId !== undefined && { universe_id: dto.universeId }),
                ...(dto.plannedStartDate !== undefined && { planned_start_date: nextStart }),
                ...(dto.plannedEndDate !== undefined && { planned_end_date: nextEnd }),
                ...(dto.priority !== undefined && { priority: dto.priority }),
                ...(dto.notes !== undefined && { notes: dto.notes }),
            },
        });
        logger_util_1.logger.info('Audit plan item updated', { planId, itemId, actorId: actor.id });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.plan.item.update',
            module: 'audit',
            entityType: 'audit_plan_item',
            entityId: itemId,
            oldValues: {
                universeId: existing.universe_id,
                priority: existing.priority,
                plannedStartDate: existing.planned_start_date.toISOString(),
                plannedEndDate: existing.planned_end_date.toISOString(),
                notes: existing.notes,
            },
            newValues: {
                universeId: updated.universe_id,
                priority: updated.priority,
                plannedStartDate: updated.planned_start_date.toISOString(),
                plannedEndDate: updated.planned_end_date.toISOString(),
                notes: updated.notes,
            },
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
            oldValues: {
                planId,
                universeId: item.universe_id,
                priority: item.priority,
                plannedStartDate: item.planned_start_date.toISOString(),
                plannedEndDate: item.planned_end_date.toISOString(),
                notes: item.notes,
            },
        });
    }
    async submitPlanForApproval(planId, actor) {
        (0, audit_utility_1.assertHasPermission)(actor.permissions, 'plan:submit');
        const plan = await this._getPlanForMutation(planId);
        if (!audit_utility_1.PLAN_EDITABLE_STATUSES.includes(plan.status)) {
            throw app_error_1.AppError.badRequest('Only draft or rejected plans can be submitted');
        }
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
            ...(query.auditType && { audit_type: query.auditType }),
            // SQL Server's default collation is case-insensitive, so `contains`
            // already behaves the way users expect from a search box.
            ...(query.search && { title: { contains: query.search } }),
        };
        const [total, plans] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.audit_Plan.count({ where }),
            prisma_client_1.prisma.audit_Plan.findMany({
                where,
                include: {
                    _count: { select: { items: true } },
                    approved_by: { select: { display_name: true, first_name: true, last_name: true } },
                },
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
        if (!audit_utility_1.PLAN_EDITABLE_STATUSES.includes(plan.status)) {
            throw app_error_1.AppError.badRequest('Plan must be in draft or rejected status to be changed');
        }
    }
    async _assertUniverseActive(universeId) {
        const universe = await prisma_client_1.prisma.audit_Universe.findFirst({
            where: { id: universeId, deleted_at: null },
            select: { id: true, name: true, status: true },
        });
        if (!universe)
            throw app_error_1.AppError.notFound('Audit universe entity');
        if (universe.status !== audit_enum_1.UniverseStatus.Active) {
            throw app_error_1.AppError.badRequest(`Auditable entity '${universe.name}' is inactive and cannot be added to an audit programme`);
        }
    }
}
exports.PlanningService = PlanningService;
//# sourceMappingURL=planning.service.js.map