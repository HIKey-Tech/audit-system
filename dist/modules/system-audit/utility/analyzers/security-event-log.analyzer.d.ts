import { z } from 'zod';
import { AnalyzerDefinition } from '../../domain/entity/system-audit.entity';
declare const ParametersSchema: z.ZodObject<{
    bruteForceThreshold: z.ZodDefault<z.ZodNumber>;
    bruteForceWindowMinutes: z.ZodDefault<z.ZodNumber>;
    /** One source address failing against this many different accounts = password spraying. */
    sprayDistinctAccounts: z.ZodDefault<z.ZodNumber>;
    businessHours: z.ZodDefault<z.ZodObject<{
        startHour: z.ZodDefault<z.ZodNumber>;
        endHour: z.ZodDefault<z.ZodNumber>;
        weekdaysOnly: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        startHour: number;
        endHour: number;
        weekdaysOnly: boolean;
    }, {
        startHour?: number | undefined;
        endHour?: number | undefined;
        weekdaysOnly?: boolean | undefined;
    }>>;
    privilegedEventPatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    logClearedPatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    bruteForceThreshold: number;
    bruteForceWindowMinutes: number;
    sprayDistinctAccounts: number;
    businessHours: {
        startHour: number;
        endHour: number;
        weekdaysOnly: boolean;
    };
    privilegedEventPatterns: string[];
    logClearedPatterns: string[];
}, {
    bruteForceThreshold?: number | undefined;
    bruteForceWindowMinutes?: number | undefined;
    sprayDistinctAccounts?: number | undefined;
    businessHours?: {
        startHour?: number | undefined;
        endHour?: number | undefined;
        weekdaysOnly?: boolean | undefined;
    } | undefined;
    privilegedEventPatterns?: string[] | undefined;
    logClearedPatterns?: string[] | undefined;
}>;
export type SecurityEventLogParameters = z.infer<typeof ParametersSchema>;
export declare const securityEventLogAnalyzer: AnalyzerDefinition<SecurityEventLogParameters>;
export {};
//# sourceMappingURL=security-event-log.analyzer.d.ts.map