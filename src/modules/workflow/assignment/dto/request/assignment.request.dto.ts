import { z } from 'zod';
import { WorkflowAssignmentRole } from '../../../domain/enum/workflow.enum';

export const AssignStaffRequestSchema = z.object({
  engagementId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.nativeEnum(WorkflowAssignmentRole),
});

export const SubstituteStaffRequestSchema = z.object({
  engagementId: z.string().uuid(),
  role: z.enum(['supporting_auditor', 'lead_auditor', 'audit_manager']),
  outgoingUserId: z.string().uuid().optional(),
  incomingUserId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
});

export const MyAssignmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
});

export type AssignStaffRequestDto = z.infer<typeof AssignStaffRequestSchema>;
export type SubstituteStaffRequestDto = z.infer<typeof SubstituteStaffRequestSchema>;
export type MyAssignmentsQueryDto = z.infer<typeof MyAssignmentsQuerySchema>;
