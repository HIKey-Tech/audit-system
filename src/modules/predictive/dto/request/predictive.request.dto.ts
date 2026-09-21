import { z } from 'zod';

export const InsightFeedbackSchema = z.object({
  feedback: z.enum(['useful', 'not_useful', 'dismissed']),
  comment: z.string().trim().max(500).optional(),
});

export type InsightFeedbackDto = z.infer<typeof InsightFeedbackSchema>;
