import { BulkUpdateSystemConfigRequestDto } from '../../dto/request/settings.request.dto';
import { SystemConfigResponseDto } from '../../dto/response/settings.response.dto';

export interface ISystemConfigService {
  getConfig(key: string): Promise<SystemConfigResponseDto>;

  getAllConfig(includePrivate: boolean): Promise<SystemConfigResponseDto[]>;

  updateConfig(
    key: string,
    value: string | null,
    updatedBy: string,
  ): Promise<SystemConfigResponseDto>;

  bulkUpdateConfig(
    dto: BulkUpdateSystemConfigRequestDto,
    updatedBy: string,
  ): Promise<SystemConfigResponseDto[]>;
}
