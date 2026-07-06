import { z } from 'zod';

// Multipart form fields arrive as strings — coerce the numerics.
// (valueColumn presence for high_value is enforced in the sampler, which the
// service maps to a 400 — the validate middleware only takes plain objects.)
export const RunSamplingRequestSchema = z.object({
  method: z.enum(['random', 'interval', 'high_value']),
  sampleSize: z.coerce.number().int().min(1).max(10_000),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  valueColumn: z.string().max(200).optional(),
  threshold: z.coerce.number().optional(),
});

export type RunSamplingRequestDto = z.infer<typeof RunSamplingRequestSchema>;
