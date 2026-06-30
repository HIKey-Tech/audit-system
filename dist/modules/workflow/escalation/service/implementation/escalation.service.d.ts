import { WorkflowActorContext, WorkflowEscalationRunResult } from '../../../domain/entity/workflow.entity';
import { WorkflowEscalationEntityType } from '../../../domain/enum/workflow.enum';
import { UpsertEscalationPolicyRequestDto } from '../../dto/request/escalation.request.dto';
import { EscalationPolicyResponseDto, EscalationResponseDto } from '../../dto/response/escalation.response.dto';
import { IEscalationService } from '../interface/escalation.service.interface';
export declare class EscalationService implements IEscalationService {
    checkAndEscalate(): Promise<WorkflowEscalationRunResult>;
    acknowledgeEscalation(escalationId: string, userId: string): Promise<EscalationResponseDto>;
    getEscalationHistory(entityType: WorkflowEscalationEntityType, entityId: string, actor: WorkflowActorContext): Promise<EscalationResponseDto[]>;
    listEscalationPolicies(): Promise<EscalationPolicyResponseDto[]>;
    createOrUpdateEscalationPolicy(dto: UpsertEscalationPolicyRequestDto, updatedBy: WorkflowActorContext): Promise<EscalationPolicyResponseDto>;
    private _fireEscalation;
    private _resolveEscalationTargets;
    private _assertCanViewEscalationHistory;
    private _getUsersByRoles;
    private _getUsersByPermission;
    private _latestEscalationMap;
    private _loadPolicyThresholds;
    private _resolveThresholds;
    private _thresholdForLevel;
    private _notifyTarget;
}
export declare const workflowEscalationService: EscalationService;
//# sourceMappingURL=escalation.service.d.ts.map