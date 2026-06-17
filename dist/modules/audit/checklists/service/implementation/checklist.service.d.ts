import { ActorContext, ChecklistProgress } from '../../../domain/entity/audit.entity';
import { AuditType } from '../../../domain/enum/audit.enum';
import { ChecklistTemplateControl } from '../../../utility/audit-config.utility';
import { CreateChecklistItemRequestDto, UpdateChecklistItemRequestDto, UpdateChecklistTemplatesRequestDto } from '../../dto/request/checklist.request.dto';
import { ChecklistResponseDto } from '../../dto/response/checklist.response.dto';
import { IChecklistService } from '../interface/checklist.service.interface';
export declare class ChecklistService implements IChecklistService {
    populateChecklists(engagementId: string, actorId: string): Promise<void>;
    createChecklistItem(engagementId: string, dto: CreateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto>;
    updateChecklistItem(id: string, dto: UpdateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto>;
    linkEvidenceToChecklistItem(checklistItemId: string, evidenceId: string, actor: ActorContext): Promise<ChecklistResponseDto>;
    getChecklists(engagementId: string): Promise<Record<string, ChecklistResponseDto[]>>;
    getChecklistProgress(engagementId: string): Promise<ChecklistProgress>;
    getChecklistTemplates(): Promise<Record<AuditType, ChecklistTemplateControl[]>>;
    updateChecklistTemplates(dto: UpdateChecklistTemplatesRequestDto, actor: ActorContext): Promise<Record<AuditType, ChecklistTemplateControl[]>>;
    private _assertChecklistExists;
}
//# sourceMappingURL=checklist.service.d.ts.map