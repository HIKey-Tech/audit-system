import { ISystemConfigService } from '../interface/system-config.service.interface';
import { BulkUpdateSystemConfigRequestDto } from '../../dto/request/settings.request.dto';
import { SystemConfigResponseDto } from '../../dto/response/settings.response.dto';
export declare class SystemConfigService implements ISystemConfigService {
    getConfig(key: string): Promise<SystemConfigResponseDto>;
    getAllConfig(includePrivate: boolean): Promise<SystemConfigResponseDto[]>;
    updateConfig(key: string, value: string | null, updatedBy: string): Promise<SystemConfigResponseDto>;
    bulkUpdateConfig(dto: BulkUpdateSystemConfigRequestDto, updatedBy: string): Promise<SystemConfigResponseDto[]>;
    private _assertConfigExists;
}
export declare const systemConfigService: SystemConfigService;
//# sourceMappingURL=system-config.service.d.ts.map