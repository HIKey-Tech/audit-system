import { WorkflowActorContext, WorkflowEscalationRunResult } from '../../../domain/entity/workflow.entity';
import { WorkflowEscalationEntityType } from '../../../domain/enum/workflow.enum';
import { UpsertEscalationPolicyRequestDto } from '../../dto/request/escalation.request.dto';
import { EscalationPolicyResponseDto, EscalationResponseDto } from '../../dto/response/escalation.response.dto';
export interface IEscalationService {
    checkAndEscalate(): Promise<WorkflowEscalationRunResult>;
    acknowledgeEscalation(escalationId: string, userId: string): Promise<EscalationResponseDto>;
    getEscalationHistory(entityType: WorkflowEscalationEntityType, entityId: string): Promise<EscalationResponseDto[]>;
    listEscalationPolicies(): Promise<EscalationPolicyResponseDto[]>;
    createOrUpdateEscalationPolicy(dto: UpsertEscalationPolicyRequestDto, updatedBy: WorkflowActorContext): Promise<EscalationPolicyResponseDto>;
}
//# sourceMappingURL=escalation.service.interface.d.ts.map