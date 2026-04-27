import { z } from 'zod';
import { FindingCategory, FindingSeverity, FindingStatus } from '../../../domain/enum/audit.enum';

export const CreateFindingRequestSchema = z.object({
  workingPaperId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.nativeEnum(FindingCategory),
  severity: z.nativeEnum(FindingSeverity),
  rootCause: z.string().min(1),
  riskImplication: z.string().min(1),
  recommendation: z.string().min(1),
  auditeeId: z.string().uuid(),
  dueDate: z.string().datetime(),
});

export const UpdateFindingRequestSchema = z.object({
  workingPaperId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  category: z.nativeEnum(FindingCategory).optional(),
  severity: z.nativeEnum(FindingSeverity).optional(),
  rootCause: z.string().min(1).optional(),
  riskImplication: z.string().min(1).optional(),
  recommendation: z.string().min(1).optional(),
  auditeeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const UpdateFindingStatusRequestSchema = z.object({
  status: z.nativeEnum(FindingStatus),
});

export const FindingQuerySchema = z.object({
  severity: z.nativeEnum(FindingSeverity).optional(),
  status: z.nativeEnum(FindingStatus).optional(),
  category: z.nativeEnum(FindingCategory).optional(),
  auditeeId: z.string().uuid().optional(),
});

export type CreateFindingRequestDto = z.infer<typeof CreateFindingRequestSchema>;
export type UpdateFindingRequestDto = z.infer<typeof UpdateFindingRequestSchema>;
export type UpdateFindingStatusRequestDto = z.infer<typeof UpdateFindingStatusRequestSchema>;
export type FindingQueryDto = z.infer<typeof FindingQuerySchema>;
