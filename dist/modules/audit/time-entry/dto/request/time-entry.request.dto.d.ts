import { z } from 'zod';
export declare const LogTimeEntrySchema: z.ZodObject<{
    entryDate: z.ZodDate;
    hours: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    hours: number;
    entryDate: Date;
    description?: string | undefined;
}, {
    hours: number;
    entryDate: Date;
    description?: string | undefined;
}>;
export type LogTimeEntryDto = z.infer<typeof LogTimeEntrySchema>;
//# sourceMappingURL=time-entry.request.dto.d.ts.map