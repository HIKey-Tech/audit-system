import { z } from 'zod';
import { AuditType, ChecklistResult } from '../../../domain/enum/audit.enum';
export declare const CreateChecklistItemRequestSchema: z.ZodObject<{
    auditType: z.ZodOptional<z.ZodEnum<[AuditType.It, AuditType.Systems, AuditType.Financial, AuditType.Compliance, AuditType.Operational, AuditType.Pension, AuditType.Procurement, AuditType.HrPayroll, AuditType.Project, AuditType.Special]>>;
    controlReference: z.ZodString;
    controlDescription: z.ZodString;
    testProcedure: z.ZodString;
}, "strip", z.ZodTypeAny, {
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
    auditType?: AuditType | undefined;
}, {
    controlReference: string;
    controlDescription: string;
    testProcedure: string;
    auditType?: AuditType | undefined;
}>;
export declare const UpdateChecklistItemRequestSchema: z.ZodObject<{
    result: z.ZodNativeEnum<typeof ChecklistResult>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    result: ChecklistResult;
    notes?: string | null | undefined;
}, {
    result: ChecklistResult;
    notes?: string | null | undefined;
}>;
export declare const UpdateChecklistTemplatesRequestSchema: z.ZodObject<{
    templates: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        controlReference: z.ZodString;
        controlDescription: z.ZodString;
        testProcedure: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    templates: Record<string, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }[]>;
}, {
    templates: Record<string, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }[]>;
}>;
export declare const ImportFrameworkChecklistsRequestSchema: z.ZodObject<{
    frameworkIds: z.ZodArray<z.ZodString, "many">;
    auditType: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    frameworkIds: string[];
    auditType?: string | undefined;
}, {
    frameworkIds: string[];
    auditType?: string | undefined;
}>;
export declare const BulkCreateChecklistItemsRequestSchema: z.ZodObject<{
    controls: z.ZodArray<z.ZodObject<{
        controlReference: z.ZodString;
        controlDescription: z.ZodString;
        testProcedure: z.ZodString;
        auditType: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
        auditType?: string | undefined;
    }, {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
        auditType?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    controls: {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
        auditType?: string | undefined;
    }[];
}, {
    controls: {
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
        auditType?: string | undefined;
    }[];
}>;
export interface ImportDocumentChecklistsDto {
    prefix?: string;
    saveToLibrary?: boolean;
    frameworkName?: string;
    frameworkCode?: string;
    category?: string;
    auditType?: string;
    controls?: Array<{
        controlReference: string;
        controlDescription: string;
        testProcedure: string;
    }>;
}
export type CreateChecklistItemRequestDto = z.infer<typeof CreateChecklistItemRequestSchema>;
export type UpdateChecklistItemRequestDto = z.infer<typeof UpdateChecklistItemRequestSchema>;
export type UpdateChecklistTemplatesRequestDto = z.infer<typeof UpdateChecklistTemplatesRequestSchema>;
export type ImportFrameworkChecklistsRequestDto = z.infer<typeof ImportFrameworkChecklistsRequestSchema>;
export type BulkCreateChecklistItemsRequestDto = z.infer<typeof BulkCreateChecklistItemsRequestSchema>;
//# sourceMappingURL=checklist.request.dto.d.ts.map