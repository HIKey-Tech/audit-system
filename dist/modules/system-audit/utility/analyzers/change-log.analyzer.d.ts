import { z } from 'zod';
import { AnalyzerDefinition } from '../../domain/entity/system-audit.entity';
declare const ParametersSchema: z.ZodObject<{
    /** Emergency changes may be ratified after the fact, within this many days. */
    emergencyRatificationDays: z.ZodDefault<z.ZodNumber>;
    requireTestEvidence: z.ZodDefault<z.ZodBoolean>;
    requireRollbackPlan: z.ZodDefault<z.ZodBoolean>;
    /** Optional approved change window (24h clock). Null disables the check. */
    changeWindow: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        startHour: z.ZodNumber;
        endHour: z.ZodNumber;
        weekendsAllowed: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        startHour: number;
        endHour: number;
        weekendsAllowed: boolean;
    }, {
        startHour: number;
        endHour: number;
        weekendsAllowed?: boolean | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    emergencyRatificationDays: number;
    requireTestEvidence: boolean;
    requireRollbackPlan: boolean;
    changeWindow: {
        startHour: number;
        endHour: number;
        weekendsAllowed: boolean;
    } | null;
}, {
    emergencyRatificationDays?: number | undefined;
    requireTestEvidence?: boolean | undefined;
    requireRollbackPlan?: boolean | undefined;
    changeWindow?: {
        startHour: number;
        endHour: number;
        weekendsAllowed?: boolean | undefined;
    } | null | undefined;
}>;
export type ChangeLogParameters = z.infer<typeof ParametersSchema>;
export declare const changeLogAnalyzer: AnalyzerDefinition<ChangeLogParameters>;
export {};
//# sourceMappingURL=change-log.analyzer.d.ts.map