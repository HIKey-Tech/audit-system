// src/modules/background/service/implementation/scheduler.service.ts
import cron from 'node-cron';
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { workflowEscalationService } from '../../../workflow/escalation/service/implementation/escalation.service';

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
  WORKFLOW_ESCALATION_HOURLY: 'BG:WORKFLOW:ESCALATION:HOURLY',
  LOG_ARCHIVE_WEEKLY: 'BG:LOG:ARCHIVE:WEEKLY',
  REPORT_GENERATE_MONTHLY: 'BG:REPORT:GENERATE:MONTHLY',
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

  private async _upsertJobRecord(job: RegisteredJob): Promise<{ is_active: boolean }> {
    return prisma.scheduled_Job.upsert({
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

  // BG:AUDIT:REMINDER:DAILY — send reminders for overdue audit tasks
  schedulerService.register({
    key: JOB_KEYS.AUDIT_REMINDER_DAILY,
    name: 'Audit Due Date Reminder',
    description: 'Sends reminders for audit engagements approaching their due date',
    cronExpression: '0 8 * * *', // Every day at 08:00
    handler: async () => {
      // NOTE: stubbed until the Audit module adds `audit_engagement` to the schema.
      // Restore the real query (due-date window + notification dispatch) once that model exists.
      logger.info('Audit reminder job: skipped (audit_engagement model not yet defined)');
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
};
