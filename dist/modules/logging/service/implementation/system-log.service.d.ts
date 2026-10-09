import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { SystemLogListQueryDto } from '../../dto/request/logging.request.dto';
import { SystemLogResponseDto } from '../../dto/response/logging.response.dto';
import { ISystemLogService } from '../interface/audit-log.service.interface';
export declare class SystemLogService implements ISystemLogService {
    listSystemLogs(query: SystemLogListQueryDto): Promise<{
        logs: SystemLogResponseDto[];
        meta: PaginationMeta;
    }>;
    getSystemLogById(id: string): Promise<SystemLogResponseDto>;
    countRecent(days: number): Promise<{
        total: number;
        bySource: Record<string, number>;
    }>;
}
export declare const systemLogService: SystemLogService;
//# sourceMappingURL=system-log.service.d.ts.map