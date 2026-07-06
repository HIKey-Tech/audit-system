import { WorkflowUserBrief } from '../../../domain/entity/workflow.entity';

interface WorkflowUserLike {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
  department: string | null;
  job_title: string | null;
}

export interface ApprovalStepResponseDto {
  id: string;
  approvalId: string;
  level: number;
  approverId: string | null;
  requiredPermission: string | null;
  status: string;
  comment: string | null;
  actedAt: string | null;
  signatureId: string | null;
  createdAt: string;
  approver?: WorkflowUserBrief;
}

export interface SignedApprovalDocumentDto {
  id: string;
  signedDocumentId: string;
  downloadUrl: string;
  generatedAt: string;
}

export interface ApprovalResponseDto {
  id: string;
  entityType: string;
  entityId: string;
  /** Human-readable name of the entity awaiting approval (list endpoints only). */
  entityTitle?: string | null;
  /** Parent engagement, when the entity belongs to one (list endpoints only). */
  engagementId?: string | null;
  submittedById: string;
  currentLevel: number;
  status: string;
  rejectionReason: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submittedBy?: WorkflowUserBrief;
  steps?: ApprovalStepResponseDto[];
}

export const mapWorkflowUserBrief = (user: WorkflowUserLike): WorkflowUserBrief => ({
  id: user.id,
  email: user.email,
  displayName: user.display_name ?? `${user.first_name} ${user.last_name}`,
  firstName: user.first_name,
  lastName: user.last_name,
  department: user.department,
  jobTitle: user.job_title,
});

export const mapApprovalStepToResponse = (step: {
  id: string;
  approval_id: string;
  level: number;
  approver_id: string | null;
  required_permission: string | null;
  status: string;
  comment: string | null;
  acted_at: Date | null;
  signature_id?: string | null;
  created_at: Date;
  approver?: WorkflowUserLike | null;
}): ApprovalStepResponseDto => ({
  id: step.id,
  approvalId: step.approval_id,
  level: step.level,
  approverId: step.approver_id,
  requiredPermission: step.required_permission,
  status: step.status,
  comment: step.comment,
  actedAt: step.acted_at?.toISOString() ?? null,
  signatureId: step.signature_id ?? null,
  createdAt: step.created_at.toISOString(),
  approver: step.approver ? mapWorkflowUserBrief(step.approver) : undefined,
});

export const mapApprovalToResponse = (approval: {
  id: string;
  entity_type: string;
  entity_id: string;
  submitted_by_id: string;
  current_level: number;
  status: string;
  rejection_reason: string | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  submitted_by?: WorkflowUserLike;
  steps?: Array<Parameters<typeof mapApprovalStepToResponse>[0]>;
}): ApprovalResponseDto => ({
  id: approval.id,
  entityType: approval.entity_type,
  entityId: approval.entity_id,
  submittedById: approval.submitted_by_id,
  currentLevel: approval.current_level,
  status: approval.status,
  rejectionReason: approval.rejection_reason,
  completedAt: approval.completed_at?.toISOString() ?? null,
  createdAt: approval.created_at.toISOString(),
  updatedAt: approval.updated_at.toISOString(),
  submittedBy: approval.submitted_by ? mapWorkflowUserBrief(approval.submitted_by) : undefined,
  steps: approval.steps?.map(mapApprovalStepToResponse),
});
