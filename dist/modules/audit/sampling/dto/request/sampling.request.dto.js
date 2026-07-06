"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunSamplingRequestSchema = void 0;
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
//# sourceMappingURL=sampling.request.dto.js.map