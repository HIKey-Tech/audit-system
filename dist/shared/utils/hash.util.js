"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = void 0;
// src/shared/utils/hash.util.ts
const crypto_1 = require("crypto");
/** SHA-256 of a buffer or string, as lowercase hex. */
const sha256Hex = (input) => (0, crypto_1.createHash)('sha256').update(input).digest('hex');
exports.sha256Hex = sha256Hex;
//# sourceMappingURL=hash.util.js.map