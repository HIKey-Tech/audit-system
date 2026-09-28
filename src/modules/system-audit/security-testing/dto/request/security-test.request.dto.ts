import { z } from 'zod';
import { SecurityTestProviderType, SecurityTestStatus, SecurityTestType } from '../../../domain/enum/system-audit.enum';

const BaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  testType: z.nativeEnum(SecurityTestType),
  engagementId: z.string().uuid().nullable().optional(),
  provider: z.string().trim().min(1).max(200),
  providerType: z.nativeEnum(SecurityTestProviderType).default(SecurityTestProviderType.Internal),
  scope: z.string().trim().min(1).max(10_000),
  rulesOfEngagement: z.string().trim().max(20_000).nullable().optional(),
  plannedStart: z.string().datetime(),
  plannedEnd: z.string().datetime(),
  /** Defaults to the creator. */
  coordinatorId: z.string().uuid().optional(),
  notes: z.string().trim().max(10_000).nullable().optional(),
});

const endAfterStart = (d: { plannedStart?: string; plannedEnd?: string }): boolean =>
  !d.plannedStart || !d.plannedEnd || new Date(d.plannedEnd) >= new Date(d.plannedStart);

export const CreateSecurityTestSchema = BaseSchema.extend({
  assetIds: z.array(z.string().uuid()).max(50).optional(),
}).refine(endAfterStart, { message: 'The planned end must be on or after the planned start', path: ['plannedEnd'] });

export const UpdateSecurityTestSchema = BaseSchema.partial()
  .omit({ providerType: true })
  .extend({ providerType: z.nativeEnum(SecurityTestProviderType).optional() })
  .refine(endAfterStart, { message: 'The planned end must be on or after the planned start', path: ['plannedEnd'] });

export const ChangeSecurityTestStatusSchema = z.object({
  status: z.enum([
    SecurityTestStatus.InProgress,
    SecurityTestStatus.Reporting,
    SecurityTestStatus.Remediation,
    SecurityTestStatus.Closed,
    SecurityTestStatus.Cancelled,
  ]),
  note: z.string().trim().max(4000).optional(),
});

export const AuthoriseSecurityTestSchema = z.object({
  note: z.string().trim().max(4000).optional(),
});

export const SecurityTestAssetsSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(50),
});

export const SecurityTestListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(SecurityTestStatus).optional(),
  testType: z.nativeEnum(SecurityTestType).optional(),
  engagementId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export type CreateSecurityTestDto = z.infer<typeof CreateSecurityTestSchema>;
export type UpdateSecurityTestDto = z.infer<typeof UpdateSecurityTestSchema>;
export type ChangeSecurityTestStatusDto = z.infer<typeof ChangeSecurityTestStatusSchema>;
export type AuthoriseSecurityTestDto = z.infer<typeof AuthoriseSecurityTestSchema>;
export type SecurityTestAssetsDto = z.infer<typeof SecurityTestAssetsSchema>;
export type SecurityTestListQueryDto = z.infer<typeof SecurityTestListQuerySchema>;
