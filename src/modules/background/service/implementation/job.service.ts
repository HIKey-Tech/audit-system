// src/modules/background/service/implementation/job.service.ts
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { AppError } from '../../../../shared/errors/app.error';
import {
  PaginationMeta,
  parsePagination,
  buildPaginationMeta,
} from '../../../../shared/types/api-response.type';
import { auditLogService } from '../../../logging/service/implementation/audit-log.service';
import { schedulerService } from './scheduler.service';
import { IBackgroundJobService } from '../interface/job.service.interface';
import { JobRunHistoryQueryDto } from '../../dto/request/job.request.dto';
import {
  JobResponseDto,
  JobRunResponseDto,
  JobWithRunsResponseDto,
  mapJobRunToResponse,
  mapJobToResponse,
  mapJobWithRunsToResponse,
} from '../../dto/response/job.response.dto';

const RECENT_RUNS_LIMIT = 50;

export class BackgroundJobService implements IBackgroundJobService {
  async listJobs(): Promise<JobResponseDto[]> {
    const jobs = await prisma.scheduled_Job.findMany({
      orderBy: { job_key: 'asc' },
      include: {
        job_runs: {
          orderBy: { started_at: 'desc' },
          take: 1,
        },
      },
    });

    return jobs.map((job) => mapJobToResponse(job, job.job_runs[0] ?? null));
  }

  async getJobById(id: string): Promise<JobWithRunsResponseDto> {
    const job = await prisma.scheduled_Job.findUnique({
      where: { id },
      include: {
        job_runs: {
          orderBy: { started_at: 'desc' },
          take: RECENT_RUNS_LIMIT,
        },
      },
    });

    if (!job) {
      throw AppError.notFound('Scheduled job');
    }

    return mapJobWithRunsToResponse(job, job.job_runs);
  }

  async enableJob(id: string, actorId: string): Promise<JobResponseDto> {
    return this._setActive(id, true, actorId);
  }

  async disableJob(id: string, actorId: string): Promise<JobResponseDto> {
    return this._setActive(id, false, actorId);
  }

  async listRuns(
    id: string,
    query: JobRunHistoryQueryDto,
  ): Promise<{ runs: JobRunResponseDto[]; meta: PaginationMeta }> {
    const job = await prisma.scheduled_Job.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!job) {
      throw AppError.notFound('Scheduled job');
    }

    const { skip, take, page, pageSize } = parsePagination(query);

    const where = {
      job_id: id,
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, runs] = await prisma.$transaction([
      prisma.scheduled_Job_Run.count({ where }),
      prisma.scheduled_Job_Run.findMany({
        where,
        orderBy: { started_at: query.sortOrder },
        skip,
        take,
      }),
    ]);

    return {
      runs: runs.map(mapJobRunToResponse),
      meta: buildPaginationMeta(total, page, pageSize),
    };
  }

  private async _setActive(
    id: string,
    isActive: boolean,
    actorId: string,
  ): Promise<JobResponseDto> {
    const existing = await prisma.scheduled_Job.findUnique({
      where: { id },
      select: { id: true, job_key: true, is_active: true },
    });

    if (!existing) {
      throw AppError.notFound('Scheduled job');
    }

    if (isActive) {
      await schedulerService.startJob(existing.job_key);
    } else {
      await schedulerService.stopJob(existing.job_key);
    }

    const updated = await prisma.scheduled_Job.findUniqueOrThrow({
      where: { id },
      include: {
        job_runs: {
          orderBy: { started_at: 'desc' },
          take: 1,
        },
      },
    });

    logger.info('Scheduled job state changed', {
      jobId: updated.id,
      jobKey: updated.job_key,
      isActive,
      actorId,
    });

    auditLogService.logAsync({
      userId: actorId,
      action: isActive ? 'background.job.enable' : 'background.job.disable',
      module: 'background',
      entityType: 'scheduled_job',
      entityId: updated.id,
      oldValues: { isActive: existing.is_active },
      newValues: { isActive: updated.is_active },
    });

    return mapJobToResponse(updated, updated.job_runs[0] ?? null);
  }
}

export const backgroundJobService = new BackgroundJobService();
