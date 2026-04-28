import { z } from 'zod';
import {
  EscalationPolicyAuditType,
  WorkflowEscalationEntityType,
} from '../../../domain/enum/workflow.enum';

export const EscalationEntityParamsSchema = z.object({
  type: z.nativeEnum(WorkflowEscalationEntityType),
  id: z.string().uuid(),
});

export const EscalationPolicyQuerySchema = z.object({
  auditType: z.nativeEnum(EscalationPolicyAuditType).default(EscalationPolicyAuditType.All),
});

export const UpsertEscalationPolicyRequestSchema = z.object({
  auditType: z.nativeEnum(EscalationPolicyAuditType),
  level1Hours: z.coerce.number().int().positive().default(24),
  level2Hours: z.coerce.number().int().positive().default(72),
  level3Hours: z.coerce.number().int().positive().default(120),
  level4Hours: z.coerce.number().int().positive().default(168),
  isActive: z.boolean().default(true),
});

export type EscalationPolicyQueryDto = z.infer<typeof EscalationPolicyQuerySchema>;
export type UpsertEscalationPolicyRequestDto = z.infer<typeof UpsertEscalationPolicyRequestSchema>;
