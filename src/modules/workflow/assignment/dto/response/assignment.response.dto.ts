import { EngagementResponseDto, mapEngagementToResponse } from '../../../../audit/engagement/dto/response/engagement.response.dto';
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

export interface AssignmentResponseDto {
  id: string;
  engagementId: string;
  userId: string;
  role: string;
  assignedById: string;
  assignedAt: string;
  createdAt: string;
  user?: WorkflowUserBrief;
  assignedBy?: WorkflowUserBrief;
  engagement?: EngagementResponseDto;
}

export interface WorkloadResponseDto {
  userId: string;
  totalActive: number;
  byStatus: Array<{ status: string; count: number }>;
}

export interface AssignmentCandidateDto {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  skills: string[];
  activeEngagementCount: number;
  /** Skills matching the engagement's audit type (highlighted in the UI). */
  matchedSkills: string[];
  /** Backend recommendation score; candidates are returned sorted by this desc. */
  recommendationScore: number;
  /** Skill-fit candidate with spare capacity — surface as "Recommended". */
  recommended: boolean;
  /** At or above the concurrency cap — assignment will be blocked. */
  overCapacity: boolean;
}

export const mapAssignmentToResponse = (assignment: {
  id: string;
  engagement_id: string;
  user_id: string;
  role: string;
  assigned_by_id: string;
  assigned_at: Date;
  created_at: Date;
  user?: WorkflowUserLike;
  assigned_by?: WorkflowUserLike;
  engagement?: Parameters<typeof mapEngagementToResponse>[0];
}): AssignmentResponseDto => ({
  id: assignment.id,
  engagementId: assignment.engagement_id,
  userId: assignment.user_id,
  role: assignment.role,
  assignedById: assignment.assigned_by_id,
  assignedAt: assignment.assigned_at.toISOString(),
  createdAt: assignment.created_at.toISOString(),
  user: assignment.user ? mapWorkflowUserBrief(assignment.user) : undefined,
  assignedBy: assignment.assigned_by ? mapWorkflowUserBrief(assignment.assigned_by) : undefined,
  engagement: assignment.engagement ? mapEngagementToResponse(assignment.engagement) : undefined,
});
