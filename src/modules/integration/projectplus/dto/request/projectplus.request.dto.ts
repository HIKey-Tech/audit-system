import { z } from 'zod';

export const ListProjectPlusEntitiesQuerySchema = z.object({
  customerType: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[A-Za-z0-9 _-]+$/, 'customerType may contain letters, numbers, spaces, hyphens and underscores only'),
  search: z.string().trim().max(100).optional(),
  status: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListProjectPlusEntitiesQuery = z.infer<typeof ListProjectPlusEntitiesQuerySchema>;

export const LinkProjectPlusEntitySchema = z.object({
  customerType: ListProjectPlusEntitiesQuerySchema.shape.customerType,
  referenceCode: z.string().trim().min(1).max(100),
});

export type LinkProjectPlusEntityDto = z.infer<typeof LinkProjectPlusEntitySchema>;
