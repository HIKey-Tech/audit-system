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
const app_error_1 = require("../../../../shared/errors/app.error");
const notification_queue_service_1 = require("../../../messaging/service/implementation/notification-queue.service");
const escalation_service_1 = require("../../../workflow/escalation/service/implementation/escalation.service");
const document_service_1 = require("../../../document/service/implementation/document.service");
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
    MESSAGING_NOTIFICATION_QUEUE_EVERY_MINUTE: 'BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE',
    WORKFLOW_ESCALATION_HOURLY: 'BG:WORKFLOW:ESCALATION:HOURLY',
    LOG_ARCHIVE_WEEKLY: 'BG:LOG:ARCHIVE:WEEKLY',
    REPORT_GENERATE_MONTHLY: 'BG:REPORT:GENERATE:MONTHLY',
    DOCUMENT_VERSION_PRUNE_WEEKLY: 'BG:DOCUMENT:VERSION:PRUNE:WEEKLY',
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
    async startJob(jobKey) {
        const job = this.jobs.find((j) => j.key === jobKey);
        if (!job) {
            throw app_error_1.AppError.notFound(`Background job ${jobKey}`);
        }
        await this._upsertJobRecord(job, true);
        const existingTask = this.tasks.get(jobKey);
        if (existingTask) {
            existingTask.start();
            logger_util_1.logger.info('Background job already registered; ensured running', { jobKey });
            return;
        }
        const task = node_cron_1.default.schedule(job.cronExpression, () => this._runJob(job), {
            name: job.key,
            runOnInit: false,
        });
        this.tasks.set(job.key, task);
        logger_util_1.logger.info('Background job started', { jobKey: job.key, cron: job.cronExpression });
    }
    async stopJob(jobKey) {
        const job = this.jobs.find((j) => j.key === jobKey);
        if (!job) {
            throw app_error_1.AppError.notFound(`Background job ${jobKey}`);
        }
        await prisma_client_1.prisma.scheduled_Job.update({
            where: { job_key: jobKey },
            data: { is_active: false },
        });
        const task = this.tasks.get(jobKey);
        if (task) {
            task.stop();
            this.tasks.delete(jobKey);
            logger_util_1.logger.info('Background job stopped', { jobKey });
        }
        else {
            logger_util_1.logger.info('Background job already stopped', { jobKey });
        }
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
    async _upsertJobRecord(job, isActive) {
        return prisma_client_1.prisma.scheduled_Job.upsert({
            where: { job_key: job.key },
            create: {
                job_key: job.key,
                name: job.name,
                description: job.description,
                cron_expression: job.cronExpression,
                is_active: isActive ?? true,
            },
            update: {
                name: job.name,
                cron_expression: job.cronExpression,
                ...(isActive === undefined ? {} : { is_active: isActive }),
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
    // BG:AUDIT:REMINDER:DAILY — send reminders for audit engagement SLA deadlines
    exports.schedulerService.register({
        key: exports.JOB_KEYS.AUDIT_REMINDER_DAILY,
        name: 'Audit Due Date Reminder',
        description: 'Sends reminders for audit engagements approaching their due date',
        cronExpression: '0 8 * * *', // Every day at 08:00
        handler: async () => {
            const now = new Date();
            const reminderWindowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            const engagements = await prisma_client_1.prisma.audit_Engagement.findMany({
                where: {
                    deleted_at: null,
                    status: { notIn: ['closed', 'reported'] },
                    sla_deadline: {
                        gte: now,
                        lte: reminderWindowEnd,
                    },
                },
                select: {
                    id: true,
                    reference_number: true,
                    title: true,
                    sla_deadline: true,
                    lead_auditor: {
                        select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
                    },
                    audit_manager: {
                        select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
                    },
                },
                orderBy: { sla_deadline: 'asc' },
            });
            let notificationsSent = 0;
            for (const engagement of engagements) {
                const slaDeadline = engagement.sla_deadline.toISOString();
                const daysRemaining = Math.max(0, Math.ceil((engagement.sla_deadline.getTime() - now.getTime()) / 86_400_000));
                const recipients = [engagement.lead_auditor, engagement.audit_manager];
                for (const recipient of recipients) {
                    const recipientName = recipient.display_name ?? `${recipient.first_name} ${recipient.last_name}`.trim();
                    const slaVariables = {
                        recipientName,
                        engagementTitle: engagement.title,
                        engagementReference: engagement.reference_number,
                        slaDeadline,
                        daysRemaining: String(daysRemaining),
                    };
                    try {
                        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
                            userId: recipient.id,
                            title: 'Audit SLA deadline approaching',
                            body: `Audit engagement ${engagement.reference_number} - "${engagement.title}" has an SLA deadline of ${slaDeadline}.`,
                            type: 'warning',
                            referenceType: 'audit_engagement',
                            referenceId: engagement.id,
                            metadata: {
                                referenceNumber: engagement.reference_number,
                                title: engagement.title,
                                slaDeadline,
                            },
                            eventKey: 'audit.sla.reminder',
                            variables: slaVariables,
                        });
                        await notification_queue_service_1.notificationQueueService.enqueue('email', {
                            to: recipient.email,
                            subject: `SLA Deadline Approaching: ${engagement.reference_number}`,
                            text: `Audit engagement ${engagement.reference_number} - "${engagement.title}" has an SLA deadline of ${slaDeadline}.`,
                            eventKey: 'audit.sla.reminder',
                            variables: slaVariables,
                        });
                        notificationsSent += 2;
                    }
                    catch (err) {
                        logger_util_1.logger.error('Audit reminder notification failed', {
                            err,
                            engagementId: engagement.id,
                            referenceNumber: engagement.reference_number,
                            recipientId: recipient.id,
                        });
                    }
                }
            }
            logger_util_1.logger.info('Audit reminder job completed', {
                engagementsFound: engagements.length,
                notificationsSent,
            });
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
    // BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE - process queued notifications
    exports.schedulerService.register({
        key: exports.JOB_KEYS.MESSAGING_NOTIFICATION_QUEUE_EVERY_MINUTE,
        name: 'Notification Queue Processor',
        description: 'Processes pending email and in-app notifications from the queue',
        cronExpression: '* * * * *',
        handler: async () => {
            await notification_queue_service_1.notificationQueueService.processQueue();
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
    // BG:DOCUMENT:VERSION:PRUNE:WEEKLY — prune old document versions when retention is enabled
    exports.schedulerService.register({
        key: exports.JOB_KEYS.DOCUMENT_VERSION_PRUNE_WEEKLY,
        name: 'Document Version Prune',
        description: 'Prunes old document versions when version_retention is enabled in system config. No-op when disabled (default).',
        cronExpression: '0 3 * * 0', // Every Sunday at 03:00
        handler: async () => {
            const documentService = new document_service_1.DocumentService();
            const result = await documentService.pruneOldVersions();
            logger_util_1.logger.info('Document version prune job completed', result);
        },
    });
};
exports.registerAllJobs = registerAllJobs;
//# sourceMappingURL=scheduler.service.js.map