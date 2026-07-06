import { z } from 'zod';
export declare const RunSamplingRequestSchema: z.ZodObject<{
    method: z.ZodEnum<["random", "interval", "high_value"]>;
    sampleSize: z.ZodNumber;
    seed: z.ZodOptional<z.ZodNumber>;
    valueColumn: z.ZodOptional<z.ZodString>;
    threshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    method: "random" | "interval" | "high_value";
    sampleSize: number;
    seed?: number | undefined;
    valueColumn?: string | undefined;
    threshold?: number | undefined;
}, {
    method: "random" | "interval" | "high_value";
    sampleSize: number;
    seed?: number | undefined;
    valueColumn?: string | undefined;
    threshold?: number | undefined;
}>;
export type RunSamplingRequestDto = z.infer<typeof RunSamplingRequestSchema>;
//# sourceMappingURL=sampling.request.dto.d.ts.map