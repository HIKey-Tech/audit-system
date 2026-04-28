import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IBackgroundJobService } from '../interface/job.service.interface';
import { JobRunHistoryQueryDto } from '../../dto/request/job.request.dto';
import { JobResponseDto, JobRunResponseDto, JobWithRunsResponseDto } from '../../dto/response/job.response.dto';
export declare class BackgroundJobService implements IBackgroundJobService {
    listJobs(): Promise<JobResponseDto[]>;
    getJobById(id: string): Promise<JobWithRunsResponseDto>;
    enableJob(id: string, actorId: string): Promise<JobResponseDto>;
    disableJob(id: string, actorId: string): Promise<JobResponseDto>;
    listRuns(id: string, query: JobRunHistoryQueryDto): Promise<{
        runs: JobRunResponseDto[];
        meta: PaginationMeta;
    }>;
    private _setActive;
}
export declare const backgroundJobService: BackgroundJobService;
//# sourceMappingURL=job.service.d.ts.map