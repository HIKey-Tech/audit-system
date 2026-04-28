import { z } from 'zod';
import { WorkflowAssignmentRole } from '../../../domain/enum/workflow.enum';

export const AssignStaffRequestSchema = z.object({
  engagementId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.nativeEnum(WorkflowAssignmentRole),
});

export const MyAssignmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
});

export type AssignStaffRequestDto = z.infer<typeof AssignStaffRequestSchema>;
export type MyAssignmentsQueryDto = z.infer<typeof MyAssignmentsQuerySchema>;
