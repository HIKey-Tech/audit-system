import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IAuditLogService, CreateAuditLogDto } from '../interface/audit-log.service.interface';
import { AuditLogListQueryDto, AuditLogSummaryQueryDto } from '../../dto/request/logging.request.dto';
import { AuditLogResponseDto, AuditLogSummaryDto } from '../../dto/response/logging.response.dto';
export declare class AuditLogService implements IAuditLogService {
    log(dto: CreateAuditLogDto): Promise<void>;
    logAsync(dto: CreateAuditLogDto): void;
    listLogs(query: AuditLogListQueryDto): Promise<{
        logs: AuditLogResponseDto[];
        meta: PaginationMeta;
    }>;
    getLogById(id: string): Promise<AuditLogResponseDto>;
    getDistinctModules(): Promise<string[]>;
    getLogSummary(query: AuditLogSummaryQueryDto): Promise<AuditLogSummaryDto[]>;
    private _buildWhere;
    private _buildDateWhere;
}
export declare const auditLogService: AuditLogService;
//# sourceMappingURL=audit-log.service.d.ts.map