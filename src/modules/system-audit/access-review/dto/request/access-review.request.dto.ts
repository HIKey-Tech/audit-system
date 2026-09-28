import { z } from 'zod';
import { ExportFormatSchema } from '../../../../../shared/utils/tabular-export.util';
import { AccessDecision } from '../../../domain/enum/system-audit.enum';

const QueryBooleanSchema = z.enum(['true', 'false']).transform((v) => v === 'true');

export const AccessItemListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  decision: z.nativeEnum(AccessDecision).optional(),
  /** Only accounts an analysis rule raised something against. */
  flagged: QueryBooleanSchema.optional(),
  privileged: QueryBooleanSchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const DecideAccessItemsSchema = z
  .object({
    itemIds: z.array(z.string().uuid()).min(1).max(500),
    decision: z.nativeEnum(AccessDecision),
    note: z.string().trim().max(4000).optional(),
  })
  .refine(
    (d) => ![AccessDecision.Revoke, AccessDecision.Modify].includes(d.decision) || Boolean(d.note),
    { message: 'Say what access should be removed or changed', path: ['note'] },
  );

export const AccessItemExportQuerySchema = z.object({ format: ExportFormatSchema });

export type AccessItemListQueryDto = z.infer<typeof AccessItemListQuerySchema>;
export type DecideAccessItemsDto = z.infer<typeof DecideAccessItemsSchema>;
export type AccessItemExportQueryDto = z.infer<typeof AccessItemExportQuerySchema>;
