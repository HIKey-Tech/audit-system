import { WorkflowUserBrief } from '../../../domain/entity/workflow.entity';

export interface ResolvedApprovalLevelDto {
  level: number;
  kind: 'person' | 'permission';
  status: 'pending' | 'approved' | 'rejected' | 'upcoming';
  requiredPermission: string | null;
  resolvedApprover: WorkflowUserBrief | null;
  candidates: WorkflowUserBrief[];
}

export interface ResolvedApprovalChainDto {
  entityType: string;
  entityId: string;
  exists: boolean;
  status: string | null;
  currentLevel: number | null;
  levels: ResolvedApprovalLevelDto[];
}
