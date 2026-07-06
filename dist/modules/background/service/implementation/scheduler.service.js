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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllJobs = exports.schedulerService = exports.JOB_KEYS = void 0;
// src/modules/background/service/implementation/scheduler.service.ts
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_client_1 = require("../../../../shared/prisma/prisma.client");
const logger_util_1 = require("../../../../shared/utils/logger.util");
const app_config_1 = require("../../../../shared/config/app.config");
const app_error_1 = require("../../../../shared/errors/app.error");
const notification_queue_service_1 = require("../../../messaging/service/implementation/notification-queue.service");
const notification_queue_service_interface_1 = require("../../../messaging/service/interface/notification-queue.service.interface");
const escalation_service_1 = require("../../../workflow/escalation/service/implementation/escalation.service");
const document_service_1 = require("../../../document/service/implementation/document.service");
const directory_mapping_service_1 = require("../../../integration/service/implementation/directory-mapping.service");
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
    AUDIT_FINDING_OVERDUE_DAILY: 'BG:AUDIT:FINDING_OVERDUE:DAILY',
    USER_MFA_GRACE_REMINDER_DAILY: 'BG:USER:MFA_GRACE_REMINDER:DAILY',
    MESSAGING_NOTIFICATION_QUEUE_EVERY_MINUTE: 'BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE',
    WORKFLOW_ESCALATION_HOURLY: 'BG:WORKFLOW:ESCALATION:HOURLY',
    AUDIT_RECONCILE_STATUS_HOURLY: 'BG:AUDIT:RECONCILE:STATUS:HOURLY',
    LOG_ARCHIVE_WEEKLY: 'BG:LOG:ARCHIVE:WEEKLY',
    REPORT_GENERATE_MONTHLY: 'BG:REPORT:GENERATE:MONTHLY',
    DOCUMENT_VERSION_PRUNE_WEEKLY: 'BG:DOCUMENT:VERSION:PRUNE:WEEKLY',
    INTEGRATION_DIRECTORY_SYNC_DAILY: 'BG:INTEGRATION:DIRECTORY:SYNC:DAILY',
    RETENTION_PURGE_WEEKLY: 'BG:RETENTION:PURGE:WEEKLY',
};
class SchedulerService {
    jobs = [];
    tasks = new Map();
    runningJobs = new Set();
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
        if (this.runningJobs.has(job.key)) {
            logger_util_1.logger.warn('Background job skipped because previous run is still active', { jobKey: job.key });
            return;
        }
        this.runningJobs.add(job.key);
        logger_util_1.logger.info('Background job started running', { jobKey: job.key });
        const run = await prisma_client_1.prisma.scheduled_Job_Run.create({
            data: {
                job_id: await this._getJobId(job.key),
                status: 'running',
            },
        });
        await prisma_client_1.prisma.scheduled_Job.update({
            where: { job_key: job.key },
            data: { last_status: 'running' },
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
        finally {
            this.runningJobs.delete(job.key);
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
    // BG:INTEGRATION:DIRECTORY:SYNC:DAILY — reconcile Azure AD group→role + deprovision
    exports.schedulerService.register({
        key: exports.JOB_KEYS.INTEGRATION_DIRECTORY_SYNC_DAILY,
        name: 'Azure AD Directory Sync',
        description: 'Pulls users + group memberships from Microsoft Graph, reconciles azure_ad roles, and deactivates users disabled in Azure AD',
        cronExpression: '0 2 * * *', // every day at 02:00
        handler: async () => {
            if (!app_config_1.config.directorySync.enabled) {
                logger_util_1.logger.info('Directory sync skipped (DIRECTORY_SYNC_ENABLED=false)');
                return;
            }
            const result = await directory_mapping_service_1.directoryMappingService.runFullDirectorySync();
            logger_util_1.logger.info('Directory sync job finished', result);
        },
    });
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
    // BG:USER:MFA_GRACE_REMINDER:DAILY — warn users before their mandatory-2FA
    // grace deadline passes, instead of only gating at login (mfa_grace_until is
    // set lazily on first login — see AuthService.login).
    exports.schedulerService.register({
        key: exports.JOB_KEYS.USER_MFA_GRACE_REMINDER_DAILY,
        name: 'MFA Grace Deadline Reminder',
        description: 'Warns not-yet-enrolled users 3 days and 1 day before their mandatory 2FA grace period ends',
        cronExpression: '0 9 * * *', // Every day at 09:00
        handler: async () => {
            const now = new Date();
            const users = await prisma_client_1.prisma.user.findMany({
                where: {
                    deleted_at: null,
                    is_active: true,
                    mfa_enabled: false,
                    mfa_grace_until: { not: null, gte: now },
                },
                select: { id: true, email: true, display_name: true, mfa_grace_until: true },
            });
            let notificationsSent = 0;
            for (const user of users) {
                const daysRemaining = Math.ceil((user.mfa_grace_until.getTime() - now.getTime()) / 86_400_000);
                // Fire only at the two checkpoints — the daily re-run naturally re-fires
                // each day the countdown lands on one of these, matching the existing
                // reminder jobs' re-fire-while-true pattern rather than new dedup state.
                if (daysRemaining !== 3 && daysRemaining !== 1)
                    continue;
                const variables = {
                    recipientName: user.display_name ?? user.email,
                    daysRemaining: String(daysRemaining),
                    graceDeadline: user.mfa_grace_until.toISOString(),
                };
                try {
                    await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
                        userId: user.id,
                        title: 'Set up two-factor authentication',
                        body: `Two-factor authentication setup is required within ${daysRemaining} day(s), or you will be locked out until you enroll.`,
                        type: 'warning',
                        referenceType: 'user',
                        referenceId: user.id,
                        metadata: { daysRemaining, graceDeadline: variables.graceDeadline },
                        eventKey: 'user.mfa.grace_reminder',
                        variables,
                    }, { priority: notification_queue_service_interface_1.NOTIFICATION_PRIORITY.HIGH });
                    await notification_queue_service_1.notificationQueueService.enqueue('email', {
                        to: user.email,
                        subject: 'Action required: set up two-factor authentication',
                        text: `Your IAMS account requires two-factor authentication. You have ${daysRemaining} day(s) left in your grace period before this is enforced at login.`,
                        eventKey: 'user.mfa.grace_reminder',
                        variables,
                    }, { priority: notification_queue_service_interface_1.NOTIFICATION_PRIORITY.HIGH });
                    notificationsSent += 2;
                }
                catch (err) {
                    logger_util_1.logger.error('MFA grace reminder notification failed', { err, userId: user.id });
                }
            }
            logger_util_1.logger.info('MFA grace reminder job completed', { usersChecked: users.length, notificationsSent });
        },
    });
    // BG:AUDIT:FINDING_OVERDUE:DAILY — nag auditees + lead auditors on findings approaching or past their due date
    exports.schedulerService.register({
        key: exports.JOB_KEYS.AUDIT_FINDING_OVERDUE_DAILY,
        name: 'Audit Finding Overdue Reminder',
        description: 'Reminds auditees and lead auditors of findings approaching or past their remediation due date',
        cronExpression: '0 8 * * *', // Every day at 08:00
        handler: async () => {
            const now = new Date();
            const reminderWindowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            const findings = await prisma_client_1.prisma.audit_Finding.findMany({
                where: {
                    deleted_at: null,
                    status: { notIn: ['verified', 'closed'] }, // not yet remediated/verified
                    due_date: { lte: reminderWindowEnd }, // overdue or due within 3 days
                },
                select: {
                    id: true,
                    title: true,
                    severity: true,
                    due_date: true,
                    auditee: {
                        select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
                    },
                    engagement: {
                        select: {
                            reference_number: true,
                            lead_auditor: {
                                select: { id: true, email: true, display_name: true, first_name: true, last_name: true },
                            },
                        },
                    },
                },
                orderBy: { due_date: 'asc' },
            });
            let notificationsSent = 0;
            for (const finding of findings) {
                const dueDate = finding.due_date.toISOString();
                const isOverdue = finding.due_date.getTime() < now.getTime();
                const daysOverdue = Math.ceil((now.getTime() - finding.due_date.getTime()) / 86_400_000);
                const daysRemaining = Math.max(0, Math.ceil((finding.due_date.getTime() - now.getTime()) / 86_400_000));
                const statusLabel = isOverdue ? `overdue by ${daysOverdue} day(s)` : `due in ${daysRemaining} day(s)`;
                const recipients = [finding.auditee, finding.engagement.lead_auditor];
                for (const recipient of recipients) {
                    const recipientName = recipient.display_name ?? `${recipient.first_name} ${recipient.last_name}`.trim();
                    const findingVariables = {
                        recipientName,
                        findingTitle: finding.title,
                        engagementReference: finding.engagement.reference_number,
                        severity: finding.severity,
                        dueDate,
                        statusLabel,
                    };
                    try {
                        await notification_queue_service_1.notificationQueueService.enqueue('in_app', {
                            userId: recipient.id,
                            title: isOverdue ? 'Finding remediation overdue' : 'Finding remediation due soon',
                            body: `Finding "${finding.title}" (${finding.engagement.reference_number}) is ${statusLabel}.`,
                            type: isOverdue ? 'error' : 'warning',
                            referenceType: 'audit_finding',
                            referenceId: finding.id,
                            metadata: { findingTitle: finding.title, dueDate, severity: finding.severity },
                            eventKey: 'audit.finding.overdue',
                            variables: findingVariables,
                        });
                        await notification_queue_service_1.notificationQueueService.enqueue('email', {
                            to: recipient.email,
                            subject: `Finding ${isOverdue ? 'Overdue' : 'Due Soon'}: ${finding.title}`,
                            text: `Finding "${finding.title}" (${finding.engagement.reference_number}) is ${statusLabel}. Due: ${dueDate}.`,
                            eventKey: 'audit.finding.overdue',
                            variables: findingVariables,
                        });
                        notificationsSent += 2;
                    }
                    catch (err) {
                        logger_util_1.logger.error('Audit finding overdue notification failed', {
                            err,
                            findingId: finding.id,
                            recipientId: recipient.id,
                        });
                    }
                }
            }
            logger_util_1.logger.info('Audit finding overdue job completed', {
                findingsFound: findings.length,
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
    // BG:AUDIT:RECONCILE:STATUS:HOURLY — safety-net re-run of engagement status reconcile
    // for any in-request reconcile that may have been skipped (e.g. due to a transient error).
    exports.schedulerService.register({
        key: exports.JOB_KEYS.AUDIT_RECONCILE_STATUS_HOURLY,
        name: 'Engagement Status Reconcile',
        description: 'Re-runs status reconcile across all non-closed engagements as a safety net',
        cronExpression: '0 * * * *', // Every hour
        handler: async () => {
            const { reconcileEngagementStatus } = await Promise.resolve().then(() => __importStar(require('../../../audit/engagement/service/implementation/engagement-status.reconciler')));
            const engagements = await prisma_client_1.prisma.audit_Engagement.findMany({
                where: {
                    deleted_at: null,
                    status: { in: ['in_progress', 'under_review', 'reported'] },
                },
                select: { id: true },
            });
            let reconciled = 0;
            for (const engagement of engagements) {
                try {
                    await reconcileEngagementStatus(engagement.id, 'system');
                    reconciled += 1;
                }
                catch (err) {
                    logger_util_1.logger.error('Engagement status reconcile failed', {
                        err,
                        engagementId: engagement.id,
                    });
                }
            }
            logger_util_1.logger.info('Engagement status reconcile job completed', {
                engagementsFound: engagements.length,
                reconciled,
            });
        },
    });
    // BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE - process queued notifications.
    // Runs every 15s (6-field cron) so latency-sensitive, high-priority mail
    // (OTP / password reset) drains quickly. processQueue() is re-entrancy-guarded,
    // so a long drain can't overlap the next tick. Job key kept stable to preserve
    // its persisted enable/disable state.
    exports.schedulerService.register({
        key: exports.JOB_KEYS.MESSAGING_NOTIFICATION_QUEUE_EVERY_MINUTE,
        name: 'Notification Queue Processor',
        description: 'Processes pending email and in-app notifications from the queue (every 15s, priority-ordered)',
        cronExpression: '*/15 * * * * *',
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
    // BG:RETENTION:PURGE:WEEKLY — enforce the NDPR data-retention schedule
    // (docs/NDPR_RETENTION_SCHEDULE.md). Periods live in system_config
    // `data_retention`; 0 disables a category. Runs after the Sunday 02:00
    // archive job so any future warehouse export sees logs before they purge.
    exports.schedulerService.register({
        key: exports.JOB_KEYS.RETENTION_PURGE_WEEKLY,
        name: 'Data Retention Purge',
        description: 'Hard-deletes audit logs, notifications, email logs, and consumed auth tokens older than the configured NDPR retention periods (system_config: data_retention).',
        cronExpression: '0 4 * * 0', // Every Sunday at 04:00
        handler: async () => {
            const defaults = { auditLogDays: 2555, notificationDays: 365, emailLogDays: 365, authTokenDays: 90 };
            let retention = defaults;
            const cfg = await prisma_client_1.prisma.system_Config.findUnique({
                where: { key: 'data_retention' },
                select: { value: true },
            });
            if (cfg?.value) {
                try {
                    retention = { ...defaults, ...JSON.parse(cfg.value) };
                }
                catch (err) {
                    logger_util_1.logger.warn('Invalid data_retention config; using defaults', { err });
                }
            }
            const cutoff = (days) => {
                const date = new Date();
                date.setDate(date.getDate() - days);
                return date;
            };
            const purged = {};
            // ponytail: unbatched deleteMany per table; chunk by created_at if weekly volumes ever make this lock too long
            if (retention.auditLogDays > 0) {
                purged.auditLogs = (await prisma_client_1.prisma.audit_Log.deleteMany({
                    where: { created_at: { lt: cutoff(retention.auditLogDays) } },
                })).count;
            }
            if (retention.notificationDays > 0) {
                purged.notifications = (await prisma_client_1.prisma.notification.deleteMany({
                    where: { created_at: { lt: cutoff(retention.notificationDays) } },
                })).count;
            }
            if (retention.emailLogDays > 0) {
                purged.emailLogs = (await prisma_client_1.prisma.email_Log.deleteMany({
                    where: { created_at: { lt: cutoff(retention.emailLogDays) } },
                })).count;
            }
            if (retention.authTokenDays > 0) {
                // Both tables hold IP addresses / per-user auth artifacts; rows are
                // dead minutes after issuance, so a created_at cutoff is safe.
                purged.passwordResetTokens = (await prisma_client_1.prisma.password_Reset_Token.deleteMany({
                    where: { created_at: { lt: cutoff(retention.authTokenDays) } },
                })).count;
                purged.mfaEmailOtps = (await prisma_client_1.prisma.mfa_Email_Otp.deleteMany({
                    where: { created_at: { lt: cutoff(retention.authTokenDays) } },
                })).count;
            }
            logger_util_1.logger.info('Data retention purge completed', { retention, purged });
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