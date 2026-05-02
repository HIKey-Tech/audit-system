import { z } from 'zod';

export const ActivityQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type ActivityQueryDto = z.infer<typeof ActivityQuerySchema>;
