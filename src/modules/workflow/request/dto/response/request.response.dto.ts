import { WorkflowUserBrief } from '../../../domain/entity/workflow.entity';
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

export interface RequestStepResponseDto {
  id: string;
  requestId: string;
  level: number;
  recipientId: string;
  status: string;
  actedAt: string | null;
  createdAt: string;
  recipient?: WorkflowUserBrief;
}

export interface RequestActionResponseDto {
  id: string;
  requestId: string;
  stepId: string | null;
  actorId: string;
  actionType: string;
  comment: string | null;
  signatureHash: string | null;
  createdAt: string;
  actor?: WorkflowUserBrief;
}

export interface RequestAttachmentDto {
  documentId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
}

export interface RequestResponseDto {
  id: string;
  referenceNumber: string;
  title: string;
  description: string | null;
  initiatorId: string;
  currentLevel: number;
  status: string;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  initiator?: WorkflowUserBrief;
  steps?: RequestStepResponseDto[];
  actions?: RequestActionResponseDto[];
  attachments?: RequestAttachmentDto[];
}

export interface SignatureVerificationDto {
  actionId: string;
  signerId: string;
  signedAt: string;
  valid: boolean;
  storedHash: string;
  recomputedHash: string;
}

export const mapRequestStepToResponse = (step: {
  id: string;
  request_id: string;
  level: number;
  recipient_id: string;
  status: string;
  acted_at: Date | null;
  created_at: Date;
  recipient?: WorkflowUserLike;
}): RequestStepResponseDto => ({
  id: step.id,
  requestId: step.request_id,
  level: step.level,
  recipientId: step.recipient_id,
  status: step.status,
  actedAt: step.acted_at?.toISOString() ?? null,
  createdAt: step.created_at.toISOString(),
  recipient: step.recipient ? mapWorkflowUserBrief(step.recipient) : undefined,
});

export const mapRequestActionToResponse = (action: {
  id: string;
  request_id: string;
  step_id: string | null;
  actor_id: string;
  action_type: string;
  comment: string | null;
  signature_hash: string | null;
  created_at: Date;
  actor?: WorkflowUserLike;
}): RequestActionResponseDto => ({
  id: action.id,
  requestId: action.request_id,
  stepId: action.step_id,
  actorId: action.actor_id,
  actionType: action.action_type,
  comment: action.comment,
  signatureHash: action.signature_hash,
  createdAt: action.created_at.toISOString(),
  actor: action.actor ? mapWorkflowUserBrief(action.actor) : undefined,
});

export const mapRequestToResponse = (request: {
  id: string;
  reference_number: string;
  title: string;
  description: string | null;
  initiator_id: string;
  current_level: number;
  status: string;
  locked_at: Date | null;
  created_at: Date;
  updated_at: Date;
  initiator?: WorkflowUserLike;
  steps?: Array<Parameters<typeof mapRequestStepToResponse>[0]>;
  actions?: Array<Parameters<typeof mapRequestActionToResponse>[0]>;
}, attachments?: RequestAttachmentDto[]): RequestResponseDto => ({
  id: request.id,
  referenceNumber: request.reference_number,
  title: request.title,
  description: request.description,
  initiatorId: request.initiator_id,
  currentLevel: request.current_level,
  status: request.status,
  lockedAt: request.locked_at?.toISOString() ?? null,
  createdAt: request.created_at.toISOString(),
  updatedAt: request.updated_at.toISOString(),
  initiator: request.initiator ? mapWorkflowUserBrief(request.initiator) : undefined,
  steps: request.steps?.map(mapRequestStepToResponse),
  actions: request.actions?.map(mapRequestActionToResponse),
  attachments,
});
