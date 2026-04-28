import { WorkflowActorContext, WorkflowEscalationRunResult } from '../../../domain/entity/workflow.entity';
import { EscalationPolicyAuditType, WorkflowEscalationEntityType } from '../../../domain/enum/workflow.enum';
import { UpsertEscalationPolicyRequestDto } from '../../dto/request/escalation.request.dto';
import { EscalationPolicyResponseDto, EscalationResponseDto } from '../../dto/response/escalation.response.dto';
import { IEscalationService } from '../interface/escalation.service.interface';
export declare class EscalationService implements IEscalationService {
    checkAndEscalate(): Promise<WorkflowEscalationRunResult>;
    acknowledgeEscalation(escalationId: string, userId: string): Promise<EscalationResponseDto>;
    getEscalationHistory(entityType: WorkflowEscalationEntityType, entityId: string): Promise<EscalationResponseDto[]>;
    getEscalationPolicy(auditType: EscalationPolicyAuditType): Promise<EscalationPolicyResponseDto>;
    createOrUpdateEscalationPolicy(dto: UpsertEscalationPolicyRequestDto, updatedBy: WorkflowActorContext): Promise<EscalationPolicyResponseDto>;
    private _fireEscalation;
    private _resolveEscalationTargets;
    private _getUsersByRole;
    private _getLatestEscalation;
    private _getPolicyThresholds;
    private _thresholdForLevel;
    private _notifyTarget;
}
export declare const workflowEscalationService: EscalationService;
//# sourceMappingURL=escalation.service.d.ts.map