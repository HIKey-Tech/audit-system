import { z } from 'zod';
export declare const CreateMappingSchema: z.ZodObject<{
    adGroupId: z.ZodString;
    adGroupName: z.ZodString;
    roleId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    roleId: string;
    adGroupId: string;
    adGroupName: string;
}, {
    roleId: string;
    adGroupId: string;
    adGroupName: string;
}>;
export type CreateMappingDto = z.infer<typeof CreateMappingSchema>;
export declare const UpdateMappingSchema: z.ZodObject<{
    adGroupName: z.ZodOptional<z.ZodString>;
    roleId: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
    roleId?: string | undefined;
    adGroupName?: string | undefined;
}, {
    isActive?: boolean | undefined;
    roleId?: string | undefined;
    adGroupName?: string | undefined;
}>;
export type UpdateMappingDto = z.infer<typeof UpdateMappingSchema>;
//# sourceMappingURL=directory.request.dto.d.ts.map