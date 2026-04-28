"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundJobService = exports.BackgroundJobService = void 0;
// src/modules/background/service/implementation/job.service.ts
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_error_1 = require("../../../../shared/errors/app.error");
const api_response_type_1 = require("../../../../shared/types/api-response.type");
const audit_log_service_1 = require("../../../logging/service/implementation/audit-log.service");
const scheduler_service_1 = require("./scheduler.service");
const job_response_dto_1 = require("../../dto/response/job.response.dto");
const RECENT_RUNS_LIMIT = 50;
class BackgroundJobService {
    async listJobs() {
        const jobs = await prisma_client_1.prisma.scheduled_Job.findMany({
            orderBy: { job_key: 'asc' },
            include: {
                job_runs: {
                    orderBy: { started_at: 'desc' },
                    take: 1,
                },
            },
        });
        return jobs.map((job) => (0, job_response_dto_1.mapJobToResponse)(job, job.job_runs[0] ?? null));
    }
    async getJobById(id) {
        const job = await prisma_client_1.prisma.scheduled_Job.findUnique({
            where: { id },
            include: {
                job_runs: {
                    orderBy: { started_at: 'desc' },
                    take: RECENT_RUNS_LIMIT,
                },
            },
        });
        if (!job) {
            throw app_error_1.AppError.notFound('Scheduled job');
        }
        return (0, job_response_dto_1.mapJobWithRunsToResponse)(job, job.job_runs);
    }
    async enableJob(id, actorId) {
        return this._setActive(id, true, actorId);
    }
    async disableJob(id, actorId) {
        return this._setActive(id, false, actorId);
    }
    async listRuns(id, query) {
        const job = await prisma_client_1.prisma.scheduled_Job.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!job) {
            throw app_error_1.AppError.notFound('Scheduled job');
        }
        const { skip, take, page, pageSize } = (0, api_response_type_1.parsePagination)(query);
        const where = {
            job_id: id,
            ...(query.status ? { status: query.status } : {}),
        };
        const [total, runs] = await prisma_client_1.prisma.$transaction([
            prisma_client_1.prisma.scheduled_Job_Run.count({ where }),
            prisma_client_1.prisma.scheduled_Job_Run.findMany({
                where,
                orderBy: { started_at: query.sortOrder },
                skip,
                take,
            }),
        ]);
        return {
            runs: runs.map(job_response_dto_1.mapJobRunToResponse),
            meta: (0, api_response_type_1.buildPaginationMeta)(total, page, pageSize),
        };
    }
    async _setActive(id, isActive, actorId) {
        const existing = await prisma_client_1.prisma.scheduled_Job.findUnique({
            where: { id },
            select: { id: true, job_key: true, is_active: true },
        });
        if (!existing) {
            throw app_error_1.AppError.notFound('Scheduled job');
        }
        if (isActive) {
            await scheduler_service_1.schedulerService.startJob(existing.job_key);
        }
        else {
            await scheduler_service_1.schedulerService.stopJob(existing.job_key);
        }
        const updated = await prisma_client_1.prisma.scheduled_Job.findUniqueOrThrow({
            where: { id },
            include: {
                job_runs: {
                    orderBy: { started_at: 'desc' },
                    take: 1,
                },
            },
        });
        logger_util_1.logger.info('Scheduled job state changed', {
            jobId: updated.id,
            jobKey: updated.job_key,
            isActive,
            actorId,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actorId,
            action: isActive ? 'background.job.enable' : 'background.job.disable',
            module: 'background',
            entityType: 'scheduled_job',
            entityId: updated.id,
            oldValues: { isActive: existing.is_active },
            newValues: { isActive: updated.is_active },
        });
        return (0, job_response_dto_1.mapJobToResponse)(updated, updated.job_runs[0] ?? null);
    }
}
exports.BackgroundJobService = BackgroundJobService;
exports.backgroundJobService = new BackgroundJobService();
//# sourceMappingURL=job.service.js.map