import { z } from 'zod';
import { WorkflowAssignmentRole } from '../../../domain/enum/workflow.enum';
export declare const AssignStaffRequestSchema: z.ZodObject<{
    engagementId: z.ZodString;
    userId: z.ZodString;
    role: z.ZodNativeEnum<typeof WorkflowAssignmentRole>;
}, "strip", z.ZodTypeAny, {
    role: WorkflowAssignmentRole;
    engagementId: string;
    userId: string;
}, {
    role: WorkflowAssignmentRole;
    engagementId: string;
    userId: string;
}>;
export declare const MyAssignmentsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: string | undefined;
}, {
    status?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type AssignStaffRequestDto = z.infer<typeof AssignStaffRequestSchema>;
export type MyAssignmentsQueryDto = z.infer<typeof MyAssignmentsQuerySchema>;
//# sourceMappingURL=assignment.request.dto.d.ts.map