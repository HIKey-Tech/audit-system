import { z } from 'zod';

export const CreateMappingSchema = z.object({
  adGroupId: z.string().uuid('adGroupId must be the group Object ID (GUID)'),
  adGroupName: z.string().min(1).max(256),
  roleId: z.string().uuid(),
});
export type CreateMappingDto = z.infer<typeof CreateMappingSchema>;

export const UpdateMappingSchema = z.object({
  adGroupName: z.string().min(1).max(256).optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMappingDto = z.infer<typeof UpdateMappingSchema>;
