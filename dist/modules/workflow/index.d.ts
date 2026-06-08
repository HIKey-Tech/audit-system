import { Router } from 'express';
export declare const createWorkflowModule: () => Router;
export { ApprovalService, workflowApprovalService } from './approval/service/implementation/approval.service';
export { AssignmentService, workflowAssignmentService } from './assignment/service/implementation/assignment.service';
export { EscalationService, workflowEscalationService } from './escalation/service/implementation/escalation.service';
export { RequestService, workflowRequestService } from './request/service/implementation/request.service';
export type { IApprovalService } from './approval/service/interface/approval.service.interface';
export type { IAssignmentService } from './assignment/service/interface/assignment.service.interface';
export type { IEscalationService } from './escalation/service/interface/escalation.service.interface';
export type { IRequestService } from './request/service/interface/request.service.interface';
//# sourceMappingURL=index.d.ts.map