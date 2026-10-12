import { z } from 'zod';
export declare const InsightFeedbackSchema: z.ZodObject<{
    feedback: z.ZodEnum<["useful", "not_useful", "dismissed"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    feedback: "dismissed" | "useful" | "not_useful";
    comment?: string | undefined;
}, {
    feedback: "dismissed" | "useful" | "not_useful";
    comment?: string | undefined;
}>;
export type InsightFeedbackDto = z.infer<typeof InsightFeedbackSchema>;
//# sourceMappingURL=predictive.request.dto.d.ts.map