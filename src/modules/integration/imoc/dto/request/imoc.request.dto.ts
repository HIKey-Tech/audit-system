import { z } from 'zod';

const ImocTicketLookupSchema = z
  .object({
    orderId: z.string().trim().min(1).max(200).optional(),
    orderNumber: z.string().trim().min(1).max(200).optional(),
  })
  .refine((value) => Boolean(value.orderId || value.orderNumber), {
    message: 'Provide an IMOC ticket ID or ticket number.',
  });

export const SearchImocTicketsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  orderStatus: z.string().trim().max(100).optional(),
  modelId: z.string().trim().max(200).optional(),
  modelName: z.string().trim().max(200).optional(),
  orderNumber: z.string().trim().max(500).optional(),
  orderName: z.string().trim().max(500).optional(),
  currentUser: z.string().trim().max(200).optional(),
  slaStatus: z.string().trim().max(100).optional(),
  beginStartDate: z.string().trim().max(40).optional(),
  beginEndDate: z.string().trim().max(40).optional(),
  endStartDate: z.string().trim().max(40).optional(),
  endEndDate: z.string().trim().max(40).optional(),
});

export const LinkImocTicketSchema = ImocTicketLookupSchema;
export const ImocTicketLookupRequestSchema = ImocTicketLookupSchema;
export const ImocModelLookupSchema = z.object({ modelId: z.string().trim().min(1).max(200) });
export const ImocSyncRequestSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export type SearchImocTicketsDto = z.infer<typeof SearchImocTicketsSchema>;
export type LinkImocTicketDto = z.infer<typeof LinkImocTicketSchema>;
export type ImocTicketLookupRequestDto = z.infer<typeof ImocTicketLookupRequestSchema>;
export type ImocModelLookupDto = z.infer<typeof ImocModelLookupSchema>;
export type ImocSyncRequestDto = z.infer<typeof ImocSyncRequestSchema>;

// ---------------------------------------------------------------------------
// Ingestion Rules & Runs DTOs
// ---------------------------------------------------------------------------

export const CreateImocRuleSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(1).max(1000).default(100),
  criteria: z.record(z.unknown()), // Will be strictly validated via validateRuleCriteria
  category: z.string().trim().max(100).optional(),
  riskCategoryId: z.string().uuid().optional(),
  lookbackDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const UpdateImocRuleSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  priority: z.coerce.number().int().min(1).max(1000).optional(),
  criteria: z.record(z.unknown()).optional(),
  category: z.string().trim().max(100).optional().nullable(),
  riskCategoryId: z.string().uuid().optional().nullable(),
  lookbackDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const PreviewImocRuleSchema = z.object({
  criteria: z.record(z.unknown()),
  lookbackDays: z.coerce.number().int().min(1).max(365).default(30),
});

// ---------------------------------------------------------------------------
// Stored Tickets Query & Export DTOs
// ---------------------------------------------------------------------------

export const ListStoredTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  slaStatus: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  modelId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  createdFrom: z.string().trim().optional(),
  createdTo: z.string().trim().optional(),
  handler: z.string().trim().optional(),
  sort: z
    .enum(['orderNumber', 'imocCreatedAt', 'orderStatus', 'slaStatus', 'category', 'lastSyncedAt'])
    .default('imocCreatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ---------------------------------------------------------------------------
// Saved Views DTOs
// ---------------------------------------------------------------------------

export const CreateSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(100),
  filters: z.record(z.unknown()),
  isDefault: z.boolean().default(false),
});

export const UpdateSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  filters: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Risk Link DTOs
// ---------------------------------------------------------------------------

export const CreateTicketRiskLinkSchema = z.object({
  imocTicketId: z.string().uuid(),
  riskId: z.string().uuid().optional(),
  createRisk: z
    .object({
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().min(1),
      categoryId: z.string().uuid(),
      likelihood: z.coerce.number().int().min(1).max(5).default(3),
      impact: z.coerce.number().int().min(1).max(5).default(3),
      businessObjective: z.string().trim().max(500).optional(),
    })
    .optional(),
  notes: z.string().trim().optional(),
});

export type CreateImocRuleDto = z.infer<typeof CreateImocRuleSchema>;
export type UpdateImocRuleDto = z.infer<typeof UpdateImocRuleSchema>;
export type PreviewImocRuleDto = z.infer<typeof PreviewImocRuleSchema>;
export type ListStoredTicketsQueryDto = z.infer<typeof ListStoredTicketsQuerySchema>;
export type CreateSavedViewDto = z.infer<typeof CreateSavedViewSchema>;
export type UpdateSavedViewDto = z.infer<typeof UpdateSavedViewSchema>;
export type CreateTicketRiskLinkDto = z.infer<typeof CreateTicketRiskLinkSchema>;

