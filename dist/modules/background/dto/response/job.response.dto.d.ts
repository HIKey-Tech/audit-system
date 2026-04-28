export interface JobRunResponseDto {
    id: string;
    jobId: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    error: string | null;
}
export interface JobResponseDto {
    id: string;
    jobKey: string;
    name: string;
    description: string | null;
    cronExpression: string;
    isActive: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastStatus: string | null;
    createdAt: string;
    updatedAt: string;
    lastRun: JobRunResponseDto | null;
}
export interface JobWithRunsResponseDto extends JobResponseDto {
    runs: JobRunResponseDto[];
}
interface JobRunRow {
    id: string;
    job_id: string;
    status: string;
    started_at: Date;
    completed_at: Date | null;
    error: string | null;
}
interface JobRow {
    id: string;
    job_key: string;
    name: string;
    description: string | null;
    cron_expression: string;
    is_active: boolean;
    last_run_at: Date | null;
    next_run_at: Date | null;
    last_status: string | null;
    created_at: Date;
    updated_at: Date;
}
export declare const mapJobRunToResponse: (run: JobRunRow) => JobRunResponseDto;
export declare const mapJobToResponse: (job: JobRow, lastRun: JobRunRow | null) => JobResponseDto;
export declare const mapJobWithRunsToResponse: (job: JobRow, runs: JobRunRow[]) => JobWithRunsResponseDto;
export {};
//# sourceMappingURL=job.response.dto.d.ts.map