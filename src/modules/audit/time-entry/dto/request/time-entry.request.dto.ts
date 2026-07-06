import { z } from 'zod';

export const LogTimeEntrySchema = z.object({
  entryDate: z.coerce.date(),
  hours: z.number().positive().max(24),
  description: z.string().max(500).optional(),
});

export type LogTimeEntryDto = z.infer<typeof LogTimeEntrySchema>;
