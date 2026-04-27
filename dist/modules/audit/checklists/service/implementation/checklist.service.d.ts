import { ActorContext, ChecklistProgress } from '../../../domain/entity/audit.entity';
import { UpdateChecklistItemRequestDto } from '../../dto/request/checklist.request.dto';
import { ChecklistResponseDto } from '../../dto/response/checklist.response.dto';
import { IChecklistService } from '../interface/checklist.service.interface';
export declare class ChecklistService implements IChecklistService {
    populateChecklists(engagementId: string, actorId: string): Promise<void>;
    updateChecklistItem(id: string, dto: UpdateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto>;
    linkEvidenceToChecklistItem(checklistItemId: string, evidenceId: string, actor: ActorContext): Promise<ChecklistResponseDto>;
    getChecklists(engagementId: string): Promise<Record<string, ChecklistResponseDto[]>>;
    getChecklistProgress(engagementId: string): Promise<ChecklistProgress>;
    private _assertChecklistExists;
}
//# sourceMappingURL=checklist.service.d.ts.map