"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SampleSizeRequestSchema = exports.RunSamplingRequestSchema = void 0;
const zod_1 = require("zod");
// Multipart form fields arrive as strings — coerce the numerics.
// (valueColumn presence for high_value is enforced in the sampler, which the
// service maps to a 400 — the validate middleware only takes plain objects.)
exports.RunSamplingRequestSchema = zod_1.z.object({
    method: zod_1.z.enum(['random', 'interval', 'high_value']),
    sampleSize: zod_1.z.coerce.number().int().min(1).max(10_000),
    seed: zod_1.z.coerce.number().int().min(0).max(2_147_483_647).optional(),
    valueColumn: zod_1.z.string().max(200).optional(),
    threshold: zod_1.z.coerce.number().optional(),
});
// Sample-size planning: derive how many items to test from confidence + tolerable
// rate. A JSON body (not multipart) — no file involved. The cross-field rule
// (expected < tolerable) is enforced in attributeSampleSize and surfaced as a 400.
exports.SampleSizeRequestSchema = zod_1.z.object({
    populationSize: zod_1.z.coerce.number().int().min(1).max(100_000_000),
    confidenceLevel: zod_1.z.coerce.number().gt(0).lt(1),
    tolerableRate: zod_1.z.coerce.number().gt(0).max(1),
    expectedRate: zod_1.z.coerce.number().min(0).lt(1).optional(),
});
//# sourceMappingURL=sampling.request.dto.js.map