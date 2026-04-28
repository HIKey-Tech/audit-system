import { PaginationMeta } from '../../../../../shared/types/api-response.type';
import { WorkflowActorContext } from '../../../domain/entity/workflow.entity';
import { AssignStaffRequestDto, MyAssignmentsQueryDto } from '../../dto/request/assignment.request.dto';
import { AssignmentResponseDto, WorkloadResponseDto } from '../../dto/response/assignment.response.dto';
export interface IAssignmentService {
    assignStaff(dto: AssignStaffRequestDto, assignedBy: WorkflowActorContext): Promise<AssignmentResponseDto>;
    removeAssignment(assignmentId: string, removedBy: WorkflowActorContext): Promise<void>;
    getAssignments(engagementId: string): Promise<AssignmentResponseDto[]>;
    getMyAssignments(userId: string, filters: MyAssignmentsQueryDto): Promise<{
        assignments: AssignmentResponseDto[];
        meta: PaginationMeta;
    }>;
    getUserWorkload(userId: string): Promise<WorkloadResponseDto>;
}
//# sourceMappingURL=assignment.service.interface.d.ts.map