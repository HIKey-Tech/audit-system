import { Router } from 'express';
import { ApprovalController } from './approval/controller/approval.controller';
import { workflowApprovalService } from './approval/service/implementation/approval.service';
import { AssignmentController } from './assignment/controller/assignment.controller';
import { workflowAssignmentService } from './assignment/service/implementation/assignment.service';
import { EscalationController } from './escalation/controller/escalation.controller';
import { workflowEscalationService } from './escalation/service/implementation/escalation.service';

export const createWorkflowModule = (): Router => {
  const router = Router();

  const approvalController = new ApprovalController(workflowApprovalService);
  const assignmentController = new AssignmentController(workflowAssignmentService);
  const escalationController = new EscalationController(workflowEscalationService);

  router.use('/workflow/approvals', approvalController.router);
  router.use('/workflow/assignments', assignmentController.router);
  router.use('/workflow', escalationController.router);

  return router;
};

export { ApprovalService, workflowApprovalService } from './approval/service/implementation/approval.service';
export { AssignmentService, workflowAssignmentService } from './assignment/service/implementation/assignment.service';
export { EscalationService, workflowEscalationService } from './escalation/service/implementation/escalation.service';
export type { IApprovalService } from './approval/service/interface/approval.service.interface';
export type { IAssignmentService } from './assignment/service/interface/assignment.service.interface';
export type { IEscalationService } from './escalation/service/interface/escalation.service.interface';
