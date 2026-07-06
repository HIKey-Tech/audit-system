"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogTimeEntrySchema = void 0;
const zod_1 = require("zod");
exports.LogTimeEntrySchema = zod_1.z.object({
    entryDate: zod_1.z.coerce.date(),
    hours: zod_1.z.number().positive().max(24),
    description: zod_1.z.string().max(500).optional(),
});
//# sourceMappingURL=time-entry.request.dto.js.map