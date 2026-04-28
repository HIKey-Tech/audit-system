import { WorkflowEscalationRunResult, WorkflowUserBrief } from '../../../domain/entity/workflow.entity';
import { mapWorkflowUserBrief } from '../../../approval/dto/response/approval.response.dto';

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

export const mapEscalationToResponse = (escalation: {
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
}): EscalationResponseDto => ({
  id: escalation.id,
  entityType: escalation.entity_type,
  entityId: escalation.entity_id,
  escalationLevel: escalation.escalation_level,
  escalatedToId: escalation.escalated_to_id,
  reason: escalation.reason,
  notifiedAt: escalation.notified_at.toISOString(),
  acknowledgedAt: escalation.acknowledged_at?.toISOString() ?? null,
  createdAt: escalation.created_at.toISOString(),
  escalatedTo: escalation.escalated_to ? mapWorkflowUserBrief(escalation.escalated_to) : undefined,
});

export const mapEscalationPolicyToResponse = (policy: {
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
}): EscalationPolicyResponseDto => ({
  id: policy.id,
  auditType: policy.audit_type,
  level1Hours: policy.level_1_hours,
  level2Hours: policy.level_2_hours,
  level3Hours: policy.level_3_hours,
  level4Hours: policy.level_4_hours,
  isActive: policy.is_active,
  createdById: policy.created_by_id,
  createdAt: policy.created_at.toISOString(),
  updatedAt: policy.updated_at.toISOString(),
});
