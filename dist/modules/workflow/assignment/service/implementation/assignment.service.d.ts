import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { AssignStaffRequestDto, MyAssignmentsQueryDto } from '../../dto/request/assignment.request.dto';
import { AssignmentResponseDto, WorkloadResponseDto, AssignmentCandidateDto } from '../../dto/response/assignment.response.dto';
import { IAssignmentService } from '../interface/assignment.service.interface';
export declare class AssignmentService implements IAssignmentService {
    assignStaff(dto: AssignStaffRequestDto, assignedBy: WorkflowActorContext): Promise<AssignmentResponseDto>;
    removeAssignment(assignmentId: string, removedBy: WorkflowActorContext): Promise<void>;
    getAssignments(engagementId: string, actor: WorkflowActorContext): Promise<AssignmentResponseDto[]>;
    getMyAssignments(userId: string, filters: MyAssignmentsQueryDto): Promise<{
        assignments: AssignmentResponseDto[];
        meta: PaginationMeta;
    }>;
    getUserWorkload(userId: string): Promise<WorkloadResponseDto>;
    getCandidates(engagementId: string, actor: WorkflowActorContext): Promise<AssignmentCandidateDto[]>;
    private _assertCanViewEngagementAssignments;
    getActiveWorkloadMap(): Promise<Map<string, number>>;
}
export declare const workflowAssignmentService: AssignmentService;
//# sourceMappingURL=assignment.service.d.ts.map