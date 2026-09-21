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
