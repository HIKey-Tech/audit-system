"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllJobs = exports.schedulerService = exports.JOB_KEYS = void 0;
// src/modules/background/service/implementation/scheduler.service.ts
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const escalation_service_1 = require("../../../workflow/escalation/service/implementation/escalation.service");
/**
 * Job Key Naming Convention:
 *   BG:<MODULE>:<ACTION>:<FREQUENCY>
 *   Examples:
 *     BG:AUDIT:REMINDER:DAILY
 *     BG:TOKEN:CLEANUP:HOURLY
 *     BG:REPORT:GENERATE:WEEKLY
 */
exports.JOB_KEYS = {
    TOKEN_CLEANUP_HOURLY: 'BG:TOKEN:CLEANUP:HOURLY',
    AUDIT_REMINDER_DAILY: 'BG:AUDIT:REMINDER:DAILY',
    WORKFLOW_ESCALATION_HOURLY: 'BG:WORKFLOW:ESCALATION:HOURLY',
    LOG_ARCHIVE_WEEKLY: 'BG:LOG:ARCHIVE:WEEKLY',
    REPORT_GENERATE_MONTHLY: 'BG:REPORT:GENERATE:MONTHLY',
};
class SchedulerService {
    jobs = [];
    tasks = new Map();
    register(job) {
        this.jobs.push(job);
        logger_util_1.logger.info('Background job registered', { jobKey: job.key });
    }
    async startAll() {
        for (const job of this.jobs) {
            const record = await this._upsertJobRecord(job);
            if (!record.is_active) {
                logger_util_1.logger.info('Background job skipped (disabled in database)', { jobKey: job.key });
                continue;
            }
            const task = node_cron_1.default.schedule(job.cronExpression, () => this._runJob(job), {
                name: job.key,
                runOnInit: false,
            });
            this.tasks.set(job.key, task);
            logger_util_1.logger.info('Background job started', { jobKey: job.key, cron: job.cronExpression });
        }
    }
    stopAll() {
        for (const [key, task] of this.tasks) {
            task.stop();
            logger_util_1.logger.info('Background job stopped', { jobKey: key });
        }
        this.tasks.clear();
    }
    async _runJob(job) {
        logger_util_1.logger.info('Background job started running', { jobKey: job.key });
        const run = await prisma_client_1.prisma.scheduled_Job_Run.create({
            data: {
                job_id: await this._getJobId(job.key),
                status: 'running',
            },
        });
        const startMs = Date.now();
        try {
            await job.handler();
            await prisma_client_1.prisma.scheduled_Job_Run.update({
                where: { id: run.id },
                data: { status: 'success', completed_at: new Date() },
            });
            await prisma_client_1.prisma.scheduled_Job.update({
                where: { job_key: job.key },
                data: { last_run_at: new Date(), last_status: 'success' },
            });
            logger_util_1.logger.info('Background job completed', { jobKey: job.key, durationMs: Date.now() - startMs });
        }
        catch (err) {
            await prisma_client_1.prisma.scheduled_Job_Run.update({
                where: { id: run.id },
                data: {
                    status: 'failure',
                    completed_at: new Date(),
                    error: String(err),
                },
            });
            await prisma_client_1.prisma.scheduled_Job.update({
                where: { job_key: job.key },
                data: { last_run_at: new Date(), last_status: 'failure' },
            });
            logger_util_1.logger.error('Background job failed', { err, jobKey: job.key });
        }
    }
    async _upsertJobRecord(job) {
        return prisma_client_1.prisma.scheduled_Job.upsert({
            where: { job_key: job.key },
            create: {
                job_key: job.key,
                name: job.name,
                description: job.description,
                cron_expression: job.cronExpression,
                is_active: true,
            },
            update: {
                name: job.name,
                cron_expression: job.cronExpression,
            },
            select: { is_active: true },
        });
    }
    async _getJobId(jobKey) {
        const job = await prisma_client_1.prisma.scheduled_Job.findUniqueOrThrow({
            where: { job_key: jobKey },
            select: { id: true },
        });
        return job.id;
    }
}
exports.schedulerService = new SchedulerService();
// ──────────────────────────────────────────────
// Register all background jobs here
// ──────────────────────────────────────────────
const registerAllJobs = () => {
    // BG:TOKEN:CLEANUP:HOURLY — purge expired refresh tokens
    exports.schedulerService.register({
        key: exports.JOB_KEYS.TOKEN_CLEANUP_HOURLY,
        name: 'Expired Token Cleanup',
        description: 'Purges expired and revoked refresh tokens from the database',
        cronExpression: '0 * * * *', // Every hour
        handler: async () => {
            const result = await prisma_client_1.prisma.refresh_Token.deleteMany({
                where: {
                    OR: [
                        { expires_at: { lt: new Date() } },
                        { revoked_at: { not: null } },
                    ],
                },
            });
            logger_util_1.logger.info('Expired tokens cleaned up', { count: result.count });
        },
    });
    // BG:AUDIT:REMINDER:DAILY — send reminders for overdue audit tasks
    exports.schedulerService.register({
        key: exports.JOB_KEYS.AUDIT_REMINDER_DAILY,
        name: 'Audit Due Date Reminder',
        description: 'Sends reminders for audit engagements approaching their due date',
        cronExpression: '0 8 * * *', // Every day at 08:00
        handler: async () => {
            // NOTE: stubbed until the Audit module adds `audit_engagement` to the schema.
            // Restore the real query (due-date window + notification dispatch) once that model exists.
            logger_util_1.logger.info('Audit reminder job: skipped (audit_engagement model not yet defined)');
        },
    });
    // BG:WORKFLOW:ESCALATION:HOURLY — check stalled approvals and breached audit engagement SLAs
    exports.schedulerService.register({
        key: exports.JOB_KEYS.WORKFLOW_ESCALATION_HOURLY,
        name: 'Workflow Escalation Check',
        description: 'Escalates stalled approvals and overdue audit engagements',
        cronExpression: '0 * * * *', // Every hour
        handler: async () => {
            const result = await escalation_service_1.workflowEscalationService.checkAndEscalate();
            logger_util_1.logger.info('Workflow escalation job completed', result);
        },
    });
    // BG:LOG:ARCHIVE:WEEKLY — archive old audit logs to data warehouse
    exports.schedulerService.register({
        key: exports.JOB_KEYS.LOG_ARCHIVE_WEEKLY,
        name: 'Audit Log Archive',
        description: 'Archives audit logs older than 90 days to the data warehouse',
        cronExpression: '0 2 * * 0', // Every Sunday at 02:00
        handler: async () => {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const oldLogs = await prisma_client_1.prisma.audit_Log.findMany({
                where: { created_at: { lt: ninetyDaysAgo } },
                take: 10000,
            });
            logger_util_1.logger.info('Log archive job: logs ready for DWH export', { count: oldLogs.length });
            // TODO: push to data warehouse via DataWarehouseClient
        },
    });
};
exports.registerAllJobs = registerAllJobs;
//# sourceMappingURL=scheduler.service.js.map