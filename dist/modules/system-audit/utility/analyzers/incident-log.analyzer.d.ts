import { z } from 'zod';
import { AnalyzerDefinition } from '../../domain/entity/system-audit.entity';
type Priority = 'critical' | 'high' | 'medium' | 'low';
declare const ParametersSchema: z.ZodObject<{
    sla: z.ZodDefault<z.ZodObject<{
        critical: z.ZodObject<{
            responseMinutes: z.ZodNumber;
            resolutionHours: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            responseMinutes: number;
            resolutionHours: number;
        }, {
            responseMinutes: number;
            resolutionHours: number;
        }>;
        high: z.ZodObject<{
            responseMinutes: z.ZodNumber;
            resolutionHours: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            responseMinutes: number;
            resolutionHours: number;
        }, {
            responseMinutes: number;
            resolutionHours: number;
        }>;
        medium: z.ZodObject<{
            responseMinutes: z.ZodNumber;
            resolutionHours: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            responseMinutes: number;
            resolutionHours: number;
        }, {
            responseMinutes: number;
            resolutionHours: number;
        }>;
        low: z.ZodObject<{
            responseMinutes: z.ZodNumber;
            resolutionHours: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            responseMinutes: number;
            resolutionHours: number;
        }, {
            responseMinutes: number;
            resolutionHours: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        low: {
            responseMinutes: number;
            resolutionHours: number;
        };
        medium: {
            responseMinutes: number;
            resolutionHours: number;
        };
        high: {
            responseMinutes: number;
            resolutionHours: number;
        };
        critical: {
            responseMinutes: number;
            resolutionHours: number;
        };
    }, {
        low: {
            responseMinutes: number;
            resolutionHours: number;
        };
        medium: {
            responseMinutes: number;
            resolutionHours: number;
        };
        high: {
            responseMinutes: number;
            resolutionHours: number;
        };
        critical: {
            responseMinutes: number;
            resolutionHours: number;
        };
    }>>;
    /** Open incidents older than this are escalated as aged. */
    openAgeDays: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sla: {
        low: {
            responseMinutes: number;
            resolutionHours: number;
        };
        medium: {
            responseMinutes: number;
            resolutionHours: number;
        };
        high: {
            responseMinutes: number;
            resolutionHours: number;
        };
        critical: {
            responseMinutes: number;
            resolutionHours: number;
        };
    };
    openAgeDays: number;
}, {
    sla?: {
        low: {
            responseMinutes: number;
            resolutionHours: number;
        };
        medium: {
            responseMinutes: number;
            resolutionHours: number;
        };
        high: {
            responseMinutes: number;
            resolutionHours: number;
        };
        critical: {
            responseMinutes: number;
            resolutionHours: number;
        };
    } | undefined;
    openAgeDays?: number | undefined;
}>;
export type IncidentLogParameters = z.infer<typeof ParametersSchema>;
export declare const normalisePriority: (raw: string | null) => Priority;
export declare const incidentLogAnalyzer: AnalyzerDefinition<IncidentLogParameters>;
export {};
//# sourceMappingURL=incident-log.analyzer.d.ts.map