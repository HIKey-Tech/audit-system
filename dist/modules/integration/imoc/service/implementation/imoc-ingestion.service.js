"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imocIngestionService = exports.ImocIngestionService = void 0;
const prisma_client_1 = require("../../../../../shared/prisma/prisma.client");
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../../shared/config/app.config");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const imoc_response_dto_1 = require("../../dto/response/imoc.response.dto");
const imoc_client_1 = require("../client/imoc.client");
const imoc_utility_1 = require("../../utility/imoc.utility");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class ImocIngestionService {
    prisma;
    client;
    inProgress = false;
    constructor(prisma = prisma_client_1.prisma, client = (0, imoc_client_1.createImocClient)()) {
        this.prisma = prisma;
        this.client = client;
    }
    async runIngestion(trigger, actorId) {
        const startTime = Date.now();
        if (!app_config_1.config.imoc.enabled || !this.client.configured) {
            logger_util_1.logger.info('IMOC ingestion skipped: client disabled or not configured');
            return {
                runId: '',
                status: 'skipped',
                trigger,
                rulesEvaluated: 0,
                fetched: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                errors: ['IMOC client is disabled or not configured.'],
                durationMs: 0,
            };
        }
        // In-process lock
        if (this.inProgress) {
            logger_util_1.logger.warn('IMOC ingestion run already in progress within this process');
            return {
                runId: '',
                status: 'skipped',
                trigger,
                rulesEvaluated: 0,
                fetched: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                errors: ['An ingestion run is already executing in this process.'],
                durationMs: 0,
            };
        }
        // DB overlapping run check (running within the last 30 minutes)
        const activeRun = await this.prisma.imoc_Ingestion_Run.findFirst({
            where: {
                status: 'running',
                started_at: {
                    gt: new Date(Date.now() - 30 * 60 * 1000),
                },
            },
        });
        if (activeRun) {
            logger_util_1.logger.warn('IMOC ingestion run already active in database', {
                activeRunId: activeRun.id,
            });
            return {
                runId: activeRun.id,
                status: 'skipped',
                trigger,
                rulesEvaluated: 0,
                fetched: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                errors: ['An active ingestion run is currently in progress.'],
                durationMs: 0,
            };
        }
        this.inProgress = true;
        // Create run record
        const run = await this.prisma.imoc_Ingestion_Run.create({
            data: {
                trigger,
                triggered_by_id: actorId ?? null,
                status: 'running',
                started_at: new Date(),
            },
        });
        const errors = [];
        let totalFetched = 0;
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        try {
            // Find active rules sorted by priority ASC (lower number = higher priority)
            const rules = await this.prisma.imoc_Ingestion_Rule.findMany({
                where: {
                    is_active: true,
                    deleted_at: null,
                },
                orderBy: {
                    priority: 'asc',
                },
            });
            // Map to accumulate tickets across all rules
            const accumulatedTickets = new Map();
            const delayBetweenRequests = Math.max(10, Math.ceil(1000 / (app_config_1.config.imoc.ingestRequestsPerSecond || 20)));
            for (const rule of rules) {
                let ruleFetched = 0;
                let ruleIngested = 0;
                try {
                    const rawCriteria = typeof rule.criteria_json === 'string'
                        ? JSON.parse(rule.criteria_json)
                        : rule.criteria_json;
                    const criteria = (0, imoc_utility_1.validateRuleCriteria)(rawCriteria);
                    const queries = (0, imoc_utility_1.buildUpstreamQueries)(criteria, rule.lookback_days, app_config_1.config.imoc.timestampsUtc);
                    for (const baseQuery of queries) {
                        let page = 1;
                        let hasNext = true;
                        const maxPages = app_config_1.config.imoc.ingestMaxPages || 50;
                        while (hasNext && page <= maxPages) {
                            const query = {
                                ...baseQuery,
                                page,
                                pageSize: app_config_1.config.imoc.ingestPageSize || 100,
                            };
                            const pageResult = await this.client.listTickets(query);
                            ruleFetched += pageResult.items.length;
                            totalFetched += pageResult.items.length;
                            for (const ticket of pageResult.items) {
                                if ((0, imoc_utility_1.matchesRuleCriteria)(ticket, criteria)) {
                                    ruleIngested++;
                                    const existing = accumulatedTickets.get(ticket.orderId);
                                    const ruleInfo = {
                                        id: rule.id,
                                        name: rule.name,
                                        priority: rule.priority,
                                        category: rule.category,
                                    };
                                    if (existing) {
                                        if (!existing.matchedRules.some((r) => r.id === rule.id)) {
                                            existing.matchedRules.push(ruleInfo);
                                        }
                                    }
                                    else {
                                        accumulatedTickets.set(ticket.orderId, {
                                            ticket,
                                            matchedRules: [ruleInfo],
                                        });
                                    }
                                }
                            }
                            if (!pageResult.hasNext || pageResult.items.length === 0) {
                                hasNext = false;
                            }
                            else {
                                page++;
                                await sleep(delayBetweenRequests);
                            }
                        }
                    }
                    await this.prisma.imoc_Ingestion_Rule.update({
                        where: { id: rule.id },
                        data: {
                            last_run_at: new Date(),
                            last_run_status: 'success',
                            last_run_fetched: ruleFetched,
                            last_run_ingested: ruleIngested,
                            last_run_error: null,
                        },
                    });
                }
                catch (ruleErr) {
                    const errMsg = ruleErr?.message || String(ruleErr);
                    errors.push(`Rule "${rule.name}": ${errMsg}`);
                    logger_util_1.logger.error('Failed evaluating IMOC ingestion rule', {
                        ruleId: rule.id,
                        ruleName: rule.name,
                        error: errMsg,
                    });
                    await this.prisma.imoc_Ingestion_Rule.update({
                        where: { id: rule.id },
                        data: {
                            last_run_at: new Date(),
                            last_run_status: 'failed',
                            last_run_error: errMsg.slice(0, 1000),
                        },
                    });
                }
            }
            // Persist / upsert accumulated tickets into local store
            for (const [orderId, { ticket, matchedRules }] of accumulatedTickets.entries()) {
                const category = (0, imoc_utility_1.resolveTicketCategory)(matchedRules, ticket);
                const sourceHash = (0, imoc_utility_1.hashImocTicket)(ticket);
                const ruleIds = Array.from(new Set(matchedRules.map((r) => r.id)));
                const existingTicket = await this.prisma.imoc_Ticket.findUnique({
                    where: { order_id: orderId },
                });
                if (existingTicket) {
                    let existingRuleIds = [];
                    try {
                        existingRuleIds = existingTicket.matched_rule_ids
                            ? JSON.parse(existingTicket.matched_rule_ids)
                            : [];
                    }
                    catch {
                        existingRuleIds = [];
                    }
                    const mergedRuleIds = Array.from(new Set([...existingRuleIds, ...ruleIds]));
                    const ruleIdsJson = JSON.stringify(mergedRuleIds);
                    const isUnchanged = existingTicket.source_hash === sourceHash &&
                        existingTicket.matched_rule_ids === ruleIdsJson &&
                        existingTicket.category === category;
                    if (isUnchanged) {
                        await this.prisma.imoc_Ticket.update({
                            where: { id: existingTicket.id },
                            data: { last_synced_at: new Date() },
                        });
                        skippedCount++;
                    }
                    else {
                        await this.prisma.imoc_Ticket.update({
                            where: { id: existingTicket.id },
                            data: {
                                order_name: ticket.orderName,
                                model_id: ticket.modelId,
                                model_name: ticket.modelName,
                                model_type: ticket.modelType,
                                order_source: ticket.sourceTenant ?? ticket.processType,
                                order_status: ticket.orderStatus,
                                sla_status: ticket.slaStatus,
                                priority: ticket.priority,
                                current_handler: ticket.currentUser,
                                created_by_name: ticket.applicant,
                                imoc_created_at: (0, imoc_utility_1.parseImocDate)(ticket.beginTime, app_config_1.config.imoc.timestampsUtc),
                                imoc_ended_at: (0, imoc_utility_1.parseImocDate)(ticket.endTime, app_config_1.config.imoc.timestampsUtc),
                                category,
                                matched_rule_ids: ruleIdsJson,
                                source_hash: sourceHash,
                                last_synced_at: new Date(),
                            },
                        });
                        updatedCount++;
                    }
                }
                else {
                    const newTicket = await this.prisma.imoc_Ticket.create({
                        data: {
                            order_id: ticket.orderId,
                            order_number: ticket.orderNumber,
                            order_name: ticket.orderName,
                            model_id: ticket.modelId,
                            model_name: ticket.modelName,
                            model_type: ticket.modelType,
                            order_source: ticket.sourceTenant ?? ticket.processType,
                            order_status: ticket.orderStatus,
                            sla_status: ticket.slaStatus,
                            priority: ticket.priority,
                            current_handler: ticket.currentUser,
                            created_by_name: ticket.applicant,
                            imoc_created_at: (0, imoc_utility_1.parseImocDate)(ticket.beginTime, app_config_1.config.imoc.timestampsUtc),
                            imoc_ended_at: (0, imoc_utility_1.parseImocDate)(ticket.endTime, app_config_1.config.imoc.timestampsUtc),
                            category,
                            matched_rule_ids: JSON.stringify(ruleIds),
                            source_hash: sourceHash,
                            first_ingested_at: new Date(),
                            last_synced_at: new Date(),
                            is_active: true,
                        },
                    });
                    createdCount++;
                    // Link any unlinked engagement ticket links matching this order_id
                    await this.prisma.imoc_Ticket_Link.updateMany({
                        where: {
                            order_id: ticket.orderId,
                            imoc_ticket_id: null,
                        },
                        data: {
                            imoc_ticket_id: newTicket.id,
                        },
                    });
                }
            }
            // Determine run status
            let finalStatus = 'success';
            if (errors.length > 0) {
                if (createdCount > 0 || updatedCount > 0 || skippedCount > 0) {
                    finalStatus = 'partial';
                }
                else {
                    finalStatus = 'failed';
                }
            }
            const durationMs = Date.now() - startTime;
            const errorSummary = errors.length > 0 ? errors.slice(0, 5).join('; ').slice(0, 1000) : null;
            await this.prisma.imoc_Ingestion_Run.update({
                where: { id: run.id },
                data: {
                    finished_at: new Date(),
                    status: finalStatus,
                    rules_evaluated: rules.length,
                    fetched: totalFetched,
                    created: createdCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    error_summary: errorSummary,
                },
            });
            logger_util_1.logger.info('IMOC ticket ingestion run completed', {
                runId: run.id,
                trigger,
                status: finalStatus,
                rulesEvaluated: rules.length,
                fetched: totalFetched,
                created: createdCount,
                updated: updatedCount,
                skipped: skippedCount,
                durationMs,
            });
            audit_log_service_1.auditLogService.logAsync({
                userId: actorId,
                action: 'integration.imoc.ingest.run',
                module: 'integration',
                entityType: 'imoc_ingestion_run',
                entityId: run.id,
                newValues: {
                    trigger,
                    status: finalStatus,
                    rulesEvaluated: rules.length,
                    fetched: totalFetched,
                    created: createdCount,
                    updated: updatedCount,
                    skipped: skippedCount,
                    durationMs,
                },
            });
            return {
                runId: run.id,
                status: finalStatus,
                trigger,
                rulesEvaluated: rules.length,
                fetched: totalFetched,
                created: createdCount,
                updated: updatedCount,
                skipped: skippedCount,
                errors,
                durationMs,
            };
        }
        catch (err) {
            const errMsg = err?.message || String(err);
            logger_util_1.logger.error('IMOC ingestion fatal failure', { runId: run.id, error: errMsg });
            await this.prisma.imoc_Ingestion_Run.update({
                where: { id: run.id },
                data: {
                    finished_at: new Date(),
                    status: 'failed',
                    error_summary: errMsg.slice(0, 1000),
                },
            });
            return {
                runId: run.id,
                status: 'failed',
                trigger,
                rulesEvaluated: 0,
                fetched: totalFetched,
                created: createdCount,
                updated: updatedCount,
                skipped: skippedCount,
                errors: [...errors, errMsg],
                durationMs: Date.now() - startTime,
            };
        }
        finally {
            this.inProgress = false;
        }
    }
    async listRules() {
        const rules = await this.prisma.imoc_Ingestion_Rule.findMany({
            where: { deleted_at: null },
            orderBy: { priority: 'asc' },
        });
        return rules.map(imoc_response_dto_1.mapImocRuleToResponse);
    }
    async getRule(id) {
        const rule = await this.prisma.imoc_Ingestion_Rule.findFirst({
            where: { id, deleted_at: null },
        });
        if (!rule)
            throw app_error_1.AppError.notFound('IMOC ingestion rule');
        return (0, imoc_response_dto_1.mapImocRuleToResponse)(rule);
    }
    async createRule(actorId, data) {
        const validatedCriteria = (0, imoc_utility_1.validateRuleCriteria)(data.criteria);
        const existing = await this.prisma.imoc_Ingestion_Rule.findFirst({
            where: { name: data.name, deleted_at: null },
        });
        if (existing) {
            throw app_error_1.AppError.conflict('An ingestion rule with this name already exists.');
        }
        const created = await this.prisma.imoc_Ingestion_Rule.create({
            data: {
                name: data.name,
                description: data.description ?? null,
                is_active: data.isActive ?? true,
                priority: data.priority ?? 100,
                criteria_json: JSON.stringify(validatedCriteria),
                category: data.category ?? null,
                risk_category_id: data.riskCategoryId ?? null,
                lookback_days: data.lookbackDays ?? 30,
                created_by_id: actorId,
            },
        });
        logger_util_1.logger.info('IMOC ingestion rule created', { ruleId: created.id, name: created.name, actorId });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            action: 'integration.imoc.rule.create',
            module: 'integration',
            entityType: 'imoc_ingestion_rule',
            entityId: created.id,
            newValues: {
                name: created.name,
                priority: created.priority,
                criteria: validatedCriteria,
            },
        });
        return (0, imoc_response_dto_1.mapImocRuleToResponse)(created);
    }
    async updateRule(actorId, id, data) {
        const rule = await this.prisma.imoc_Ingestion_Rule.findFirst({
            where: { id, deleted_at: null },
        });
        if (!rule)
            throw app_error_1.AppError.notFound('IMOC ingestion rule');
        if (data.name && data.name !== rule.name) {
            const existing = await this.prisma.imoc_Ingestion_Rule.findFirst({
                where: { name: data.name, deleted_at: null },
            });
            if (existing) {
                throw app_error_1.AppError.conflict('An ingestion rule with this name already exists.');
            }
        }
        let criteriaJson = rule.criteria_json;
        if (data.criteria !== undefined) {
            const validatedCriteria = (0, imoc_utility_1.validateRuleCriteria)(data.criteria);
            criteriaJson = JSON.stringify(validatedCriteria);
        }
        const updated = await this.prisma.imoc_Ingestion_Rule.update({
            where: { id },
            data: {
                name: data.name ?? rule.name,
                description: data.description !== undefined ? data.description : rule.description,
                is_active: data.isActive !== undefined ? data.isActive : rule.is_active,
                priority: data.priority !== undefined ? data.priority : rule.priority,
                criteria_json: criteriaJson,
                category: data.category !== undefined ? data.category : rule.category,
                risk_category_id: data.riskCategoryId !== undefined ? data.riskCategoryId : rule.risk_category_id,
                lookback_days: data.lookbackDays !== undefined ? data.lookbackDays : rule.lookback_days,
                updated_by_id: actorId,
            },
        });
        logger_util_1.logger.info('IMOC ingestion rule updated', { ruleId: updated.id, actorId });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            action: 'integration.imoc.rule.update',
            module: 'integration',
            entityType: 'imoc_ingestion_rule',
            entityId: updated.id,
            oldValues: { name: rule.name, priority: rule.priority, isActive: rule.is_active },
            newValues: { name: updated.name, priority: updated.priority, isActive: updated.is_active },
        });
        return (0, imoc_response_dto_1.mapImocRuleToResponse)(updated);
    }
    async toggleRule(actorId, id) {
        const rule = await this.prisma.imoc_Ingestion_Rule.findFirst({
            where: { id, deleted_at: null },
        });
        if (!rule)
            throw app_error_1.AppError.notFound('IMOC ingestion rule');
        const updated = await this.prisma.imoc_Ingestion_Rule.update({
            where: { id },
            data: {
                is_active: !rule.is_active,
                updated_by_id: actorId,
            },
        });
        logger_util_1.logger.info('IMOC ingestion rule toggled', { ruleId: id, isActive: updated.is_active, actorId });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            action: 'integration.imoc.rule.toggle',
            module: 'integration',
            entityType: 'imoc_ingestion_rule',
            entityId: id,
            newValues: { isActive: updated.is_active },
        });
        return (0, imoc_response_dto_1.mapImocRuleToResponse)(updated);
    }
    async deleteRule(actorId, id) {
        const rule = await this.prisma.imoc_Ingestion_Rule.findFirst({
            where: { id, deleted_at: null },
        });
        if (!rule)
            throw app_error_1.AppError.notFound('IMOC ingestion rule');
        await this.prisma.imoc_Ingestion_Rule.update({
            where: { id },
            data: {
                deleted_at: new Date(),
                updated_by_id: actorId,
            },
        });
        logger_util_1.logger.info('IMOC ingestion rule deleted', { ruleId: id, actorId });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            action: 'integration.imoc.rule.delete',
            module: 'integration',
            entityType: 'imoc_ingestion_rule',
            entityId: id,
        });
    }
    async previewRule(criteria, lookbackDays = 30) {
        const validatedCriteria = (0, imoc_utility_1.validateRuleCriteria)(criteria);
        const queries = (0, imoc_utility_1.buildUpstreamQueries)(validatedCriteria, lookbackDays, app_config_1.config.imoc.timestampsUtc);
        const sampleMap = new Map();
        for (const baseQuery of queries) {
            const query = {
                ...baseQuery,
                page: 1,
                pageSize: 10,
            };
            try {
                const pageResult = await this.client.listTickets(query);
                for (const item of pageResult.items) {
                    if ((0, imoc_utility_1.matchesRuleCriteria)(item, validatedCriteria)) {
                        sampleMap.set(item.orderId, item);
                    }
                    if (sampleMap.size >= 10)
                        break;
                }
            }
            catch (err) {
                logger_util_1.logger.warn('Preview query failed against IMOC', { err: err?.message });
            }
            if (sampleMap.size >= 10)
                break;
        }
        const sample = Array.from(sampleMap.values());
        return {
            total: sample.length,
            sample,
        };
    }
    async listRuns(page = 1, pageSize = 20) {
        const skip = (page - 1) * pageSize;
        const [runs, total] = await Promise.all([
            this.prisma.imoc_Ingestion_Run.findMany({
                skip,
                take: pageSize,
                orderBy: { started_at: 'desc' },
            }),
            this.prisma.imoc_Ingestion_Run.count(),
        ]);
        return {
            items: runs.map(imoc_response_dto_1.mapImocRunToResponse),
            total,
            page,
            pageSize,
        };
    }
    async getRun(id) {
        const run = await this.prisma.imoc_Ingestion_Run.findUnique({
            where: { id },
        });
        if (!run)
            throw app_error_1.AppError.notFound('IMOC ingestion run');
        return (0, imoc_response_dto_1.mapImocRunToResponse)(run);
    }
}
exports.ImocIngestionService = ImocIngestionService;
exports.imocIngestionService = new ImocIngestionService();
//# sourceMappingURL=imoc-ingestion.service.js.map