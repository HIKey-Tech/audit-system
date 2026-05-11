import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { IWorkingPaperTemplateService } from '../interface/working-paper-template.service.interface';
import { CreateWorkingPaperTemplateRequestDto, UpdateWorkingPaperTemplateRequestDto, WorkingPaperTemplateQueryDto } from '../../dto/request/settings.request.dto';
import { WorkingPaperTemplateResponseDto } from '../../dto/response/settings.response.dto';
import { SettingsAuditType } from '../../domain/enum/settings.enum';
export declare class WorkingPaperTemplateService implements IWorkingPaperTemplateService {
    createTemplate(dto: CreateWorkingPaperTemplateRequestDto, createdBy: string): Promise<WorkingPaperTemplateResponseDto>;
    updateTemplate(id: string, dto: UpdateWorkingPaperTemplateRequestDto, updatedBy: string): Promise<WorkingPaperTemplateResponseDto>;
    deactivateTemplate(id: string, updatedBy: string): Promise<void>;
    setDefaultTemplate(id: string, updatedBy: string): Promise<WorkingPaperTemplateResponseDto>;
    getTemplateById(id: string): Promise<WorkingPaperTemplateResponseDto>;
    getDefaultTemplate(auditType: SettingsAuditType): Promise<WorkingPaperTemplateResponseDto>;
    listTemplates(query: WorkingPaperTemplateQueryDto): Promise<{
        templates: WorkingPaperTemplateResponseDto[];
        meta: PaginationMeta;
    }>;
    private _assertTemplateExists;
}
export declare const workingPaperTemplateService: WorkingPaperTemplateService;
//# sourceMappingURL=working-paper-template.service.d.ts.map