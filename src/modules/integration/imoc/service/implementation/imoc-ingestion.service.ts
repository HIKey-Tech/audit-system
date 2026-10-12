import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../../../shared/prisma/prisma.client';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { config } from '../../../../../shared/config/app.config';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import {
  ImocIngestionRunSummary,
  ImocTicket,
} from '../../domain/entity/imoc.entity';
import {
  CreateImocRuleDto,
  UpdateImocRuleDto,
} from '../../dto/request/imoc.request.dto';
import {
  ImocIngestionRuleResponseDto,
  ImocIngestionRunResponseDto,
  mapImocRuleToResponse,
  mapImocRunToResponse,
} from '../../dto/response/imoc.response.dto';
import { IImocClient, createImocClient } from '../client/imoc.client';
import { IImocIngestionService } from '../interface/imoc-ingestion.service.interface';
import {
  buildUpstreamQueries,
  hashImocTicket,
  matchesRuleCriteria,
  parseImocDate,
  resolveTicketCategory,
  validateRuleCriteria,
} from '../../utility/imoc.utility';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ImocIngestionService implements IImocIngestionService {
  private inProgress = false;

  constructor(
    private readonly prisma: PrismaClient = defaultPrisma,
    private readonly client: IImocClient = createImocClient(),
  ) {}

  async runIngestion(
    trigger: 'scheduled' | 'manual',
    actorId?: string,
  ): Promise<ImocIngestionRunSummary> {
    const startTime = Date.now();

    if (!config.imoc.enabled || !this.client.configured) {
      logger.info('IMOC ingestion skipped: client disabled or not configured');
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
      logger.warn('IMOC ingestion run already in progress within this process');
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
      logger.warn('IMOC ingestion run already active in database', {
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

    const errors: string[] = [];
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
      const accumulatedTickets = new Map<
        string,
        {
          ticket: ImocTicket;
          matchedRules: Array<{
            id: string;
            name: string;
            priority: number;
            category: string | null;
          }>;
        }
      >();

      const delayBetweenRequests = Math.max(
        10,
        Math.ceil(1000 / (config.imoc.ingestRequestsPerSecond || 20)),
      );

      for (const rule of rules) {
        let ruleFetched = 0;
        let ruleIngested = 0;

        try {
          const rawCriteria =
            typeof rule.criteria_json === 'string'
              ? JSON.parse(rule.criteria_json)
              : rule.criteria_json;
          const criteria = validateRuleCriteria(rawCriteria);
          const queries = buildUpstreamQueries(
            criteria,
            rule.lookback_days,
            config.imoc.timestampsUtc,
          );

          for (const baseQuery of queries) {
            let page = 1;
            let hasNext = true;
            const maxPages = config.imoc.ingestMaxPages || 50;

            while (hasNext && page <= maxPages) {
              const query = {
                ...baseQuery,
                page,
                pageSize: config.imoc.ingestPageSize || 100,
              };

              const pageResult = await this.client.listTickets(query);
              ruleFetched += pageResult.items.length;
              totalFetched += pageResult.items.length;

              for (const ticket of pageResult.items) {
                if (matchesRuleCriteria(ticket, criteria)) {
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
                  } else {
                    accumulatedTickets.set(ticket.orderId, {
                      ticket,
                      matchedRules: [ruleInfo],
                    });
                  }
                }
              }

              if (!pageResult.hasNext || pageResult.items.length === 0) {
                hasNext = false;
              } else {
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
        } catch (ruleErr: any) {
          const errMsg = ruleErr?.message || String(ruleErr);
          errors.push(`Rule "${rule.name}": ${errMsg}`);
          logger.error('Failed evaluating IMOC ingestion rule', {
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
        const category = resolveTicketCategory(matchedRules, ticket);
        const sourceHash = hashImocTicket(ticket);
        const ruleIds = Array.from(new Set(matchedRules.map((r) => r.id)));

        const existingTicket = await this.prisma.imoc_Ticket.findUnique({
          where: { order_id: orderId },
        });

        if (existingTicket) {
          let existingRuleIds: string[] = [];
          try {
            existingRuleIds = existingTicket.matched_rule_ids
              ? JSON.parse(existingTicket.matched_rule_ids)
              : [];
          } catch {
            existingRuleIds = [];
          }
          const mergedRuleIds = Array.from(new Set([...existingRuleIds, ...ruleIds]));
          const ruleIdsJson = JSON.stringify(mergedRuleIds);

          const isUnchanged =
            existingTicket.source_hash === sourceHash &&
            existingTicket.matched_rule_ids === ruleIdsJson &&
            existingTicket.category === category;

          if (isUnchanged) {
            await this.prisma.imoc_Ticket.update({
              where: { id: existingTicket.id },
              data: { last_synced_at: new Date() },
            });
            skippedCount++;
          } else {
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
                imoc_created_at: parseImocDate(ticket.beginTime, config.imoc.timestampsUtc),
                imoc_ended_at: parseImocDate(ticket.endTime, config.imoc.timestampsUtc),
                category,
                matched_rule_ids: ruleIdsJson,
                source_hash: sourceHash,
                last_synced_at: new Date(),
              },
            });
            updatedCount++;
          }
        } else {
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
              imoc_created_at: parseImocDate(ticket.beginTime, config.imoc.timestampsUtc),
              imoc_ended_at: parseImocDate(ticket.endTime, config.imoc.timestampsUtc),
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
      let finalStatus: 'success' | 'partial' | 'failed' = 'success';
      if (errors.length > 0) {
        if (createdCount > 0 || updatedCount > 0 || skippedCount > 0) {
          finalStatus = 'partial';
        } else {
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

      logger.info('IMOC ticket ingestion run completed', {
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

      auditLogService.logAsync({
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
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      logger.error('IMOC ingestion fatal failure', { runId: run.id, error: errMsg });

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
    } finally {
      this.inProgress = false;
    }
  }

  async listRules(): Promise<ImocIngestionRuleResponseDto[]> {
    const rules = await this.prisma.imoc_Ingestion_Rule.findMany({
      where: { deleted_at: null },
      orderBy: { priority: 'asc' },
    });
    return rules.map(mapImocRuleToResponse);
  }

  async getRule(id: string): Promise<ImocIngestionRuleResponseDto> {
    const rule = await this.prisma.imoc_Ingestion_Rule.findFirst({
      where: { id, deleted_at: null },
    });
    if (!rule) throw AppError.notFound('IMOC ingestion rule');
    return mapImocRuleToResponse(rule);
  }

  async createRule(
    actorId: string,
    data: CreateImocRuleDto,
  ): Promise<ImocIngestionRuleResponseDto> {
    const validatedCriteria = validateRuleCriteria(data.criteria);

    const existing = await this.prisma.imoc_Ingestion_Rule.findFirst({
      where: { name: data.name, deleted_at: null },
    });
    if (existing) {
      throw AppError.conflict('An ingestion rule with this name already exists.');
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

    logger.info('IMOC ingestion rule created', { ruleId: created.id, name: created.name, actorId });

    auditLogService.logAsync({
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

    return mapImocRuleToResponse(created);
  }

  async updateRule(
    actorId: string,
    id: string,
    data: UpdateImocRuleDto,
  ): Promise<ImocIngestionRuleResponseDto> {
    const rule = await this.prisma.imoc_Ingestion_Rule.findFirst({
      where: { id, deleted_at: null },
    });
    if (!rule) throw AppError.notFound('IMOC ingestion rule');

    if (data.name && data.name !== rule.name) {
      const existing = await this.prisma.imoc_Ingestion_Rule.findFirst({
        where: { name: data.name, deleted_at: null },
      });
      if (existing) {
        throw AppError.conflict('An ingestion rule with this name already exists.');
      }
    }

    let criteriaJson = rule.criteria_json;
    if (data.criteria !== undefined) {
      const validatedCriteria = validateRuleCriteria(data.criteria);
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
        risk_category_id:
          data.riskCategoryId !== undefined ? data.riskCategoryId : rule.risk_category_id,
        lookback_days: data.lookbackDays !== undefined ? data.lookbackDays : rule.lookback_days,
        updated_by_id: actorId,
      },
    });

    logger.info('IMOC ingestion rule updated', { ruleId: updated.id, actorId });

    auditLogService.logAsync({
      userId: actorId,
      action: 'integration.imoc.rule.update',
      module: 'integration',
      entityType: 'imoc_ingestion_rule',
      entityId: updated.id,
      oldValues: { name: rule.name, priority: rule.priority, isActive: rule.is_active },
      newValues: { name: updated.name, priority: updated.priority, isActive: updated.is_active },
    });

    return mapImocRuleToResponse(updated);
  }

  async toggleRule(actorId: string, id: string): Promise<ImocIngestionRuleResponseDto> {
    const rule = await this.prisma.imoc_Ingestion_Rule.findFirst({
      where: { id, deleted_at: null },
    });
    if (!rule) throw AppError.notFound('IMOC ingestion rule');

    const updated = await this.prisma.imoc_Ingestion_Rule.update({
      where: { id },
      data: {
        is_active: !rule.is_active,
        updated_by_id: actorId,
      },
    });

    logger.info('IMOC ingestion rule toggled', { ruleId: id, isActive: updated.is_active, actorId });

    auditLogService.logAsync({
      userId: actorId,
      action: 'integration.imoc.rule.toggle',
      module: 'integration',
      entityType: 'imoc_ingestion_rule',
      entityId: id,
      newValues: { isActive: updated.is_active },
    });

    return mapImocRuleToResponse(updated);
  }

  async deleteRule(actorId: string, id: string): Promise<void> {
    const rule = await this.prisma.imoc_Ingestion_Rule.findFirst({
      where: { id, deleted_at: null },
    });
    if (!rule) throw AppError.notFound('IMOC ingestion rule');

    await this.prisma.imoc_Ingestion_Rule.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_by_id: actorId,
      },
    });

    logger.info('IMOC ingestion rule deleted', { ruleId: id, actorId });

    auditLogService.logAsync({
      userId: actorId,
      action: 'integration.imoc.rule.delete',
      module: 'integration',
      entityType: 'imoc_ingestion_rule',
      entityId: id,
    });
  }

  async previewRule(
    criteria: unknown,
    lookbackDays = 30,
  ): Promise<{ total: number; sample: ImocTicket[] }> {
    const validatedCriteria = validateRuleCriteria(criteria);
    const queries = buildUpstreamQueries(
      validatedCriteria,
      lookbackDays,
      config.imoc.timestampsUtc,
    );

    const sampleMap = new Map<string, ImocTicket>();

    for (const baseQuery of queries) {
      const query = {
        ...baseQuery,
        page: 1,
        pageSize: 10,
      };

      try {
        const pageResult = await this.client.listTickets(query);
        for (const item of pageResult.items) {
          if (matchesRuleCriteria(item, validatedCriteria)) {
            sampleMap.set(item.orderId, item);
          }
          if (sampleMap.size >= 10) break;
        }
      } catch (err: any) {
        logger.warn('Preview query failed against IMOC', { err: err?.message });
      }

      if (sampleMap.size >= 10) break;
    }

    const sample = Array.from(sampleMap.values());
    return {
      total: sample.length,
      sample,
    };
  }

  async listRuns(
    page = 1,
    pageSize = 20,
  ): Promise<{
    items: ImocIngestionRunResponseDto[];
    total: number;
    page: number;
    pageSize: number;
  }> {
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
      items: runs.map(mapImocRunToResponse),
      total,
      page,
      pageSize,
    };
  }

  async getRun(id: string): Promise<ImocIngestionRunResponseDto> {
    const run = await this.prisma.imoc_Ingestion_Run.findUnique({
      where: { id },
    });
    if (!run) throw AppError.notFound('IMOC ingestion run');
    return mapImocRunToResponse(run);
  }
}

export const imocIngestionService = new ImocIngestionService();
