// Ad-hoc workflow request enums. SQL Server has no native enums, so these
// mirror the String columns on workflow_requests / steps / actions.

export enum RequestStatus {
  Pending = 'pending',
  Completed = 'completed',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum RequestStepStatus {
  Pending = 'pending',
  Approved = 'approved',
  Signed = 'signed',
  Rejected = 'rejected',
}

export enum RequestActionType {
  Approve = 'approve',
  Reject = 'reject',
  Sign = 'sign',
  Comment = 'comment',
}
