import { z } from 'zod';
import { ExceptionSeverity } from '../../domain/enum/system-audit.enum';
import { AnalyzerDefinition } from '../../domain/entity/system-audit.entity';
declare const SodRuleSchema: z.ZodObject<{
    name: z.ZodString;
    sideA: z.ZodArray<z.ZodString, "many">;
    sideB: z.ZodArray<z.ZodString, "many">;
    severity: z.ZodDefault<z.ZodNativeEnum<typeof ExceptionSeverity>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    severity: ExceptionSeverity;
    sideA: string[];
    sideB: string[];
}, {
    name: string;
    sideA: string[];
    sideB: string[];
    severity?: ExceptionSeverity | undefined;
}>;
export type SodRule = z.infer<typeof SodRuleSchema>;
/** Generic duty conflicts that apply to most business systems; GBB tailors per system. */
export declare const DEFAULT_SOD_RULES: SodRule[];
/** Permission-level conflicts inside IAMS itself (used by the IAMS access-review source). */
export declare const IAMS_SOD_RULES: SodRule[];
declare const ParametersSchema: z.ZodObject<{
    dormantDays: z.ZodDefault<z.ZodNumber>;
    sodRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        sideA: z.ZodArray<z.ZodString, "many">;
        sideB: z.ZodArray<z.ZodString, "many">;
        severity: z.ZodDefault<z.ZodNativeEnum<typeof ExceptionSeverity>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        severity: ExceptionSeverity;
        sideA: string[];
        sideB: string[];
    }, {
        name: string;
        sideA: string[];
        sideB: string[];
        severity?: ExceptionSeverity | undefined;
    }>, "many">>;
    privilegedPatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    genericAccountPatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Cross-check accounts against the IAMS staff directory to find leavers and orphans. */
    checkDirectory: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    dormantDays: number;
    sodRules: {
        name: string;
        severity: ExceptionSeverity;
        sideA: string[];
        sideB: string[];
    }[];
    privilegedPatterns: string[];
    genericAccountPatterns: string[];
    checkDirectory: boolean;
}, {
    dormantDays?: number | undefined;
    sodRules?: {
        name: string;
        sideA: string[];
        sideB: string[];
        severity?: ExceptionSeverity | undefined;
    }[] | undefined;
    privilegedPatterns?: string[] | undefined;
    genericAccountPatterns?: string[] | undefined;
    checkDirectory?: boolean | undefined;
}>;
export type AccessListingParameters = z.infer<typeof ParametersSchema>;
export declare const accessListingAnalyzer: AnalyzerDefinition<AccessListingParameters>;
export {};
//# sourceMappingURL=access-listing.analyzer.d.ts.map