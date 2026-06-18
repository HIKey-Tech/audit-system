// src/modules/background/service/implementation/scheduler.service.ts
import cron from 'node-cron';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { AppError } from '../../../../shared/errors/app.error';
import { notificationQueueService } from '../../../messaging/service/implementation/notification-queue.service';
import { workflowEscalationService } from '../../../workflow/escalation/service/implementation/escalation.service';
import { DocumentService } from '../../../document/service/implementation/document.service';

/**
 * Job Key Naming Convention:
 *   BG:<MODULE>:<ACTION>:<FREQUENCY>
 *   Examples:
 *     BG:AUDIT:REMINDER:DAILY
 *     BG:TOKEN:CLEANUP:HOURLY
 *     BG:REPORT:GENERATE:WEEKLY
 */
export const JOB_KEYS = {
  TOKEN_CLEANUP_HOURLY: 'BG:TOKEN:CLEANUP:HOURLY',
  AUDIT_REMINDER_DAILY: 'BG:AUDIT:REMINDER:DAILY',
  AUDIT_FINDING_OVERDUE_DAILY: 'BG:AUDIT:FINDING_OVERDUE:DAILY',
  MESSAGING_NOTIFICATION_QUEUE_EVERY_MINUTE: 'BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE',
  WORKFLOW_ESCALATION_HOURLY: 'BG:WORKFLOW:ESCALATION:HOURLY',
  AUDIT_RECONCILE_STATUS_HOURLY: 'BG:AUDIT:RECONCILE:STATUS:HOURLY',
  LOG_ARCHIVE_WEEKLY: 'BG:LOG:ARCHIVE:WEEKLY',
  REPORT_GENERATE_MONTHLY: 'BG:REPORT:GENERATE:MONTHLY',
  DOCUMENT_VERSION_PRUNE_WEEKLY: 'BG:DOCUMENT:VERSION:PRUNE:WEEKLY',
} as const;

export type JobKey = (typeof JOB_KEYS)[keyof typeof JOB_KEYS];

interface RegisteredJob {
  key: JobKey;
  name: string;
  description: string;
  cronExpression: string;
  handler: () => Promise<void>;
}

class SchedulerService {
  private readonly jobs: RegisteredJob[] = [];
  private readonly tasks = new Map<string, cron.ScheduledTask>();

  register(job: RegisteredJob): void {
    this.jobs.push(job);
    logger.info('Background job registered', { jobKey: job.key });
  }

  async startAll(): Promise<void> {
    for (const job of this.jobs) {
      const record = await this._upsertJobRecord(job);
      if (!record.is_active) {
        logger.info('Background job skipped (disabled in database)', { jobKey: job.key });
        continue;
      }
      const task = cron.schedule(job.cronExpression, () => this._runJob(job), {
        name: job.key,
        runOnInit: false,
      });
      this.tasks.set(job.key, task);
      logger.info('Background job started', { jobKey: job.key, cron: job.cronExpression });
    }
  }

  stopAll(): void {
    for (const [key, task] of this.tasks) {
      task.stop();
      logger.info('Background job stopped', { jobKey: key });
    }
    this.tasks.clear();
  }

  async startJob(jobKey: string): Promise<void> {
    const job = this.jobs.find((j) => j.key === jobKey);
    if (!job) {
      throw AppError.notFound(`Background job ${jobKey}`);
    }

    await this._upsertJobRecord(job, true);

    const existingTask = this.tasks.get(jobKey);
    if (existingTask) {
      existingTask.start();
      logger.info('Background job already registered; ensured running', { jobKey });
      return;
    }

    const task = cron.schedule(job.cronExpression, () => this._runJob(job), {
      name: job.key,
      runOnInit: false,
    });
    this.tasks.set(job.key, task);
    logger.info('Background job started', { jobKey: job.key, cron: job.cronExpression });
  }

  async stopJob(jobKey: string): Promise<void> {
    const job = this.jobs.find((j) => j.key === jobKey);
    if (!job) {
      throw AppError.notFound(`Background job ${jobKey}`);
    }

    await prisma.scheduled_Job.update({
      where: { job_key: jobKey },
      data: { is_active: false },
    });

    const task = this.tasks.get(jobKey);
    if (task) {
      task.stop();
      this.tasks.delete(jobKey);
      logger.info('Background job stopped', { jobKey });
    } else {
      logger.info('Background job already stopped', { jobKey });
    }
  }

  private async _runJob(job: RegisteredJob): Promise<void> {
    logger.info('Background job started running', { jobKey: job.key });

    const run = await prisma.scheduled_Job_Run.create({
      data: {
        job_id: await this._getJobId(job.key),
        status: 'running',
      },
    });

    const startMs = Date.now();
    try {
      await job.handler();

      await prisma.scheduled_Job_Run.update({
        where: { id: run.id },
        data: { status: 'success', completed_at: new Date() },
      });

      await prisma.scheduled_Job.update({
        where: { job_key: job.key },
        data: { last_run_at: new Date(), last_status: 'success' },
      });

      logger.info(
        'Background job completed',
        { jobKey: job.key, durationMs: Date.now() - startMs },
      );
    } catch (err) {
      await prisma.scheduled_Job_Run.update({
        where: { id: run.id },
        data: {
          status: 'failure',
          completed_at: new Date(),
          error: String(err),
        },
      });

      await prisma.scheduled_Job.update({
        where: { job_key: job.key },
        data: { last_run_at: new Date(), last_status: 'failure' },
      });

      logger.error('Background job failed', { err, jobKey: job.key });
    }
  }

  private async _upsertJobRecord(
    job: RegisteredJob,
    isActive?: boolean,
  ): Promise<{ is_active: boolean }> {
    return prisma.scheduled_Job.upsert({
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

  private async _getJobId(jobKey: string): Promise<string> {
    const job = await prisma.scheduled_Job.findUniqueOrThrow({
      where: { job_key: jobKey },
      select: { id: true },
    });
    return job.id;
  }
}

export const schedulerService = new SchedulerService();

// ──────────────────────────────────────────────
// Register all background jobs here
// ──────────────────────────────────────────────
export const registerAllJobs = (): void => {
  // BG:TOKEN:CLEANUP:HOURLY — purge expired refresh tokens
  schedulerService.register({
    key: JOB_KEYS.TOKEN_CLEANUP_HOURLY,
    name: 'Expired Token Cleanup',
    description: 'Purges expired and revoked refresh tokens from the database',
    cronExpression: '0 * * * *', // Every hour
    handler: async () => {
      const result = await prisma.refresh_Token.deleteMany({
        where: {
          OR: [
            { expires_at: { lt: new Date() } },
            { revoked_at: { not: null } },
          ],
        },
      });
      logger.info('Expired tokens cleaned up', { count: result.count });
    },
  });

  // BG:AUDIT:REMINDER:DAILY — send reminders for audit engagement SLA deadlines
  schedulerService.register({
    key: JOB_KEYS.AUDIT_REMINDER_DAILY,
    name: 'Audit Due Date Reminder',
    description: 'Sends reminders for audit engagements approaching their due date',
    cronExpression: '0 8 * * *', // Every day at 08:00
    handler: async () => {
      const now = new Date();
      const reminderWindowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const engagements = await prisma.audit_Engagement.findMany({
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
        const daysRemaining = Math.max(
          0,
          Math.ceil((engagement.sla_deadline.getTime() - now.getTime()) / 86_400_000),
        );
        const recipients = [engagement.lead_auditor, engagement.audit_manager];

        for (const recipient of recipients) {
          const recipientName =
            recipient.display_name ?? `${recipient.first_name} ${recipient.last_name}`.trim();
          const slaVariables = {
            recipientName,
            engagementTitle: engagement.title,
            engagementReference: engagement.reference_number,
            slaDeadline,
            daysRemaining: String(daysRemaining),
          };

          try {
            await notificationQueueService.enqueue(
              'in_app',
              {
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
              },
            );
            await notificationQueueService.enqueue(
              'email',
              {
                to: recipient.email,
                subject: `SLA Deadline Approaching: ${engagement.reference_number}`,
                text: `Audit engagement ${engagement.reference_number} - "${engagement.title}" has an SLA deadline of ${slaDeadline}.`,
                eventKey: 'audit.sla.reminder',
                variables: slaVariables,
              },
            );
            notificationsSent += 2;
          } catch (err) {
            logger.error('Audit reminder notification failed', {
              err,
              engagementId: engagement.id,
              referenceNumber: engagement.reference_number,
              recipientId: recipient.id,
            });
          }
        }
      }

      logger.info('Audit reminder job completed', {
        engagementsFound: engagements.length,
        notificationsSent,
      });
    },
  });

  // BG:AUDIT:FINDING_OVERDUE:DAILY — nag auditees + lead auditors on findings approaching or past their due date
  schedulerService.register({
    key: JOB_KEYS.AUDIT_FINDING_OVERDUE_DAILY,
    name: 'Audit Finding Overdue Reminder',
    description: 'Reminds auditees and lead auditors of findings approaching or past their remediation due date',
    cronExpression: '0 8 * * *', // Every day at 08:00
    handler: async () => {
      const now = new Date();
      const reminderWindowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      const findings = await prisma.audit_Finding.findMany({
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
        const daysRemaining = Math.max(
          0,
          Math.ceil((finding.due_date.getTime() - now.getTime()) / 86_400_000),
        );
        const statusLabel = isOverdue ? `overdue by ${daysOverdue} day(s)` : `due in ${daysRemaining} day(s)`;
        const recipients = [finding.auditee, finding.engagement.lead_auditor];

        for (const recipient of recipients) {
          const recipientName =
            recipient.display_name ?? `${recipient.first_name} ${recipient.last_name}`.trim();
          const findingVariables = {
            recipientName,
            findingTitle: finding.title,
            engagementReference: finding.engagement.reference_number,
            severity: finding.severity,
            dueDate,
            statusLabel,
          };

          try {
            await notificationQueueService.enqueue('in_app', {
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
            await notificationQueueService.enqueue('email', {
              to: recipient.email,
              subject: `Finding ${isOverdue ? 'Overdue' : 'Due Soon'}: ${finding.title}`,
              text: `Finding "${finding.title}" (${finding.engagement.reference_number}) is ${statusLabel}. Due: ${dueDate}.`,
              eventKey: 'audit.finding.overdue',
              variables: findingVariables,
            });
            notificationsSent += 2;
          } catch (err) {
            logger.error('Audit finding overdue notification failed', {
              err,
              findingId: finding.id,
              recipientId: recipient.id,
            });
          }
        }
      }

      logger.info('Audit finding overdue job completed', {
        findingsFound: findings.length,
        notificationsSent,
      });
    },
  });

  // BG:WORKFLOW:ESCALATION:HOURLY — check stalled approvals and breached audit engagement SLAs
  schedulerService.register({
    key: JOB_KEYS.WORKFLOW_ESCALATION_HOURLY,
    name: 'Workflow Escalation Check',
    description: 'Escalates stalled approvals and overdue audit engagements',
    cronExpression: '0 * * * *', // Every hour
    handler: async () => {
      const result = await workflowEscalationService.checkAndEscalate();
      logger.info('Workflow escalation job completed', result);
    },
  });

  // BG:AUDIT:RECONCILE:STATUS:HOURLY — safety-net re-run of engagement status reconcile
  // for any in-request reconcile that may have been skipped (e.g. due to a transient error).
  schedulerService.register({
    key: JOB_KEYS.AUDIT_RECONCILE_STATUS_HOURLY,
    name: 'Engagement Status Reconcile',
    description: 'Re-runs status reconcile across all non-closed engagements as a safety net',
    cronExpression: '0 * * * *', // Every hour
    handler: async () => {
      const { reconcileEngagementStatus } = await import(
        '../../../audit/engagement/service/implementation/engagement-status.reconciler'
      );

      const engagements = await prisma.audit_Engagement.findMany({
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
        } catch (err) {
          logger.error('Engagement status reconcile failed', {
            err,
            engagementId: engagement.id,
          });
        }
      }

      logger.info('Engagement status reconcile job completed', {
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
  schedulerService.register({
    key: JOB_KEYS.MESSAGING_NOTIFICATION_QUEUE_EVERY_MINUTE,
    name: 'Notification Queue Processor',
    description: 'Processes pending email and in-app notifications from the queue (every 15s, priority-ordered)',
    cronExpression: '*/15 * * * * *',
    handler: async () => {
      await notificationQueueService.processQueue();
    },
  });

  // BG:LOG:ARCHIVE:WEEKLY — archive old audit logs to data warehouse
  schedulerService.register({
    key: JOB_KEYS.LOG_ARCHIVE_WEEKLY,
    name: 'Audit Log Archive',
    description: 'Archives audit logs older than 90 days to the data warehouse',
    cronExpression: '0 2 * * 0', // Every Sunday at 02:00
    handler: async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const oldLogs = await prisma.audit_Log.findMany({
        where: { created_at: { lt: ninetyDaysAgo } },
        take: 10000,
      });

      logger.info(
        'Log archive job: logs ready for DWH export',
        { count: oldLogs.length },
      );
      // TODO: push to data warehouse via DataWarehouseClient
    },
  });

  // BG:DOCUMENT:VERSION:PRUNE:WEEKLY — prune old document versions when retention is enabled
  schedulerService.register({
    key: JOB_KEYS.DOCUMENT_VERSION_PRUNE_WEEKLY,
    name: 'Document Version Prune',
    description: 'Prunes old document versions when version_retention is enabled in system config. No-op when disabled (default).',
    cronExpression: '0 3 * * 0', // Every Sunday at 03:00
    handler: async () => {
      const documentService = new DocumentService();
      const result = await documentService.pruneOldVersions();
      logger.info('Document version prune job completed', result);
    },
  });
};
