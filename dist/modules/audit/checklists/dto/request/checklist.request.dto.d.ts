import { z } from 'zod';
import { ChecklistResult } from '../../../domain/enum/audit.enum';
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
export type UpdateChecklistItemRequestDto = z.infer<typeof UpdateChecklistItemRequestSchema>;
//# sourceMappingURL=checklist.request.dto.d.ts.map