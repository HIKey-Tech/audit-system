"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityQuerySchema = void 0;
const zod_1 = require("zod");
exports.ActivityQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().positive().max(50).default(20),
});
//# sourceMappingURL=dashboard.request.dto.js.map