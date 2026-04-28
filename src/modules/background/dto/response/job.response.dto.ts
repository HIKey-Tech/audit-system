// src/modules/background/dto/response/job.response.dto.ts

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

export const mapJobRunToResponse = (run: JobRunRow): JobRunResponseDto => ({
  id: run.id,
  jobId: run.job_id,
  status: run.status,
  startedAt: run.started_at.toISOString(),
  completedAt: run.completed_at?.toISOString() ?? null,
  durationMs: run.completed_at
    ? run.completed_at.getTime() - run.started_at.getTime()
    : null,
  error: run.error,
});

export const mapJobToResponse = (
  job: JobRow,
  lastRun: JobRunRow | null,
): JobResponseDto => ({
  id: job.id,
  jobKey: job.job_key,
  name: job.name,
  description: job.description,
  cronExpression: job.cron_expression,
  isActive: job.is_active,
  lastRunAt: job.last_run_at?.toISOString() ?? null,
  nextRunAt: job.next_run_at?.toISOString() ?? null,
  lastStatus: job.last_status,
  createdAt: job.created_at.toISOString(),
  updatedAt: job.updated_at.toISOString(),
  lastRun: lastRun ? mapJobRunToResponse(lastRun) : null,
});

export const mapJobWithRunsToResponse = (
  job: JobRow,
  runs: JobRunRow[],
): JobWithRunsResponseDto => ({
  ...mapJobToResponse(job, runs[0] ?? null),
  runs: runs.map(mapJobRunToResponse),
});
