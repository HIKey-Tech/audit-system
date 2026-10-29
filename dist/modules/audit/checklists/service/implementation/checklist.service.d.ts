import { ActorContext, ChecklistProgress } from '../../../domain/entity/audit.entity';
import { AuditType } from '../../../domain/enum/audit.enum';
import { ChecklistTemplateControl } from '../../../utility/audit-config.utility';
import { BulkCreateChecklistItemsRequestDto, CreateChecklistItemRequestDto, ImportDocumentChecklistsDto, ImportFrameworkChecklistsRequestDto, UpdateChecklistItemRequestDto, UpdateChecklistTemplatesRequestDto } from '../../dto/request/checklist.request.dto';
import { ChecklistResponseDto } from '../../dto/response/checklist.response.dto';
import { IChecklistService } from '../interface/checklist.service.interface';
export declare class ChecklistService implements IChecklistService {
    populateChecklists(engagementId: string, actorId: string): Promise<void>;
    createChecklistItem(engagementId: string, dto: CreateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto>;
    bulkCreateChecklistItems(engagementId: string, dto: BulkCreateChecklistItemsRequestDto, actor: ActorContext): Promise<{
        addedCount: number;
        items: ChecklistResponseDto[];
    }>;
    importFrameworkControls(engagementId: string, dto: ImportFrameworkChecklistsRequestDto, actor: ActorContext): Promise<{
        addedCount: number;
        items: ChecklistResponseDto[];
    }>;
    importDocumentControls(engagementId: string, file: {
        buffer: Buffer;
        mimetype: string;
        originalname: string;
    } | undefined, dto: ImportDocumentChecklistsDto, actor: ActorContext): Promise<{
        addedCount: number;
        items: ChecklistResponseDto[];
        frameworkId?: string;
    }>;
    updateChecklistItem(id: string, dto: UpdateChecklistItemRequestDto, actor: ActorContext): Promise<ChecklistResponseDto>;
    linkEvidenceToChecklistItem(checklistItemId: string, evidenceId: string, actor: ActorContext): Promise<ChecklistResponseDto>;
    getChecklists(engagementId: string, actor: ActorContext): Promise<Record<string, ChecklistResponseDto[]>>;
    getChecklistProgress(engagementId: string): Promise<ChecklistProgress>;
    getChecklistTemplates(): Promise<Record<AuditType, ChecklistTemplateControl[]>>;
    previewControlsForAuditType(auditType: AuditType): Promise<ChecklistTemplateControl[]>;
    updateChecklistTemplates(dto: UpdateChecklistTemplatesRequestDto, actor: ActorContext): Promise<Record<AuditType, ChecklistTemplateControl[]>>;
    private _getChecklistEngagement;
    /**
     * Checklist writes are limited to the engagement's audit team (lead, manager, assignee)
     * and oversight (`engagement:read_all`), so holding `checklist:*` alone can't touch
     * another engagement's tests. Reported as not-found so existence isn't revealed.
     */
    private _assertEngagementTeam;
}
//# sourceMappingURL=checklist.service.d.ts.map