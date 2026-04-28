export interface WorkflowActorContext {
  id: string;
  roles: string[];
  permissions: string[];
}

export interface WorkflowUserBrief {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
}

export interface WorkflowEscalationRunResult {
  checkedEngagements: number;
  checkedApprovals: number;
  escalationsFired: number;
  failures: number;
}
