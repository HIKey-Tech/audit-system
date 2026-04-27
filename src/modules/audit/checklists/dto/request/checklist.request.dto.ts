import { z } from 'zod';
import { ChecklistResult } from '../../../domain/enum/audit.enum';

export const UpdateChecklistItemRequestSchema = z.object({
  result: z.nativeEnum(ChecklistResult),
  notes: z.string().max(5000).nullable().optional(),
});

export type UpdateChecklistItemRequestDto = z.infer<typeof UpdateChecklistItemRequestSchema>;
