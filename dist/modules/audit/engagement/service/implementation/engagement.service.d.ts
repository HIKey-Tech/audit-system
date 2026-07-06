import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { EngagementStatus } from '../../../domain/enum/audit.enum';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { IChecklistService } from '../../../checklists/service/interface/checklist.service.interface';
import { IUserService } from '../../../../user';
import { IAssignmentService } from '../../../../workflow/assignment/service/interface/assignment.service.interface';
import { CreateAdhocEngagementRequestDto, CreateEngagementFromPlanRequestDto, EligibleUsersQueryDto, EngagementQueryDto, UpdateEngagementRequestDto } from '../../dto/request/engagement.request.dto';
import { EligibleUserDto, EngagementResponseDto } from '../../dto/response/engagement.response.dto';
import { IEngagementService } from '../interface/engagement.service.interface';
export declare class EngagementService implements IEngagementService {
    private readonly checklistService;
    private readonly userService;
    private readonly assignmentService;
    private readonly approvalService;
    constructor(checklistService: IChecklistService, userService: IUserService, assignmentService: IAssignmentService, approvalService?: IApprovalService);
    private _assertManagerCanApprove;
    private _assertLeadAuditorEligible;
    private _assertUniverseActive;
    private _assertAuditeeActive;
    getEligibleUsers(query: EligibleUsersQueryDto): Promise<EligibleUserDto[]>;
    createFromPlanItem(planItemId: string, dto: CreateEngagementFromPlanRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    createAdhoc(dto: CreateAdhocEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    updateEngagement(id: string, dto: UpdateEngagementRequestDto, actor: ActorContext): Promise<EngagementResponseDto>;
    updateStatus(id: string, newStatus: EngagementStatus, actor: ActorContext): Promise<EngagementResponseDto>;
    /**
     * Access scope: unless the actor can read ALL engagements, they may only see
     * engagements they are a party to — lead auditor, audit manager, auditee, or a
     * workflow assignee. Returns undefined for unrestricted (read_all) access.
     */
    private _actorScope;
    /**
     * Active-approver access: a user with a pending approval step they may act on,
     * against one of this engagement's reports / working papers / findings, can open
     * the engagement while that step is open — you can't approve what you can't read.
     */
    private _hasActiveApprovalAccess;
    getEngagementById(id: string, actor: ActorContext): Promise<EngagementResponseDto>;
    listEngagements(query: EngagementQueryDto, actor: ActorContext): Promise<{
        engagements: EngagementResponseDto[];
        meta: PaginationMeta;
    }>;
    private _nextReferenceNumber;
    private _assertEngagementExists;
    private _withMetrics;
    private _assertLifecycleGate;
}
//# sourceMappingURL=engagement.service.d.ts.map