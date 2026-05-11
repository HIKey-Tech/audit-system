import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IReportTemplateService } from '../interface/report-template.service.interface';
import { CreateReportTemplateRequestDto, ReportTemplateQueryDto, UpdateReportTemplateRequestDto } from '../../dto/request/settings.request.dto';
import { ReportTemplateResponseDto } from '../../dto/response/settings.response.dto';
import { ReportTemplateVariable } from '../../domain/entity/settings.entity';
export declare class ReportTemplateService implements IReportTemplateService {
    createTemplate(dto: CreateReportTemplateRequestDto, createdBy: string): Promise<ReportTemplateResponseDto>;
    updateTemplate(id: string, dto: UpdateReportTemplateRequestDto, updatedBy: string): Promise<ReportTemplateResponseDto>;
    deactivateTemplate(id: string, updatedBy: string): Promise<void>;
    setDefaultTemplate(id: string, updatedBy: string): Promise<ReportTemplateResponseDto>;
    getTemplateById(id: string): Promise<ReportTemplateResponseDto>;
    getDefaultTemplate(): Promise<ReportTemplateResponseDto>;
    listTemplates(query: ReportTemplateQueryDto): Promise<{
        templates: ReportTemplateResponseDto[];
        meta: PaginationMeta;
    }>;
    getAvailableVariables(): Promise<ReportTemplateVariable[]>;
    private _assertTemplateExists;
}
export declare const reportTemplateService: ReportTemplateService;
//# sourceMappingURL=report-template.service.d.ts.map