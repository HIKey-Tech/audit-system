"use strict";
// src/modules/background/dto/response/job.response.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapJobWithRunsToResponse = exports.mapJobToResponse = exports.mapJobRunToResponse = void 0;
const mapJobRunToResponse = (run) => ({
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
exports.mapJobRunToResponse = mapJobRunToResponse;
const mapJobToResponse = (job, lastRun) => ({
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
    lastRun: lastRun ? (0, exports.mapJobRunToResponse)(lastRun) : null,
});
exports.mapJobToResponse = mapJobToResponse;
const mapJobWithRunsToResponse = (job, runs) => ({
    ...(0, exports.mapJobToResponse)(job, runs[0] ?? null),
    runs: runs.map(exports.mapJobRunToResponse),
});
exports.mapJobWithRunsToResponse = mapJobWithRunsToResponse;
//# sourceMappingURL=job.response.dto.js.map