import { PaginationMeta } from '../../../../shared/types/api-response.type';
import { ITemplateService } from '../interface/template.service.interface';
import { CreateTemplateRequestDto, UpdateTemplateRequestDto, TemplateQueryDto } from '../../dto/request/template.request.dto';
import { NotificationTemplateResponseDto } from '../../dto/response/template.response.dto';
import { NotificationTemplateChannel } from '../../domain/enum/template.enum';
export declare class TemplateService implements ITemplateService {
    createTemplate(dto: CreateTemplateRequestDto, createdBy: string): Promise<NotificationTemplateResponseDto>;
    updateTemplate(id: string, dto: UpdateTemplateRequestDto, updatedBy: string): Promise<NotificationTemplateResponseDto>;
    deactivateTemplate(id: string, updatedBy: string): Promise<void>;
    getTemplateByEventAndChannel(eventKey: string, channel: NotificationTemplateChannel): Promise<NotificationTemplateResponseDto | null>;
    getTemplateById(id: string): Promise<NotificationTemplateResponseDto>;
    listTemplates(query: TemplateQueryDto): Promise<{
        templates: NotificationTemplateResponseDto[];
        meta: PaginationMeta;
    }>;
    /**
     * Idempotently syncs default notification templates to the database at server
     * startup so updated wording (e.g. OLA vs SLA, new event keys) takes effect
     * on deployment without requiring a manual `prisma db seed` run.
     */
    syncDefaultTemplates(): Promise<void>;
    private _assertTemplateExists;
}
export declare const templateService: TemplateService;
//# sourceMappingURL=template.service.d.ts.map