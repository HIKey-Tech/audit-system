import { Router } from 'express';
import { ApprovalController } from './approval/controller/approval.controller';
import { workflowApprovalService } from './approval/service/implementation/approval.service';
import { AssignmentController } from './assignment/controller/assignment.controller';
import { workflowAssignmentService } from './assignment/service/implementation/assignment.service';
import { EscalationController } from './escalation/controller/escalation.controller';
import { workflowEscalationService } from './escalation/service/implementation/escalation.service';
import { RequestController } from './request/controller/request.controller';
import { workflowRequestService } from './request/service/implementation/request.service';

export const createWorkflowModule = (): Router => {
  const router = Router();

  const approvalController = new ApprovalController(workflowApprovalService);
  const assignmentController = new AssignmentController(workflowAssignmentService);
  const escalationController = new EscalationController(workflowEscalationService);
  const requestController = new RequestController(workflowRequestService);

  router.use('/workflow/approvals', approvalController.router);
  router.use('/workflow/assignments', assignmentController.router);
  router.use('/workflow/requests', requestController.router);
  router.use('/workflow', escalationController.router);

  return router;
};

export { ApprovalService, workflowApprovalService } from './approval/service/implementation/approval.service';
export { AssignmentService, workflowAssignmentService } from './assignment/service/implementation/assignment.service';
export { EscalationService, workflowEscalationService } from './escalation/service/implementation/escalation.service';
export { RequestService, workflowRequestService } from './request/service/implementation/request.service';
export type { IApprovalService } from './approval/service/interface/approval.service.interface';
export type { IAssignmentService } from './assignment/service/interface/assignment.service.interface';
export type { IEscalationService } from './escalation/service/interface/escalation.service.interface';
export type { IRequestService } from './request/service/interface/request.service.interface';
