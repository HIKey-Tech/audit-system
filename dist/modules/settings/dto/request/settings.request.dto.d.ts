import { z } from 'zod';
export declare const CreateWorkingPaperTemplateRequestSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    auditType: z.ZodEnum<["it", "financial", "compliance", "systems", "all"]>;
    sections: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        placeholder: z.ZodString;
        required: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description: string;
        required: boolean;
        placeholder: string;
    }, {
        title: string;
        description: string;
        required: boolean;
        placeholder: string;
    }>, "many">;
    isActive: z.ZodOptional<z.ZodBoolean>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sections: {
        title: string;
        description: string;
        required: boolean;
        placeholder: string;
    }[];
    auditType: "it" | "financial" | "compliance" | "systems" | "all";
    description?: string | undefined;
    isActive?: boolean | undefined;
    isDefault?: boolean | undefined;
}, {
    name: string;
    sections: {
        title: string;
        description: string;
        required: boolean;
        placeholder: string;
    }[];
    auditType: "it" | "financial" | "compliance" | "systems" | "all";
    description?: string | undefined;
    isActive?: boolean | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const UpdateWorkingPaperTemplateRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    auditType: z.ZodOptional<z.ZodEnum<["it", "financial", "compliance", "systems", "all"]>>;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        placeholder: z.ZodString;
        required: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description: string;
        required: boolean;
        placeholder: string;
    }, {
        title: string;
        description: string;
        required: boolean;
        placeholder: string;
    }>, "many">>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    sections?: {
        title: string;
        description: string;
        required: boolean;
        placeholder: string;
    }[] | undefined;
    isActive?: boolean | undefined;
    auditType?: "it" | "financial" | "compliance" | "systems" | "all" | undefined;
    isDefault?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    sections?: {
        title: string;
        description: string;
        required: boolean;
        placeholder: string;
    }[] | undefined;
    isActive?: boolean | undefined;
    auditType?: "it" | "financial" | "compliance" | "systems" | "all" | undefined;
    isDefault?: boolean | undefined;
}>;
export declare const WorkingPaperTemplateQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    auditType: z.ZodOptional<z.ZodEnum<["it", "financial", "compliance", "systems", "all"]>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["name", "audit_type", "created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "name" | "created_at" | "updated_at" | "audit_type";
    sortOrder: "asc" | "desc";
    isActive?: boolean | undefined;
    auditType?: "it" | "financial" | "compliance" | "systems" | "all" | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "name" | "created_at" | "updated_at" | "audit_type" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    isActive?: boolean | undefined;
    auditType?: "it" | "financial" | "compliance" | "systems" | "all" | undefined;
}>;
export declare const CreateReportTemplateRequestSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    sections: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        includeFindings: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description: string;
        key: string;
        includeFindings: boolean;
    }, {
        title: string;
        description: string;
        key: string;
        includeFindings: boolean;
    }>, "many">;
    headerConfig: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    footerConfig: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    signatureConfig: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    availableVariables: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        description: z.ZodString;
        example: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        description: string;
        key: string;
        example: string;
    }, {
        description: string;
        key: string;
        example: string;
    }>, "many">;
    isActive: z.ZodOptional<z.ZodBoolean>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sections: {
        title: string;
        description: string;
        key: string;
        includeFindings: boolean;
    }[];
    availableVariables: {
        description: string;
        key: string;
        example: string;
    }[];
    description?: string | undefined;
    isActive?: boolean | undefined;
    isDefault?: boolean | undefined;
    headerConfig?: Record<string, unknown> | null | undefined;
    footerConfig?: Record<string, unknown> | null | undefined;
    signatureConfig?: Record<string, unknown> | null | undefined;
}, {
    name: string;
    sections: {
        title: string;
        description: string;
        key: string;
        includeFindings: boolean;
    }[];
    availableVariables: {
        description: string;
        key: string;
        example: string;
    }[];
    description?: string | undefined;
    isActive?: boolean | undefined;
    isDefault?: boolean | undefined;
    headerConfig?: Record<string, unknown> | null | undefined;
    footerConfig?: Record<string, unknown> | null | undefined;
    signatureConfig?: Record<string, unknown> | null | undefined;
}>;
export declare const UpdateReportTemplateRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    sections: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        includeFindings: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description: string;
        key: string;
        includeFindings: boolean;
    }, {
        title: string;
        description: string;
        key: string;
        includeFindings: boolean;
    }>, "many">>;
    headerConfig: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    footerConfig: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    signatureConfig: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    availableVariables: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        description: z.ZodString;
        example: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        description: string;
        key: string;
        example: string;
    }, {
        description: string;
        key: string;
        example: string;
    }>, "many">>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    sections?: {
        title: string;
        description: string;
        key: string;
        includeFindings: boolean;
    }[] | undefined;
    isActive?: boolean | undefined;
    isDefault?: boolean | undefined;
    headerConfig?: Record<string, unknown> | null | undefined;
    footerConfig?: Record<string, unknown> | null | undefined;
    signatureConfig?: Record<string, unknown> | null | undefined;
    availableVariables?: {
        description: string;
        key: string;
        example: string;
    }[] | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    sections?: {
        title: string;
        description: string;
        key: string;
        includeFindings: boolean;
    }[] | undefined;
    isActive?: boolean | undefined;
    isDefault?: boolean | undefined;
    headerConfig?: Record<string, unknown> | null | undefined;
    footerConfig?: Record<string, unknown> | null | undefined;
    signatureConfig?: Record<string, unknown> | null | undefined;
    availableVariables?: {
        description: string;
        key: string;
        example: string;
    }[] | undefined;
}>;
export declare const ReportTemplateQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["name", "created_at", "updated_at"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    sortBy: "name" | "created_at" | "updated_at";
    sortOrder: "asc" | "desc";
    isActive?: boolean | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    sortBy?: "name" | "created_at" | "updated_at" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    isActive?: boolean | undefined;
}>;
export declare const UpdateSystemConfigRequestSchema: z.ZodObject<{
    value: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value: string | null;
}, {
    value: string | null;
}>;
export declare const BulkUpdateSystemConfigRequestSchema: z.ZodObject<{
    configs: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        value: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        key: string;
        value: string | null;
    }, {
        key: string;
        value: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    configs: {
        key: string;
        value: string | null;
    }[];
}, {
    configs: {
        key: string;
        value: string | null;
    }[];
}>;
export type CreateWorkingPaperTemplateRequestDto = z.infer<typeof CreateWorkingPaperTemplateRequestSchema>;
export type UpdateWorkingPaperTemplateRequestDto = z.infer<typeof UpdateWorkingPaperTemplateRequestSchema>;
export type WorkingPaperTemplateQueryDto = z.infer<typeof WorkingPaperTemplateQuerySchema>;
export type CreateReportTemplateRequestDto = z.infer<typeof CreateReportTemplateRequestSchema>;
export type UpdateReportTemplateRequestDto = z.infer<typeof UpdateReportTemplateRequestSchema>;
export type ReportTemplateQueryDto = z.infer<typeof ReportTemplateQuerySchema>;
export type UpdateSystemConfigRequestDto = z.infer<typeof UpdateSystemConfigRequestSchema>;
export type BulkUpdateSystemConfigRequestDto = z.infer<typeof BulkUpdateSystemConfigRequestSchema>;
//# sourceMappingURL=settings.request.dto.d.ts.map