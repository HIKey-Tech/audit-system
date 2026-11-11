import { z } from 'zod';
import { AuditFrequency, UniverseCategory, UniverseStatus } from '../../../domain/enum/audit.enum';

export const CreateUniverseRequestSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    category: z.nativeEnum(UniverseCategory),
    ownerId: z.string().uuid().optional(),
    additionalOwnerIds: z.array(z.string().uuid()).max(25).optional(),
    ownerIds: z.array(z.string().uuid()).min(1).max(25).optional(),
    riskScore: z.coerce.number().min(0).max(999.99).optional(),
    lastAuditedAt: z.string().datetime().optional(),
    auditFrequency: z.nativeEnum(AuditFrequency),
  })
  .refine((data) => Boolean(data.ownerId || (data.ownerIds && data.ownerIds.length > 0)), {
    message: 'At least one owner is required',
    path: ['ownerIds'],
  });

export const UpdateUniverseRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  category: z.nativeEnum(UniverseCategory).optional(),
  ownerId: z.string().uuid().optional(),
  additionalOwnerIds: z.array(z.string().uuid()).max(25).optional(),
  ownerIds: z.array(z.string().uuid()).min(1).max(25).optional(),
  riskScore: z.coerce.number().min(0).max(999.99).nullable().optional(),
  lastAuditedAt: z.string().datetime().nullable().optional(),
  auditFrequency: z.nativeEnum(AuditFrequency).optional(),
  status: z.nativeEnum(UniverseStatus).optional(),
});

export const UniverseQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  category: z.nativeEnum(UniverseCategory).optional(),
  auditFrequency: z.nativeEnum(AuditFrequency).optional(),
  status: z.nativeEnum(UniverseStatus).optional(),
  sortBy: z.enum(['risk_score', 'name', 'created_at', 'updated_at']).default('risk_score'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateUniverseRequestDto = z.infer<typeof CreateUniverseRequestSchema>;
export type UpdateUniverseRequestDto = z.infer<typeof UpdateUniverseRequestSchema>;
export type UniverseQueryDto = z.infer<typeof UniverseQuerySchema>;
