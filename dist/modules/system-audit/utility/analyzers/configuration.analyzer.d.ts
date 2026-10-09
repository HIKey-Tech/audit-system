import { z } from 'zod';
import { AnalyzerDefinition } from '../../domain/entity/system-audit.entity';
declare const ParametersSchema: z.ZodObject<{
    /** Settings whose drift is security-relevant (raised as high). */
    securitySensitivePatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    insecureValuePatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Volatile settings that change on their own and would only add noise. */
    ignoreSettings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    securitySensitivePatterns: string[];
    insecureValuePatterns: string[];
    ignoreSettings: string[];
}, {
    securitySensitivePatterns?: string[] | undefined;
    insecureValuePatterns?: string[] | undefined;
    ignoreSettings?: string[] | undefined;
}>;
export type ConfigurationParameters = z.infer<typeof ParametersSchema>;
export declare const configurationAnalyzer: AnalyzerDefinition<ConfigurationParameters>;
export {};
//# sourceMappingURL=configuration.analyzer.d.ts.map