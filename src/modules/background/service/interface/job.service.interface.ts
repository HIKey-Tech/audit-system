// src/modules/background/service/interface/job.service.interface.ts
import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { JobRunHistoryQueryDto } from '../../dto/request/job.request.dto';
import {
  JobResponseDto,
  JobRunResponseDto,
  JobWithRunsResponseDto,
} from '../../dto/response/job.response.dto';

export interface IBackgroundJobService {
  listJobs(): Promise<JobResponseDto[]>;
  getJobById(id: string): Promise<JobWithRunsResponseDto>;
  enableJob(id: string, actorId: string): Promise<JobResponseDto>;
  disableJob(id: string, actorId: string): Promise<JobResponseDto>;
  listRuns(
    id: string,
    query: JobRunHistoryQueryDto,
  ): Promise<{ runs: JobRunResponseDto[]; meta: PaginationMeta }>;
}
