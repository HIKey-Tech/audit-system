import { WorkflowEscalationRunResult, WorkflowUserBrief } from '../../../domain/entity/workflow.entity';
interface WorkflowUserLike {
    id: string;
    email: string;
    display_name: string | null;
    first_name: string;
    last_name: string;
    department: string | null;
    job_title: string | null;
}
export interface EscalationResponseDto {
    id: string;
    entityType: string;
    entityId: string;
    escalationLevel: number;
    escalatedToId: string;
    reason: string;
    notifiedAt: string;
    acknowledgedAt: string | null;
    createdAt: string;
    escalatedTo?: WorkflowUserBrief;
}
export interface EscalationPolicyResponseDto {
    id: string;
    auditType: string;
    level1Hours: number;
    level2Hours: number;
    level3Hours: number;
    level4Hours: number;
    isActive: boolean;
    createdById: string;
    createdAt: string;
    updatedAt: string;
}
export type EscalationRunResponseDto = WorkflowEscalationRunResult;
export declare const mapEscalationToResponse: (escalation: {
    id: string;
    entity_type: string;
    entity_id: string;
    escalation_level: number;
    escalated_to_id: string;
    reason: string;
    notified_at: Date;
    acknowledged_at: Date | null;
    created_at: Date;
    escalated_to?: WorkflowUserLike;
}) => EscalationResponseDto;
export declare const mapEscalationPolicyToResponse: (policy: {
    id: string;
    audit_type: string;
    level_1_hours: number;
    level_2_hours: number;
    level_3_hours: number;
    level_4_hours: number;
    is_active: boolean;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
}) => EscalationPolicyResponseDto;
export {};
//# sourceMappingURL=escalation.response.dto.d.ts.map