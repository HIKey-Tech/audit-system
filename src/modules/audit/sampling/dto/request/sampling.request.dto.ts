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

// Sample-size planning: derive how many items to test from confidence + tolerable
// rate. A JSON body (not multipart) — no file involved. The cross-field rule
// (expected < tolerable) is enforced in attributeSampleSize and surfaced as a 400.
export const SampleSizeRequestSchema = z.object({
  populationSize: z.coerce.number().int().min(1).max(100_000_000),
  confidenceLevel: z.coerce.number().gt(0).lt(1),
  tolerableRate: z.coerce.number().gt(0).max(1),
  expectedRate: z.coerce.number().min(0).lt(1).optional(),
});

export type SampleSizeRequestDto = z.infer<typeof SampleSizeRequestSchema>;
