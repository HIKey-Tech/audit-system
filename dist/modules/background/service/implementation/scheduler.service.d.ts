/**
 * Job Key Naming Convention:
 *   BG:<MODULE>:<ACTION>:<FREQUENCY>
 *   Examples:
 *     BG:AUDIT:REMINDER:DAILY
 *     BG:TOKEN:CLEANUP:HOURLY
 *     BG:REPORT:GENERATE:WEEKLY
 */
export declare const JOB_KEYS: {
    readonly TOKEN_CLEANUP_HOURLY: "BG:TOKEN:CLEANUP:HOURLY";
    readonly AUDIT_REMINDER_DAILY: "BG:AUDIT:REMINDER:DAILY";
    readonly AUDIT_FINDING_OVERDUE_DAILY: "BG:AUDIT:FINDING_OVERDUE:DAILY";
    readonly MESSAGING_NOTIFICATION_QUEUE_EVERY_MINUTE: "BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE";
    readonly WORKFLOW_ESCALATION_HOURLY: "BG:WORKFLOW:ESCALATION:HOURLY";
    readonly AUDIT_RECONCILE_STATUS_HOURLY: "BG:AUDIT:RECONCILE:STATUS:HOURLY";
    readonly LOG_ARCHIVE_WEEKLY: "BG:LOG:ARCHIVE:WEEKLY";
    readonly REPORT_GENERATE_MONTHLY: "BG:REPORT:GENERATE:MONTHLY";
    readonly DOCUMENT_VERSION_PRUNE_WEEKLY: "BG:DOCUMENT:VERSION:PRUNE:WEEKLY";
};
export type JobKey = (typeof JOB_KEYS)[keyof typeof JOB_KEYS];
interface RegisteredJob {
    key: JobKey;
    name: string;
    description: string;
    cronExpression: string;
    handler: () => Promise<void>;
}
declare class SchedulerService {
    private readonly jobs;
    private readonly tasks;
    register(job: RegisteredJob): void;
    startAll(): Promise<void>;
    stopAll(): void;
    startJob(jobKey: string): Promise<void>;
    stopJob(jobKey: string): Promise<void>;
    private _runJob;
    private _upsertJobRecord;
    private _getJobId;
}
export declare const schedulerService: SchedulerService;
export declare const registerAllJobs: () => void;
export {};
//# sourceMappingURL=scheduler.service.d.ts.map