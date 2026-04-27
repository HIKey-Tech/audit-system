import { ActorContext, ChecklistProgress } from '../../../domain/entity/audit.entity';
import { UpdateChecklistItemRequestDto } from '../../dto/request/checklist.request.dto';
import { ChecklistResponseDto } from '../../dto/response/checklist.response.dto';
export interface IChecklistService {
    populateChecklists(engagementId: string, actorId: string): Promise<void>;
    updateChecklistItem(id: string, dto: UpdateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto>;
    linkEvidenceToChecklistItem(checklistItemId: string, evidenceId: string, actor: ActorContext): Promise<ChecklistResponseDto>;
    getChecklists(engagementId: string): Promise<Record<string, ChecklistResponseDto[]>>;
    getChecklistProgress(engagementId: string): Promise<ChecklistProgress>;
}
//# sourceMappingURL=checklist.service.interface.d.ts.map