import { z } from 'zod';
import { WorkflowAssignmentRole } from '../../../domain/enum/workflow.enum';
export declare const AssignStaffRequestSchema: z.ZodObject<{
    engagementId: z.ZodString;
    userId: z.ZodString;
    role: z.ZodNativeEnum<typeof WorkflowAssignmentRole>;
}, "strip", z.ZodTypeAny, {
    role: WorkflowAssignmentRole;
    userId: string;
    engagementId: string;
}, {
    role: WorkflowAssignmentRole;
    userId: string;
    engagementId: string;
}>;
export declare const SubstituteStaffRequestSchema: z.ZodObject<{
    engagementId: z.ZodString;
    role: z.ZodEnum<["supporting_auditor", "lead_auditor", "audit_manager"]>;
    outgoingUserId: z.ZodOptional<z.ZodString>;
    incomingUserId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    role: "lead_auditor" | "audit_manager" | "supporting_auditor";
    reason: string;
    engagementId: string;
    incomingUserId: string;
    outgoingUserId?: string | undefined;
}, {
    role: "lead_auditor" | "audit_manager" | "supporting_auditor";
    reason: string;
    engagementId: string;
    incomingUserId: string;
    outgoingUserId?: string | undefined;
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
export type SubstituteStaffRequestDto = z.infer<typeof SubstituteStaffRequestSchema>;
export type MyAssignmentsQueryDto = z.infer<typeof MyAssignmentsQuerySchema>;
//# sourceMappingURL=assignment.request.dto.d.ts.map